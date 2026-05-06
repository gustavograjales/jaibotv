import { XMLParser } from 'fast-xml-parser'
import { writeFileSync, readFileSync, readdirSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import got from 'got'
import Fuse from 'fuse.js'
import { getDb } from '../db/schema.js'
import config from '../../config.js'

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: (name) => ['channel','programme','display-name','icon'].includes(name),
  processEntities: false,
})

let _fuse = null

export async function fetchEpgSource(source) {
  const db = getDb()
  const start = Date.now()
  db.prepare(`UPDATE epg_sources SET status='loading' WHERE id=?`).run(source.id)
  try {
    console.log(`📅 Descargando EPG: ${source.name}`)
    const response = await got(source.url, {
      timeout: { request: config.http.timeout },
      retry: { limit: config.http.retries },
    })
    const xml = response.body
    mkdirSync(config.cache.epgDir, { recursive: true })
    writeFileSync(join(config.cache.epgDir, `epg_${source.id}.xml`), xml, 'utf8')
    const channels = parseXMLTVChannels(xml, source.name)
    const del = db.prepare(`DELETE FROM epg_index WHERE source_id=?`)
    const ins = db.prepare(`INSERT INTO epg_index (epg_id,name,name_lower,icon,lang,source_id,source_name) VALUES (@epg_id,@name,@name_lower,@icon,@lang,@source_id,@source_name)`)
    db.transaction(() => {
      del.run(source.id)
      for (const ch of channels) ins.run({...ch, source_id: source.id})
    })()
    db.prepare(`UPDATE epg_sources SET status='ok',channel_count=?,last_fetched=datetime('now'),last_error=NULL WHERE id=?`).run(channels.length, source.id)
    db.prepare(`INSERT INTO refresh_log (type,source_id,status,message,duration_ms) VALUES ('epg',?,?,?,?)`).run(source.id,'ok',`${channels.length} canales`,Date.now()-start)
    console.log(`✅ EPG ${source.name}: ${channels.length} canales`)
    rebuildFuseIndex()
    return { ok: true, count: channels.length }
  } catch(err) {
    const msg = err.message||String(err)
    db.prepare(`UPDATE epg_sources SET status='error',last_error=? WHERE id=?`).run(msg, source.id)
    db.prepare(`INSERT INTO refresh_log (type,source_id,status,message,duration_ms) VALUES ('epg',?,?,?,?)`).run(source.id,'error',msg,Date.now()-start)
    console.error(`❌ EPG ${source.name}: ${msg}`)
    const cacheFile = join(config.cache.epgDir, `epg_${source.id}.xml`)
    if (existsSync(cacheFile)) {
      const channels = parseXMLTVChannels(readFileSync(cacheFile,'utf8'), source.name)
      return { ok: false, count: channels.length, fromCache: true }
    }
    return { ok: false, count: 0, error: msg }
  }
}

function parseXMLTVChannels(xml, sourceName) {
  try {
    const parsed = parser.parse(xml)
    const rawChannels = parsed?.tv?.channel || parsed?.TV?.channel || []
    return rawChannels.map(ch => {
      const epgId = ch['@_id']||''
      if (!epgId) return null
      const names = Array.isArray(ch['display-name']) ? ch['display-name'] : ch['display-name'] ? [ch['display-name']] : []
      const firstName = names.find(n=>typeof n==='string') || names.find(n=>n?.['#text'])?.['#text'] || epgId
      const lang = names.find(n=>n?.['@_lang'])?.['@_lang']||''
      const icons = ch?.icon||[]
      const icon = (Array.isArray(icons)?icons:[icons])[0]?.['@_src']||''
      return { epg_id: epgId, name: String(firstName).trim(), name_lower: String(firstName).trim().toLowerCase(), icon, lang, source_name: sourceName }
    }).filter(Boolean)
  } catch(err) {
    console.error('Error parseando XMLTV:', err.message)
    return []
  }
}

export function rebuildFuseIndex() {
  const db = getDb()
  const entries = db.prepare(`SELECT epg_id,name,name_lower,icon,lang,source_name FROM epg_index`).all()
  _fuse = new Fuse(entries, { keys:['name','epg_id'], threshold:0.4, includeScore:true, minMatchCharLength:2 })
  console.log(`🔍 EPG index: ${entries.length} entradas`)
  return entries.length
}

