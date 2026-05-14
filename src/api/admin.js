import { scrapeAllTvporiChannels, scrapeTvporiByName, TVPORI_CHANNELS, discoverTvporiStreams, scrapeTvporiChannel } from '../core/tvporiScraper.js'
import { importTvtvCsv, scrapeAllTvtvChannels } from '../core/tvtvScraper.js'
import { checkAllStreams, checkChannelById, streamStats } from '../core/streamChecker.js'
import { buildLogoIndex, searchLogos, autoMatchLogo, logoStats } from '../core/logoEngine.js'
import { getDb } from '../db/schema.js'
import { fetchM3USource, refreshAllM3USources, parseM3U, importChannels } from '../core/aggregator.js'
import { fetchEpgSource, refreshAllEpgSources, searchEpgIds, autoMatchEpgId, rebuildFuseIndex } from '../core/epgEngine.js'
import { randomBytes } from 'crypto'
import { invalidateAll as invalidateM3UCache, cacheStats } from '../core/m3uCache.js'
import { getIpStatus } from '../core/ipMonitor.js'

export default async function adminRoutes(fastify) {

  // ── LOGIN ─────────────────────────────────────────────────────────────────
  fastify.post('/admin/login', async (req, reply) => {
    const { username, password } = req.body||{}
    const user = getDb().prepare(`SELECT * FROM users WHERE username=? AND password=? AND status='active'`).get(username, password)
    if (!user) return reply.code(401).send({ error:'Credenciales inválidas' })
    if (user.plan!=='admin'&&user.max_streams<99) return reply.code(403).send({ error:'Sin acceso admin' })
    return { token: user.token, username: user.username }
  })

  // ── STATS ─────────────────────────────────────────────────────────────────
  fastify.get('/admin/stats', async () => {
    const db = getDb()
    return {
      channels:     db.prepare(`SELECT COUNT(*) as n FROM channels WHERE enabled=1`).get()?.n||0,
      channels_epg: db.prepare(`SELECT COUNT(*) as n FROM channels WHERE epg_id!='' AND enabled=1`).get()?.n||0,
      categories:   db.prepare(`SELECT COUNT(*) as n FROM categories`).get()?.n||0,
      users:        db.prepare(`SELECT COUNT(*) as n FROM users WHERE status='active'`).get()?.n||0,
      m3u_sources:  db.prepare(`SELECT COUNT(*) as n FROM m3u_sources`).get()?.n||0,
      epg_sources:  db.prepare(`SELECT COUNT(*) as n FROM epg_sources`).get()?.n||0,
      epg_index:    db.prepare(`SELECT COUNT(*) as n FROM epg_index`).get()?.n||0,
      url_fhd:      db.prepare(`SELECT COUNT(*) as n FROM channels WHERE url_fhd!='' AND enabled=1`).get()?.n||0,
      url_hd:       db.prepare(`SELECT COUNT(*) as n FROM channels WHERE url_hd!='' AND enabled=1`).get()?.n||0,
      url_sd:       db.prepare(`SELECT COUNT(*) as n FROM channels WHERE url_sd!='' AND enabled=1`).get()?.n||0,
      recent_logs:  db.prepare(`SELECT * FROM refresh_log ORDER BY created_at DESC LIMIT 20`).all(),
    }
  })

  // ── M3U CACHE ─────────────────────────────────────────────────────────────
  fastify.get('/admin/m3u-cache/stats', async () => cacheStats())

  fastify.post('/admin/m3u-cache/invalidate', async () => {
    invalidateM3UCache('manual via API')
    return { ok: true }
  })

  // ── SYSTEM STATE ──────────────────────────────────────────────────────────
  fastify.get('/admin/system/ip-status', async () => getIpStatus())


  // ── CANALES ───────────────────────────────────────────────────────────────
  fastify.get('/admin/channels', async (req) => {
    const db = getDb()
    const { page=1, limit=50, cat, search } = req.query
    const offset = (parseInt(page)-1)*parseInt(limit)
    let q=`SELECT c.*,cat.name as cat_name,cat.icon as cat_icon FROM channels c LEFT JOIN categories cat ON c.category_id=cat.id WHERE 1=1`
    const p=[]
    if (cat)    { q+=` AND c.category_id=?`; p.push(cat) }
    if (search) { q+=` AND c.name LIKE ?`;   p.push(`%${search}%`) }
    const total = getDb().prepare(q.replace('SELECT c.*,cat.name as cat_name,cat.icon as cat_icon','SELECT COUNT(*) as n')).get(...p)?.n||0
    const channels = db.prepare(q+` ORDER BY cat.sort_order,c.sort_order,c.name LIMIT ? OFFSET ?`).all(...p,parseInt(limit),offset)
    return { total, page:parseInt(page), limit:parseInt(limit), channels }
  })


  fastify.get("/admin/channels/:id", async (req, reply) => {
    const db = getDb()
    const ch = db.prepare(`SELECT c.*, cat.name as cat_name FROM channels c LEFT JOIN categories cat ON c.category_id=cat.id WHERE c.id=?`).get(req.params.id)
    if (!ch) return reply.code(404).send({ error: "Canal no encontrado" })
    return ch
  })
  fastify.post('/admin/channels', async (req, reply) => {
    const db = getDb()
    const { name, category_id, country, logo, epg_id, url_fhd, url_hd, url_sd } = req.body||{}
    if (!name) return reply.code(400).send({ error:'name requerido' })
    if (!url_fhd&&!url_hd&&!url_sd) return reply.code(400).send({ error:'Al menos una URL requerida' })
    if (db.prepare(`SELECT id FROM channels WHERE LOWER(name)=LOWER(?)`).get(name)) return reply.code(409).send({ error:'Canal duplicado' })
    const streamId = (db.prepare(`SELECT COALESCE(MAX(stream_id),1000) as m FROM channels`).get()?.m||1000)+1
    const r = db.prepare(`INSERT INTO channels (name,category_id,country,logo,epg_id,url_fhd,url_hd,url_sd,stream_id) VALUES (?,?,?,?,?,?,?,?,?)`).run(name,category_id||null,country||'',logo||'',epg_id||'',url_fhd||'',url_hd||'',url_sd||'',streamId)
    invalidateM3UCache('channel created'); return reply.code(201).send({ id:r.lastInsertRowid, stream_id:streamId })
  })

  fastify.put('/admin/channels/:id', async (req, reply) => {
    const db = getDb()
    const { name,category_id,country,logo,epg_id,url_fhd,url_hd,url_sd,enabled,sort_order } = req.body||{}
    if (!db.prepare(`SELECT id FROM channels WHERE id=?`).get(req.params.id)) return reply.code(404).send({ error:'No encontrado' })
    db.prepare(`UPDATE channels SET name=COALESCE(?,name),category_id=COALESCE(?,category_id),country=COALESCE(?,country),logo=COALESCE(?,logo),epg_id=COALESCE(?,epg_id),url_fhd=COALESCE(?,url_fhd),url_hd=COALESCE(?,url_hd),url_sd=COALESCE(?,url_sd),enabled=COALESCE(?,enabled),sort_order=COALESCE(?,sort_order),updated_at=datetime('now') WHERE id=?`).run(name,category_id,country,logo,epg_id,url_fhd,url_hd,url_sd,enabled,sort_order,req.params.id)
    invalidateM3UCache('channel updated'); return { ok:true }
  })

  fastify.delete('/admin/channels/:id', async (req) => {
    getDb().prepare(`DELETE FROM channels WHERE id=?`).run(req.params.id)
    invalidateM3UCache('channel deleted'); return { ok:true }
  })

  // ── EPG SEARCH ────────────────────────────────────────────────────────────
  fastify.get('/admin/epg/search', async (req) => {
    const { q, limit=20 } = req.query
    if (!q) return []
    return searchEpgIds(q, parseInt(limit))
  })

  fastify.get('/admin/epg/stats', async () => {
    const db = getDb()
    return {
      total: db.prepare(`SELECT COUNT(*) as n FROM epg_index`).get()?.n||0,
      sources: db.prepare(`SELECT source_name,COUNT(*) as count FROM epg_index GROUP BY source_name ORDER BY count DESC`).all(),
    }
  })

  fastify.post('/admin/channels/:id/auto-epg', async (req, reply) => {
    const db = getDb()
    const ch = db.prepare(`SELECT * FROM channels WHERE id=?`).get(req.params.id)
    if (!ch) return reply.code(404).send({ error:'Canal no encontrado' })
    const match = autoMatchEpgId(ch.name)
    if (!match) return reply.code(404).send({ error:'Sin coincidencia', channel:ch.name })
    if (req.body?.apply) {
      db.prepare(`UPDATE channels SET epg_id=?,updated_at=datetime('now') WHERE id=?`).run(match.epg_id,ch.id)
      if (match.icon&&!ch.logo) db.prepare(`UPDATE channels SET logo=? WHERE id=?`).run(match.icon,ch.id)
    }
    return match
  })

  // ── DESCUBRIMIENTO TVPORI ─────────────────────────────────────────────────
  // POST /admin/tvpori/discover
  // Body: { host: 'deportes' | 'regionales' | 'both', from?: 1, to?: 100, delay_ms?: 1000 }
  // Hace un barrido secuencial de stream_ids en el host indicado y devuelve
  // cuáles están vivos. NO modifica la base de datos — solo reporta.
  // Útil para descubrir canales que existen en tvpori pero no están en TVPORI_CHANNELS.
  fastify.post('/admin/tvpori/discover', async (req, reply) => {
    const db = getDb()
    const { host = 'both', from = 1, to = 500, delay_ms = 1000, stop_after_errors = 5 } = req.body || {}
    
    const hostMap = {
      'deportes':   'deportes.ksdjugfsddeports.com',
      'regionales': 'regionales.saohgdasregions.fun',
    }
    
    const hostsToScan = host === 'both' ? Object.keys(hostMap) : [host]
    if (hostsToScan.some(h => !hostMap[h])) {
      return reply.code(400).send({ error: `host inválido. Use 'deportes', 'regionales' o 'both'` })
    }
    
    // Respuesta inmediata, scan en background
    reply.send({ status: 'discovering', hosts: hostsToScan, range: [from, to], delay_ms, stop_after_errors })
    
    // Ejecutar barrido en background
    ;(async () => {
      const allResults = {}
      for (const hostKey of hostsToScan) {
        const scrape_host = hostMap[hostKey]
        console.log(`🔎 [discover] Iniciando barrido ${hostKey} (${from}-${to}) con delay ${delay_ms}ms`)
        const { results, stopped, lastStreamId } = await discoverTvporiStreams(scrape_host, from, to, delay_ms, stop_after_errors, (p) => {
          if (p.checked % 10 === 0 || p.ok) {
            console.log(`🔎 [discover] ${hostKey} ${p.checked}/${p.total} — stream_id=${p.stream_id} ${p.ok ? '✅' : '❌'}`)
          }
        })
        allResults[hostKey] = results
        const alive = results.filter(r => r.ok).length
        const reason = stopped ? `corte por ${stop_after_errors} errores consecutivos en stream_id=${lastStreamId}` : 'completado hasta el límite'
        console.log(`🔎 [discover] ${hostKey} terminado: ${alive}/${results.length} vivos (${reason})`)
      }
      
      // Guardar resultados en system_state para consulta posterior
      try {
        const json = JSON.stringify(allResults)
        db.prepare(`INSERT OR REPLACE INTO system_state (key, value, updated_at) VALUES ('tvpori_discover_last', ?, ?)`)
          .run(json, Date.now())
        console.log(`🔎 [discover] Resultados guardados en system_state.tvpori_discover_last`)
      } catch (e) {
        console.error(`⚠️ [discover] Error guardando resultados:`, e.message)
      }
    })().catch(err => console.error('❌ [discover] Error:', err))
  })

  // GET /admin/tvpori/discover/last — devuelve el último resultado de descubrimiento
  fastify.get('/admin/tvpori/discover/last', async () => {
    const db = getDb()
    const row = db.prepare(`SELECT value, updated_at FROM system_state WHERE key='tvpori_discover_last'`).get()
    if (!row) return { available: false, message: 'No hay descubrimientos previos' }
    
    const results = JSON.parse(row.value)
    const summary = {}
    
    // Para cada host, calcular: alive, dead, nuevos (no están en DB)
    for (const [hostKey, items] of Object.entries(results)) {
      const slug = hostKey === 'deportes' ? 'deportes' : 'regionales'
      const aliveItems = items.filter(i => i.ok)
      
      // Marcar cuáles ya están en DB
      const enriched = aliveItems.map(i => {
        const externalId = `tvpori:${slug}:${i.stream_id}`
        const existing = db.prepare(`SELECT id, name FROM channels WHERE external_id=?`).get(externalId)
        return {
          ...i,
          external_id: externalId,
          in_db: !!existing,
          db_id: existing?.id || null,
          db_name: existing?.name || null,
        }
      })
      
      summary[hostKey] = {
        scanned: items.length,
        alive: aliveItems.length,
        in_db: enriched.filter(i => i.in_db).length,
        new_to_db: enriched.filter(i => !i.in_db).length,
        channels: enriched,
      }
    }
    
    return {
      available: true,
      updated_at: new Date(parseInt(row.updated_at)).toISOString(),
      summary,
    }
  })

  // GET /admin/tvpori/discover/pending?host=&page=&page_size=
  // Lista filtrada de canales descubiertos PENDIENTES (no en DB, no skipped)
  fastify.get('/admin/tvpori/discover/pending', async (req) => {
    const db = getDb()
    const { host = 'both', page = 1, page_size = 1 } = req.query || {}
    const pageNum = Math.max(1, parseInt(page) || 1)
    const pageSize = Math.max(1, parseInt(page_size) || 1)
    
    const row = db.prepare(`SELECT value FROM system_state WHERE key='tvpori_discover_last'`).get()
    if (!row) return { available: false, message: 'No hay descubrimientos previos' }
    
    const allResults = JSON.parse(row.value)
    const hostKeys = host === 'both' ? Object.keys(allResults) : [host]
    
    // Construir lista plana de pendientes (alive + no in_db + no skipped)
    const skippedRows = db.prepare(`SELECT host, stream_id FROM tvpori_skipped`).all()
    const skippedSet = new Set(skippedRows.map(r => `${r.host}:${r.stream_id}`))
    
    const pending = []
    for (const hostKey of hostKeys) {
      const slug = hostKey === 'deportes' ? 'deportes' : 'regionales'
      const items = allResults[hostKey] || []
      for (const item of items) {
        if (!item.ok) continue
        const externalId = `tvpori:${slug}:${item.stream_id}`
        const existing = db.prepare(`SELECT id FROM channels WHERE external_id=?`).get(externalId)
        if (existing) continue
        if (skippedSet.has(`${hostKey}:${item.stream_id}`)) continue
        pending.push({
          host: hostKey,
          stream_id: item.stream_id,
          external_id: externalId,
          url: item.url,
        })
      }
    }
    
    const total = pending.length
    const totalPages = Math.ceil(total / pageSize)
    const start = (pageNum - 1) * pageSize
    const items = pending.slice(start, start + pageSize)
    
    return {
      available: true,
      page: pageNum,
      page_size: pageSize,
      total,
      total_pages: totalPages,
      items,
    }
  })

  // POST /admin/tvpori/skip-discovered
  // Body: { host, stream_id, reason? }
  fastify.post('/admin/tvpori/skip-discovered', async (req, reply) => {
    const { host, stream_id, reason = '' } = req.body || {}
    if (!host || stream_id === undefined) {
      return reply.code(400).send({ error: 'host y stream_id requeridos' })
    }
    const db = getDb()
    db.prepare(`INSERT OR REPLACE INTO tvpori_skipped (host, stream_id, reason, skipped_at) VALUES (?, ?, ?, datetime('now'))`)
      .run(host, parseInt(stream_id), String(reason))
    return { ok: true, host, stream_id }
  })

  // DELETE /admin/tvpori/skip-discovered/:host/:stream_id  (deshacer skip)
  fastify.delete('/admin/tvpori/skip-discovered/:host/:stream_id', async (req) => {
    const db = getDb()
    db.prepare(`DELETE FROM tvpori_skipped WHERE host=? AND stream_id=?`)
      .run(req.params.host, parseInt(req.params.stream_id))
    return { ok: true }
  })

  // GET /admin/tvpori/fresh-url?host=&stream_id=
  // Hace scrape FRESCO y devuelve la URL del stream (para preview)
  fastify.get('/admin/tvpori/fresh-url', async (req, reply) => {
    const { host, stream_id } = req.query || {}
    if (!host || !stream_id) {
      return reply.code(400).send({ error: 'host y stream_id requeridos' })
    }
    const hostMap = {
      'deportes':   'deportes.ksdjugfsddeports.com',
      'regionales': 'regionales.saohgdasregions.fun',
    }
    const scrape_host = hostMap[host]
    if (!scrape_host) return reply.code(400).send({ error: 'host inválido' })

    const ch = { scrape_host, stream_id: String(stream_id), db_name: `${host}_${stream_id}` }
    const result = await scrapeTvporiChannel(ch)
    if (!result.ok || !result.url) {
      return reply.code(502).send({ error: `Scrape falló: ${result.error || 'sin URL'}` })
    }
    return { ok: true, url: result.url, expiresAt: result.expiresAt }
  })

  // POST /admin/tvpori/import-discovered
  // Body: {
  //   host: 'deportes' | 'regionales',
  //   stream_id: number,
  //   name?: string,           // default: '{host}_{stream_id}'
  //   category_id?: number,
  //   epg_id?: string,
  //   logo?: string,
  //   country?: string,
  //   quality_label?: string,  // 'FHD' | 'HD' | 'SD' | 'Unknown'
  // }
  // Hace scrape FRESCO del stream_id y crea el canal con external_id.
  fastify.post('/admin/tvpori/import-discovered', async (req, reply) => {
    const { host, stream_id, name, category_id, epg_id, logo, country, quality_label } = req.body || {}
    
    if (!host || stream_id === undefined) {
      return reply.code(400).send({ error: 'host y stream_id requeridos' })
    }
    
    const hostMap = {
      'deportes':   'deportes.ksdjugfsddeports.com',
      'regionales': 'regionales.saohgdasregions.fun',
    }
    const scrape_host = hostMap[host]
    if (!scrape_host) {
      return reply.code(400).send({ error: `host inválido: ${host}` })
    }
    
    const db = getDb()
    const externalId = `tvpori:${host}:${stream_id}`
    
    // Verificar que no exista ya
    const existing = db.prepare(`SELECT id, name FROM channels WHERE external_id=?`).get(externalId)
    if (existing) {
      return reply.code(409).send({ error: `Ya existe en DB`, channel: existing })
    }
    
    // Scrape fresco
    const sid = String(stream_id)
    const channelInfo = { scrape_host, stream_id: sid, db_name: name || `${host}_${stream_id}` }
    const scrapeResult = await scrapeTvporiChannel(channelInfo)
    
    if (!scrapeResult.ok || !scrapeResult.url) {
      return reply.code(502).send({ error: `Scrape falló: ${scrapeResult.error || 'sin URL'}` })
    }
    
    // Calcular stream_id correlativo nuevo (no confundir con tvpori stream_id)
    const maxRow = db.prepare(`SELECT COALESCE(MAX(stream_id), 2000) as m FROM channels`).get()
    const nextStreamId = (maxRow?.m || 2000) + 1
    
    // Resolver category_id: default según host
    let catId = category_id || null
    if (!catId) {
      const defaultCatName = host === 'deportes' ? 'Deportes' : 'General'
      const cat = db.prepare(`SELECT id FROM categories WHERE name=?`).get(defaultCatName)
      catId = cat?.id || null
    }
    
    // INSERT con external_id y datos opcionales
    const channelName = name || `${host}_${stream_id}`
    const result = db.prepare(`
      INSERT INTO channels (
        name, category_id, country, logo, epg_id, url_hd,
        stream_id, enabled, source_id,
        tvpori_host, tvpori_stream_id, tvpori_scraped_at,
        external_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, NULL, ?, ?, datetime('now'), ?, datetime('now'), datetime('now'))
    `).run(
      channelName,
      catId,
      country || '',
      logo || '',
      epg_id || '',
      scrapeResult.url,
      nextStreamId,
      scrape_host,
      sid,
      externalId
    )
    
    // Invalidar cache M3U
    invalidateM3UCache('import discovered')
    
    return {
      ok: true,
      channel: {
        id: result.lastInsertRowid,
        name: channelName,
        external_id: externalId,
        stream_id: nextStreamId,
        url_hd: scrapeResult.url,
        category_id: catId,
        quality_label: quality_label || 'Unknown',
      }
    }
  })

  // POST /admin/tvpori/import-all-pending
  // Body: { category_id: number, delay_ms?: number, host?: 'both'|'deportes'|'regionales' }
  // Importa TODOS los canales pendientes con nombres tvpori-DEP-NNN / tvpori-REG-NNN.
  // Asíncrono: responde inmediato y corre en background.
  fastify.post('/admin/tvpori/import-all-pending', async (req, reply) => {
    const { category_id, delay_ms = 1200, host = 'both' } = req.body || {}
    if (!category_id) {
      return reply.code(400).send({ error: 'category_id requerido (usa la categoría "Por revisar")' })
    }
    
    const db = getDb()
    
    // Validar categoría
    const cat = db.prepare(`SELECT id, name FROM categories WHERE id=?`).get(parseInt(category_id))
    if (!cat) {
      return reply.code(400).send({ error: `Categoría id=${category_id} no existe` })
    }
    
    // Obtener lista de pendientes desde system_state
    const row = db.prepare(`SELECT value FROM system_state WHERE key='tvpori_discover_last'`).get()
    if (!row) {
      return reply.code(400).send({ error: 'No hay descubrimientos previos. Lanza /admin/tvpori/discover primero.' })
    }
    
    const allResults = JSON.parse(row.value)
    const hostKeys = host === 'both' ? Object.keys(allResults) : [host]
    
    // Construir lista de pendientes (alive + no in_db + no skipped)
    const skippedRows = db.prepare(`SELECT host, stream_id FROM tvpori_skipped`).all()
    const skippedSet = new Set(skippedRows.map(r => `${r.host}:${r.stream_id}`))
    
    const pending = []
    for (const hostKey of hostKeys) {
      const items = allResults[hostKey] || []
      for (const item of items) {
        if (!item.ok) continue
        const externalId = `tvpori:${hostKey}:${item.stream_id}`
        const existing = db.prepare(`SELECT id FROM channels WHERE external_id=?`).get(externalId)
        if (existing) continue
        if (skippedSet.has(`${hostKey}:${item.stream_id}`)) continue
        pending.push({ host: hostKey, stream_id: item.stream_id, externalId })
      }
    }
    
    // Responder inmediato
    reply.send({
      status: 'importing',
      total: pending.length,
      category: cat.name,
      delay_ms,
      estimated_minutes: Math.ceil(pending.length * delay_ms / 60000),
    })
    
    // Ejecutar en background
    ;(async () => {
      const hostMap = {
        'deportes':   'deportes.ksdjugfsddeports.com',
        'regionales': 'regionales.saohgdasregions.fun',
      }
      
      let imported = 0
      let failed = 0
      const startTime = Date.now()
      console.log(`🚀 [bulk-import] Iniciando importación masiva: ${pending.length} canales en categoría "${cat.name}" (delay ${delay_ms}ms)`)
      
      for (let i = 0; i < pending.length; i++) {
        const { host: hostKey, stream_id, externalId } = pending[i]
        const scrape_host = hostMap[hostKey]
        const prefix = hostKey === 'deportes' ? 'DEP' : 'REG'
        const padded = String(stream_id).padStart(3, '0')
        const channelName = `tvpori-${prefix}-${padded}`
        
        try {
          // Verificar de nuevo (puede haberse importado mientras tanto)
          const exists = db.prepare(`SELECT id FROM channels WHERE external_id=?`).get(externalId)
          if (exists) {
            console.log(`⏭️  [bulk-import] ${i+1}/${pending.length} ${channelName} ya existe (id ${exists.id})`)
            continue
          }
          
          // Scrape fresco
          const channelInfo = { scrape_host, stream_id: String(stream_id), db_name: channelName }
          const result = await scrapeTvporiChannel(channelInfo)
          
          if (!result.ok || !result.url) {
            console.warn(`❌ [bulk-import] ${i+1}/${pending.length} ${channelName} scrape falló: ${result.error}`)
            failed++
            continue
          }
          
          // Calcular nuevo stream_id correlativo
          const maxRow = db.prepare(`SELECT COALESCE(MAX(stream_id), 2000) as m FROM channels`).get()
          const nextStreamId = (maxRow?.m || 2000) + 1
          
          // INSERT
          db.prepare(`
            INSERT INTO channels (
              name, category_id, country, logo, epg_id, url_hd,
              stream_id, enabled, source_id,
              tvpori_host, tvpori_stream_id, tvpori_scraped_at,
              external_id, created_at, updated_at
            ) VALUES (?, ?, '', '', '', ?, ?, 1, NULL, ?, ?, datetime('now'), ?, datetime('now'), datetime('now'))
          `).run(channelName, cat.id, result.url, nextStreamId, scrape_host, String(stream_id), externalId)
          
          imported++
          
          if ((i+1) % 25 === 0 || i+1 === pending.length) {
            const elapsed = Math.round((Date.now() - startTime) / 1000)
            const rate = (i+1) / elapsed
            const remaining = Math.round((pending.length - (i+1)) / rate)
            console.log(`📦 [bulk-import] ${i+1}/${pending.length} (${imported} OK, ${failed} fail) — ${elapsed}s elapsed, ~${remaining}s restantes`)
          }
        } catch (e) {
          console.error(`❌ [bulk-import] ${i+1}/${pending.length} ${channelName}: ${e.message}`)
          failed++
        }
        
        if (i < pending.length - 1) await new Promise(r => setTimeout(r, delay_ms))
      }
      
      const elapsed = Math.round((Date.now() - startTime) / 1000)
      console.log(`✅ [bulk-import] COMPLETADO: ${imported} importados, ${failed} fallidos en ${elapsed}s`)
      
      // Guardar resultado en system_state
      try {
        db.prepare(`INSERT OR REPLACE INTO system_state (key, value, updated_at) VALUES ('tvpori_bulk_import_last', ?, ?)`)
          .run(JSON.stringify({ imported, failed, total: pending.length, elapsed_sec: elapsed, completed_at: new Date().toISOString() }), Date.now())
      } catch (e) {
        console.error(`⚠️ Error guardando resultado bulk-import:`, e.message)
      }
      
      // Invalidar cache M3U
      invalidateM3UCache('bulk import tvpori')
    })().catch(err => console.error('❌ [bulk-import] error fatal:', err))
  })

  // GET /admin/tvpori/import-all-pending/status — ver estado/resultado del último bulk
  fastify.get('/admin/tvpori/import-all-pending/status', async () => {
    const db = getDb()
    const row = db.prepare(`SELECT value, updated_at FROM system_state WHERE key='tvpori_bulk_import_last'`).get()
    if (!row) return { available: false, message: 'No hay bulk-import previo' }
    return {
      available: true,
      result: JSON.parse(row.value),
      updated_at: new Date(parseInt(row.updated_at)).toISOString(),
    }
  })

  fastify.post('/admin/channels/bulk-auto-epg', async () => {
    const db = getDb()
    const channels = db.prepare(`SELECT * FROM channels WHERE (epg_id IS NULL OR epg_id='') AND enabled=1`).all()
    let matched=0
    for (const ch of channels) {
      const m = autoMatchEpgId(ch.name)
      if (m&&m.confidence>=70) {
        db.prepare(`UPDATE channels SET epg_id=?,updated_at=datetime('now') WHERE id=?`).run(m.epg_id,ch.id)
        if (m.icon&&!ch.logo) db.prepare(`UPDATE channels SET logo=? WHERE id=?`).run(m.icon,ch.id)
        matched++
      }
    }
    invalidateM3UCache('bulk auto-epg'); return { total:channels.length, matched }
  })

  // ── FUENTES M3U ───────────────────────────────────────────────────────────
  fastify.get('/admin/sources/m3u', async () => {
    return getDb().prepare(`SELECT s.*,cat.name as default_cat_name FROM m3u_sources s LEFT JOIN categories cat ON s.default_cat_id=cat.id ORDER BY s.created_at DESC`).all()
  })

  fastify.post('/admin/sources/m3u', async (req, reply) => {
    const db = getDb()
    const { name, url, content, default_cat_id, dedup_mode } = req.body||{}
    if (!name) return reply.code(400).send({ error:'name requerido' })
    if (!url&&!content) return reply.code(400).send({ error:'url o content requerido' })
    const r = db.prepare(`INSERT INTO m3u_sources (name,url,content,default_cat_id,dedup_mode) VALUES (?,?,?,?,?)`).run(name,url||'',content||'',default_cat_id||null,dedup_mode||'name')
    const src = db.prepare(`SELECT * FROM m3u_sources WHERE id=?`).get(r.lastInsertRowid)
    fetchM3USource(src).then(() => invalidateM3UCache('m3u source refreshed')).catch(console.error)
    return reply.code(201).send({ id:r.lastInsertRowid, status:'importing' })
  })

  fastify.delete('/admin/sources/m3u/:id', async (req) => {
    getDb().prepare(`DELETE FROM m3u_sources WHERE id=?`).run(req.params.id)
    return { ok:true }
  })

  fastify.post('/admin/sources/m3u/:id/refresh', async (req, reply) => {
    const src = getDb().prepare(`SELECT * FROM m3u_sources WHERE id=?`).get(req.params.id)
    if (!src) return reply.code(404).send({ error:'No encontrada' })
    fetchM3USource(src).then(() => invalidateM3UCache('m3u source refreshed')).catch(console.error)
    return { status:'refreshing' }
  })

  fastify.post('/admin/sources/m3u/import-text', async (req, reply) => {
    const { text, default_cat_id, dedup_mode } = req.body||{}
    if (!text) return reply.code(400).send({ error:'text requerido' })
    const result = importChannels(parseM3U(text, default_cat_id||null, null), dedup_mode||'name'); invalidateM3UCache('m3u import-text'); return result
  })

  fastify.post('/admin/sources/m3u/refresh-all', async () => {
    refreshAllM3USources().then(() => invalidateM3UCache('m3u refresh-all')).catch(console.error)
    return { status:'refreshing_all' }
  })

  // ── FUENTES EPG ───────────────────────────────────────────────────────────
  fastify.get('/admin/sources/epg', async () => {
    return getDb().prepare(`SELECT * FROM epg_sources ORDER BY created_at DESC`).all()
  })

  fastify.post('/admin/sources/epg', async (req, reply) => {
    const db = getDb()
    const { name, url, country } = req.body||{}
    if (!name||!url) return reply.code(400).send({ error:'name y url requeridos' })
    if (db.prepare(`SELECT id FROM epg_sources WHERE url=?`).get(url)) return reply.code(409).send({ error:'URL EPG ya existe' })
    const r = db.prepare(`INSERT INTO epg_sources (name,url,country) VALUES (?,?,?)`).run(name,url,country||'')
    const src = db.prepare(`SELECT * FROM epg_sources WHERE id=?`).get(r.lastInsertRowid)
    fetchEpgSource(src).catch(console.error)
    return reply.code(201).send({ id:r.lastInsertRowid, status:'downloading' })
  })

  fastify.put('/admin/sources/epg/:id', async (req, reply) => {
    const { priority, enabled } = req.body || {}
    const db = getDb()
    db.prepare(`UPDATE epg_sources SET priority=COALESCE(?,priority), enabled=COALESCE(?,enabled) WHERE id=?`).run(priority, enabled, req.params.id)
    return { ok: true }
  })

  fastify.delete('/admin/sources/epg/:id', async (req) => {
    const db = getDb()
    db.prepare(`DELETE FROM epg_sources WHERE id=?`).run(req.params.id)
    db.prepare(`DELETE FROM epg_index WHERE source_id=?`).run(req.params.id)
    rebuildFuseIndex()
    return { ok:true }
  })

  fastify.post('/admin/sources/epg/:id/refresh', async (req, reply) => {
    const src = getDb().prepare(`SELECT * FROM epg_sources WHERE id=?`).get(req.params.id)
    if (!src) return reply.code(404).send({ error:'No encontrada' })
    fetchEpgSource(src).catch(console.error)
    return { status:'refreshing' }
  })

  fastify.post('/admin/sources/epg/refresh-all', async () => {
    refreshAllEpgSources().catch(console.error)
    return { status:'refreshing_all' }
  })

  // ── CATEGORÍAS ────────────────────────────────────────────────────────────
  fastify.get('/admin/categories', async () => {
    return getDb().prepare(`SELECT c.*,COUNT(ch.id) as channel_count FROM categories c LEFT JOIN channels ch ON ch.category_id=c.id GROUP BY c.id ORDER BY c.sort_order,c.name`).all()
  })

  fastify.post('/admin/categories', async (req, reply) => {
    const { name, icon, sort_order } = req.body||{}
    if (!name) return reply.code(400).send({ error:'name requerido' })
    const r = getDb().prepare(`INSERT OR IGNORE INTO categories (name,icon,sort_order) VALUES (?,?,?)`).run(name,icon||'📺',sort_order||0)
    invalidateM3UCache('category created'); return reply.code(201).send({ id:r.lastInsertRowid })
  })

  fastify.put('/admin/categories/:id', async (req) => {
    const { name, icon, sort_order } = req.body||{}
    getDb().prepare(`UPDATE categories SET name=COALESCE(?,name),icon=COALESCE(?,icon),sort_order=COALESCE(?,sort_order) WHERE id=?`).run(name,icon,sort_order,req.params.id)
    invalidateM3UCache('category updated'); return { ok:true }
  })

  fastify.delete('/admin/categories/:id', async (req) => {
    const db = getDb()
    db.prepare(`UPDATE channels SET category_id=NULL WHERE category_id=?`).run(req.params.id)
    db.prepare(`DELETE FROM categories WHERE id=?`).run(req.params.id)
    invalidateM3UCache('category deleted'); return { ok:true }
  })

  // ── USUARIOS ──────────────────────────────────────────────────────────────
  fastify.get('/admin/users', async () => {
    return getDb().prepare(`SELECT id,username,plan,max_streams,status,expires_at,created_at,notes FROM users ORDER BY created_at DESC`).all()
  })

  fastify.post('/admin/users', async (req, reply) => {
    const db = getDb()
    const { username, password, plan, max_streams, status, expires_at, notes } = req.body||{}
    if (!username||!password) return reply.code(400).send({ error:'username y password requeridos' })
    if (db.prepare(`SELECT id FROM users WHERE username=?`).get(username)) return reply.code(409).send({ error:'Usuario ya existe' })
    const token = randomBytes(16).toString('hex')
    const r = db.prepare(`INSERT INTO users (username,password,token,plan,max_streams,status,expires_at,notes) VALUES (?,?,?,?,?,?,?,?)`).run(username,password,token,plan||'basic',max_streams||1,status||'active',expires_at||null,notes||'')
    return reply.code(201).send({ id:r.lastInsertRowid, token })
  })

  fastify.put('/admin/users/:id', async (req) => {
    const { password,plan,max_streams,status,expires_at,notes } = req.body||{}
    getDb().prepare(`UPDATE users SET password=COALESCE(?,password),plan=COALESCE(?,plan),max_streams=COALESCE(?,max_streams),status=COALESCE(?,status),expires_at=COALESCE(?,expires_at),notes=COALESCE(?,notes) WHERE id=?`).run(password,plan,max_streams,status,expires_at,notes,req.params.id)
    return { ok:true }
  })

  fastify.delete('/admin/users/:id', async (req) => {
    getDb().prepare(`DELETE FROM users WHERE id=?`).run(req.params.id)
    return { ok:true }
  })

  // ── LOGOS ─────────────────────────────────────────────────────────────────

  // GET /admin/logos/search?q=CNN&limit=12
  fastify.get('/admin/logos/search', async (req) => {
    const { q, limit = 12 } = req.query
    if (!q) return []
    return searchLogos(q, parseInt(limit))
  })

  // GET /admin/logos/stats
  fastify.get('/admin/logos/stats', async () => {
    return logoStats()
  })

  // POST /admin/logos/rebuild — reconstruir índice desde GitHub
  fastify.post('/admin/logos/rebuild', async () => {
    buildLogoIndex(true).catch(console.error)
    return { status: 'rebuilding' }
  })

  // POST /admin/channels/:id/auto-logo — auto-asignar logo
  fastify.post('/admin/channels/:id/auto-logo', async (req, reply) => {
    const db = getDb()
    const ch = db.prepare(`SELECT * FROM channels WHERE id=?`).get(req.params.id)
    if (!ch) return reply.code(404).send({ error: 'Canal no encontrado' })
    const match = autoMatchLogo(ch.name)
    if (!match) return reply.code(404).send({ error: 'Sin logo encontrado', channel: ch.name })
    if (req.body?.apply) {
      db.prepare(`UPDATE channels SET logo=?,updated_at=datetime('now') WHERE id=?`)
        .run(match.url, ch.id)
    }
    return match
  })

  // POST /admin/channels/bulk-auto-logo — auto-logo en masa
  fastify.post('/admin/channels/bulk-auto-logo', async () => {
    const db = getDb()
    const channels = db.prepare(`SELECT * FROM channels WHERE (logo IS NULL OR logo='') AND enabled=1`).all()
    let matched = 0
    for (const ch of channels) {
      const m = autoMatchLogo(ch.name)
      if (m && m.score >= 0.7) {
        db.prepare(`UPDATE channels SET logo=?,updated_at=datetime('now') WHERE id=?`)
          .run(m.url, ch.id)
        matched++
      }
    }
    invalidateM3UCache('bulk auto-logo'); return { total: channels.length, matched }
  })

  // ── STREAM CHECKER ────────────────────────────────────────────────────────

  // GET /admin/streams/stats
  fastify.get('/admin/streams/stats', async () => {
    return streamStats()
  })

  // POST /admin/streams/check-all — verificar todos los canales
  fastify.post('/admin/streams/check-all', async (req, reply) => {
    // Correr en background
    checkAllStreams((progress) => {
      if (progress.checked % 10 === 0) {
        console.log(`🔍 Verificando streams: ${progress.checked}/${progress.total} — ${progress.channel}`)
      }
    }).then(results => {
      const ok = results.filter(r=>r.ok).length
      console.log(`✅ Check completado: ${ok}/${results.length} streams activos`)
    }).then(() => invalidateM3UCache('streams checked')).catch(console.error)
    return { status: 'checking', total: streamStats().total }
  })

  // POST /admin/streams/check/:id — verificar canal específico
  fastify.post('/admin/streams/check/:id', async (req, reply) => {
    const result = await checkChannelById(parseInt(req.params.id))
    if (!result) return reply.code(404).send({ error: 'Canal no encontrado' })
    return result
  })

  // GET /admin/streams/status — obtener status de todos los canales
  fastify.get('/admin/streams/status', async (req) => {
    const db = getDb()
    const { status } = req.query
    let q = `SELECT id, name, stream_status, stream_checked_at FROM channels WHERE enabled=1`
    if (status) q += ` AND stream_status='${status}'`
    q += ` ORDER BY stream_status, name`
    return db.prepare(q).all()
  })


  // ── TVTVHD SCRAPER ────────────────────────────────────────────────────────

  // POST /admin/tvtv/import-csv — importar CSV y guardar stream_params
  fastify.post('/admin/tvtv/import-csv', async (req, reply) => {
    const { url } = req.body || {}
    const csvUrl = url || 'https://raw.githubusercontent.com/jobustamantedev/localTv/main/CANALES_CORRECTOS.csv'
    try {
      const result = await importTvtvCsv(csvUrl)
      return result
    } catch(e) {
      return reply.code(500).send({ error: e.message })
    }
  })

  // POST /admin/tvtv/scrape — scrape playbackURLs de todos los canales
  fastify.post('/admin/tvtv/scrape', async (req, reply) => {
    scrapeAllTvtvChannels((p) => {
      if (p.checked % 5 === 0) {
        console.log(`🔍 Scraping ${p.checked}/${p.total} — ${p.channel} ${p.ok?'✅':'❌'}`)
      }
    }).then(() => invalidateM3UCache('tvtv scrape')).catch(console.error)
    return { status: 'scraping' }
  })

  // POST /admin/tvtv/scrape-one — scrape un canal específico por stream_param
  fastify.post('/admin/tvtv/scrape-one', async (req, reply) => {
    const { stream_param } = req.body || {}
    if (!stream_param) return reply.code(400).send({ error: 'stream_param requerido' })
    const result = await scrapeChannel(stream_param)
    return result
  })

  // ── EPG PREVIEW ───────────────────────────────────────────────────────────
  // GET /admin/epg/preview?id=... — programas actuales de un EPG ID
  fastify.get('/admin/epg/preview', async (req, reply) => {
    const { id } = req.query
    if (!id) return reply.code(400).send({ error: 'id requerido' })
    const db = getDb()
    const entry = db.prepare(`
      SELECT ei.source_id
      FROM epg_index ei
      JOIN epg_sources es ON es.id = ei.source_id
      WHERE ei.epg_id = ? AND es.enabled = 1
      ORDER BY COALESCE(es.priority, 50) ASC, es.last_fetched DESC
      LIMIT 1
    `).get(id)
    if (!entry) return { programs: [], message: 'EPG ID no encontrado' }
    const cacheFile = `./data/epg-cache/epg_${entry.source_id}.xml`
    try {
      const { readFileSync: rfs, existsSync: exs } = await import('fs')
      if (!exs(cacheFile)) return { programs: [], message: 'Cache no disponible' }
      const xml = rfs(cacheFile, 'utf8')
      const now = Date.now()
      const programs = []

      function parseUTC(str) {
        const s = str.replace(/\s.*/, '')
        return Date.UTC(+s.slice(0,4),+s.slice(4,6)-1,+s.slice(6,8),+s.slice(8,10),+s.slice(10,12),+s.slice(12,14))
      }

      const progRegex = /<programme\s[^>]*>(?:.|\n)*?<\/programme>/g
      let match
      while ((match = progRegex.exec(xml)) !== null) {
        const block = match[0]
        const ch = (block.match(/channel="([^"]+)"/) || [])[1] || ''
        if (ch.toLowerCase() !== id.toLowerCase()) continue
        const start = parseUTC((block.match(/start="([^"]+)"/) || [])[1] || '')
        const stop  = parseUTC((block.match(/stop="([^"]+)"/)  || [])[1] || '')
        if (stop < now - 3600000) continue
        if (start > now + 6*3600000) break
        const title = (block.match(/<title[^>]*>([^<]+)<\/title>/) || [])[1] || ''
        const desc  = (block.match(/<desc[^>]*>([^<]+)<\/desc>/)   || [])[1] || ''
        programs.push({
          title, desc: desc.slice(0,120),
          start: new Date(start).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit',timeZone:'America/Mexico_City'}),
          stop:  new Date(stop).toLocaleTimeString('es-MX', {hour:'2-digit',minute:'2-digit',timeZone:'America/Mexico_City'}),
          isNow: start <= now && stop >= now,
        })
        if (programs.length >= 6) break
      }
      return { epg_id: id, programs, source_id: entry.source_id }
    } catch(e) {
      return { programs: [], error: e.message }
    }
  })

  // ── TVPORINTERNET2 SCRAPER ────────────────────────────────────────────────

  fastify.post('/admin/tvpori/scrape', async () => {
    scrapeAllTvporiChannels((p) => {
      if (p.checked % 10 === 0)
        console.log(`🔍 tvpori ${p.checked}/${p.total} — ${p.channel} ${p.ok ? '✅' : '❌'}`)
    }).then(() => invalidateM3UCache('tvpori scrape')).catch(console.error)
    return { status: 'scraping', total: TVPORI_CHANNELS.length }
  })

  fastify.post('/admin/tvpori/scrape-one', async (req, reply) => {
    const { name } = req.body || {}
    if (!name) return reply.code(400).send({ error: 'name requerido' })
    const result = await scrapeTvporiByName(name)
    if (!result.ok) return reply.code(404).send(result)
    invalidateM3UCache('tvpori scrape-one'); return result
  })

  fastify.get('/admin/tvpori/channels', async () => {
    const db = getDb()
    return TVPORI_CHANNELS.map(ch => {
      const dbCh = db.prepare(
        `SELECT id, url_hd, tvpori_scraped_at FROM channels WHERE LOWER(name)=LOWER(?)`
      ).get(ch.db_name)
      return {
        name:       ch.db_name,
        host:       ch.scrape_host,
        stream_id:  ch.stream_id,
        in_db:      !!dbCh,
        has_url:    !!(dbCh?.url_hd),
        scraped_at: dbCh?.tvpori_scraped_at || null,
      }
    })
  })
}

function parseXMLTVDate(str) {
  const s = str.replace(/\s.*/, '')
  return new Date(
    parseInt(s.slice(0,4)),
    parseInt(s.slice(4,6))-1,
    parseInt(s.slice(6,8)),
    parseInt(s.slice(8,10)),
    parseInt(s.slice(10,12)),
    parseInt(s.slice(12,14))
  ).getTime()
}
