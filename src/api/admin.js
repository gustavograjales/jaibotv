import { scrapeAllTvporiChannels, scrapeTvporiByName, TVPORI_CHANNELS } from '../core/tvporiScraper.js'
import { importTvtvCsv, scrapeAllTvtvChannels } from '../core/tvtvScraper.js'
import { checkAllStreams, checkChannelById, streamStats } from '../core/streamChecker.js'
import { buildLogoIndex, searchLogos, autoMatchLogo, logoStats } from '../core/logoEngine.js'
import { getDb } from '../db/schema.js'
import { fetchM3USource, refreshAllM3USources, parseM3U, importChannels } from '../core/aggregator.js'
import { fetchEpgSource, refreshAllEpgSources, searchEpgIds, autoMatchEpgId, rebuildFuseIndex } from '../core/epgEngine.js'
import { randomBytes } from 'crypto'

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
    return reply.code(201).send({ id:r.lastInsertRowid, stream_id:streamId })
  })

  fastify.put('/admin/channels/:id', async (req, reply) => {
    const db = getDb()
    const { name,category_id,country,logo,epg_id,url_fhd,url_hd,url_sd,enabled,sort_order } = req.body||{}
    if (!db.prepare(`SELECT id FROM channels WHERE id=?`).get(req.params.id)) return reply.code(404).send({ error:'No encontrado' })
    db.prepare(`UPDATE channels SET name=COALESCE(?,name),category_id=COALESCE(?,category_id),country=COALESCE(?,country),logo=COALESCE(?,logo),epg_id=COALESCE(?,epg_id),url_fhd=COALESCE(?,url_fhd),url_hd=COALESCE(?,url_hd),url_sd=COALESCE(?,url_sd),enabled=COALESCE(?,enabled),sort_order=COALESCE(?,sort_order),updated_at=datetime('now') WHERE id=?`).run(name,category_id,country,logo,epg_id,url_fhd,url_hd,url_sd,enabled,sort_order,req.params.id)
    return { ok:true }
  })

  fastify.delete('/admin/channels/:id', async (req) => {
    getDb().prepare(`DELETE FROM channels WHERE id=?`).run(req.params.id)
    return { ok:true }
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
    return { total:channels.length, matched }
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
    fetchM3USource(src).catch(console.error)
    return reply.code(201).send({ id:r.lastInsertRowid, status:'importing' })
  })

  fastify.delete('/admin/sources/m3u/:id', async (req) => {
    getDb().prepare(`DELETE FROM m3u_sources WHERE id=?`).run(req.params.id)
    return { ok:true }
  })

  fastify.post('/admin/sources/m3u/:id/refresh', async (req, reply) => {
    const src = getDb().prepare(`SELECT * FROM m3u_sources WHERE id=?`).get(req.params.id)
    if (!src) return reply.code(404).send({ error:'No encontrada' })
    fetchM3USource(src).catch(console.error)
    return { status:'refreshing' }
  })

  fastify.post('/admin/sources/m3u/import-text', async (req, reply) => {
    const { text, default_cat_id, dedup_mode } = req.body||{}
    if (!text) return reply.code(400).send({ error:'text requerido' })
    return importChannels(parseM3U(text, default_cat_id||null, null), dedup_mode||'name')
  })

  fastify.post('/admin/sources/m3u/refresh-all', async () => {
    refreshAllM3USources().catch(console.error)
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
    return reply.code(201).send({ id:r.lastInsertRowid })
  })

  fastify.put('/admin/categories/:id', async (req) => {
    const { name, icon, sort_order } = req.body||{}
    getDb().prepare(`UPDATE categories SET name=COALESCE(?,name),icon=COALESCE(?,icon),sort_order=COALESCE(?,sort_order) WHERE id=?`).run(name,icon,sort_order,req.params.id)
    return { ok:true }
  })

  fastify.delete('/admin/categories/:id', async (req) => {
    const db = getDb()
    db.prepare(`UPDATE channels SET category_id=NULL WHERE category_id=?`).run(req.params.id)
    db.prepare(`DELETE FROM categories WHERE id=?`).run(req.params.id)
    return { ok:true }
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
    return { total: channels.length, matched }
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
    }).catch(console.error)
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
    }).catch(console.error)
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
    const entry = db.prepare(`SELECT source_id FROM epg_index WHERE epg_id=? LIMIT 1`).get(id)
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
    }).catch(console.error)
    return { status: 'scraping', total: TVPORI_CHANNELS.length }
  })

  fastify.post('/admin/tvpori/scrape-one', async (req, reply) => {
    const { name } = req.body || {}
    if (!name) return reply.code(400).send({ error: 'name requerido' })
    const result = await scrapeTvporiByName(name)
    if (!result.ok) return reply.code(404).send(result)
    return result
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