export function searchEpgIds(query, limit=20) {
  if (!query||query.length<2) return []
  const db = getDb()
  const exact = db.prepare(`
    SELECT epg_id,name,icon,lang,source_name,
    CASE WHEN name_lower=? THEN 1.0 WHEN name_lower LIKE ? THEN 0.8 ELSE 0.5 END as score
    FROM epg_index WHERE name_lower LIKE ? LIMIT ?
  `).all(query.toLowerCase(), `${query.toLowerCase()}%`, `%${query.toLowerCase()}%`, limit)
  if (exact.length>0) return exact
  if (!_fuse) rebuildFuseIndex()
  if (!_fuse) return []
  return _fuse.search(query,{limit}).map(r=>({
    epg_id: r.item.epg_id, name: r.item.name, icon: r.item.icon,
    lang: r.item.lang, source_name: r.item.source_name,
    score: Math.round((1-(r.score||0))*100)/100,
  }))
}

export function autoMatchEpgId(channelName) {
  const results = searchEpgIds(channelName, 5)
  if (!results.length) return null
  const best = results[0]
  return { epg_id: best.epg_id, name: best.name, icon: best.icon, source_name: best.source_name, confidence: Math.round((best.score||0)*100) }
}


export function generateConsolidatedEPG() {
  const db = getDb()

  const channels = db.prepare(`
    SELECT c.*, cat.name as cat_name
    FROM channels c
    LEFT JOIN categories cat ON c.category_id = cat.id
    WHERE c.epg_id != '' AND c.enabled = 1
  `).all()

  if (!channels.length) return '<tv></tv>'

  // Mapa epg_id → canal (case insensitive)
  const channelMap = {}
  channels.forEach(ch => { channelMap[ch.epg_id.toLowerCase()] = ch })

  const cacheDir = config.cache.epgDir
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE tv SYSTEM "xmltv.dtd">',
    '<tv generator-info-name="JaiboTV">',
  ]

  // Definiciones de canales
  channels.forEach(ch => {
    lines.push(`  <channel id="${esc(ch.epg_id)}">`)
    lines.push(`    <display-name lang="es">${esc(ch.name)}</display-name>`)
    if (ch.logo) lines.push(`    <icon src="${esc(ch.logo)}" />`)
    lines.push(`  </channel>`)
  })

  // Extraer programas, deduplicando por (channel_id, start) → gana mayor prioridad / más reciente
  const programmesByKey = new Map() // key: "channel|start" → { block, sourceFile }
  if (existsSync(cacheDir)) {
    let files = []
    try { files = readdirSync(cacheDir).filter(f => f.endsWith('.xml')) } catch(e) {}

    // Mapa de prioridades por archivo de cache (epg_<id>.xml → priority)
    const sourcePriorityRows = db.prepare(`SELECT id, COALESCE(priority,50) as priority, last_fetched FROM epg_sources WHERE enabled=1`).all()
    const sourcePriority = {}
    sourcePriorityRows.forEach(r => { sourcePriority[`epg_${r.id}.xml`] = { priority: r.priority, last_fetched: r.last_fetched || '' } })

    // Ordenar archivos por prioridad asc, last_fetched desc (mejor primero)
    files.sort((a, b) => {
      const pa = sourcePriority[a] || { priority: 999, last_fetched: '' }
      const pb = sourcePriority[b] || { priority: 999, last_fetched: '' }
      if (pa.priority !== pb.priority) return pa.priority - pb.priority
      return pb.last_fetched.localeCompare(pa.last_fetched)
    })

    for (const file of files) {
      try {
        const xml = readFileSync(join(cacheDir, file), 'utf8')
        const progRegex = /<programme\s[^>]*>[\s\S]*?<\/programme>/g
        let match
        while ((match = progRegex.exec(xml)) !== null) {
          const block = match[0]
          const channelMatch = block.match(/channel="([^"]+)"/)
          const startMatch = block.match(/start="([^"]+)"/)
          if (!channelMatch || !startMatch) continue
          const channelId = channelMatch[1].toLowerCase()
          const start = startMatch[1]
          if (!channelMap[channelId]) continue
          const key = `${channelId}|${start}`
          // Solo agregar si no existe (la primera fuente que llegue gana = mayor prioridad)
          if (!programmesByKey.has(key)) programmesByKey.set(key, block)
        }
      } catch(e) { /* skip archivo */ }
    }
  }
  for (const block of programmesByKey.values()) lines.push('  ' + block)

  lines.push('</tv>')
  return lines.join('\n')
}

export async function refreshAllEpgSources() {
  const db = getDb()
  const sources = db.prepare(`SELECT * FROM epg_sources WHERE enabled=1`).all()
  const results = []
  for (const src of sources) results.push(await fetchEpgSource(src))
  rebuildFuseIndex()
  return results
}

function xDate(d) {
  return d.getFullYear()+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0')+String(d.getHours()).padStart(2,'0')+'0000 +0000'
}
function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}
