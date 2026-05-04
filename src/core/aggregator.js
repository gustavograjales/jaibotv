import got from 'got'
import { getDb } from '../db/schema.js'
import config from '../../config.js'

export function parseM3U(text, defaultCatId=null, sourceId=null) {
  const lines = text.split('\n').map(l=>l.trim()).filter(Boolean)
  const result = []
  let i = 0
  while (i<lines.length) {
    if (!lines[i].startsWith('#EXTINF')) { i++; continue }
    const meta = lines[i]
    const url = lines[i+1]&&!lines[i+1].startsWith('#') ? lines[i+1] : null
    if (!url) { i++; continue }
    const rawName = meta.split(',').slice(1).join(',').trim()
    const cleanName = rawName.replace(/\s*\[(FHD|HD|SD)\]$/i,'').trim()
    const tvgId   = (meta.match(/tvg-id="([^"]*)"/)    ||[])[1]||''
    const tvgLogo = (meta.match(/tvg-logo="([^"]*)"/)  ||[])[1]||''
    const group   = (meta.match(/group-title="([^"]*)"/)||[])[1]||''
    const qMeta   = ((meta.match(/tvg-quality="([^"]*)"/)||[])[1]||'').toLowerCase()
    const qBrack  = ((rawName.match(/\[(FHD|HD|SD)\]$/i)||[])[1]||'').toLowerCase()
    result.push({ name: cleanName||tvgId, tvgId, logo: tvgLogo, group, url, quality: qMeta||qBrack||'hd', sourceId, defaultCatId })
    i+=2
  }
  return result
}

function detectQ(quality, url) {
  const q=quality.toLowerCase(), u=url.toLowerCase()
  if (['fhd','1080','fullhd'].some(x=>q.includes(x)||u.includes(x))) return 'fhd'
  if (['hd','720'].some(x=>q.includes(x)||u.includes(x))) return 'hd'
  return 'sd'
}

export function importChannels(parsed, dedupMode='name') {
  const db = getDb()
  let added=0, updated=0
  const catMap = {}
  db.prepare(`SELECT id,name FROM categories`).all().forEach(c=>{ catMap[c.name.toLowerCase()]=c.id })
  const findOrCreateCat = (g) => {
    if (!g) return null
    const key = g.toLowerCase()
    if (catMap[key]) return catMap[key]
    const r = db.prepare(`INSERT OR IGNORE INTO categories (name) VALUES (?)`).run(g)
    const id = r.lastInsertRowid || db.prepare(`SELECT id FROM categories WHERE name=?`).get(g)?.id
    catMap[key]=id
    return id
  }
  const maxId = db.prepare(`SELECT COALESCE(MAX(stream_id),1000) as m FROM channels`).get()
  let nextId = (maxId?.m||1000)+1
  const findByName = db.prepare(`SELECT * FROM channels WHERE LOWER(name)=LOWER(?)`)
  const findByUrl  = db.prepare(`SELECT * FROM channels WHERE url_fhd=? OR url_hd=? OR url_sd=?`)
  const insert = db.prepare(`INSERT INTO channels (name,category_id,logo,epg_id,url_fhd,url_hd,url_sd,stream_id,source_id,updated_at) VALUES (@name,@category_id,@logo,@epg_id,@url_fhd,@url_hd,@url_sd,@stream_id,@source_id,datetime('now'))`)
  const update = db.prepare(`UPDATE channels SET url_fhd=@url_fhd,url_hd=@url_hd,url_sd=@url_sd,logo=CASE WHEN logo='' THEN @logo ELSE logo END,epg_id=CASE WHEN epg_id='' THEN @epg_id ELSE epg_id END,updated_at=datetime('now') WHERE id=@id`)
  db.transaction(()=>{
    for (const ch of parsed) {
      const catId = findOrCreateCat(ch.group)||ch.defaultCatId
      const q = detectQ(ch.quality, ch.url)
      let ex = null
      if (dedupMode==='name'||dedupMode==='both') ex=findByName.get(ch.name)
      if (!ex&&(dedupMode==='url'||dedupMode==='both')) ex=findByUrl.get(ch.url,ch.url,ch.url)
      if (ex) {
        update.run({ id:ex.id, url_fhd:q==='fhd'?ch.url:ex.url_fhd, url_hd:q==='hd'?ch.url:ex.url_hd, url_sd:q==='sd'?ch.url:ex.url_sd, logo:ex.logo||ch.logo, epg_id:ex.epg_id||ch.tvgId })
        updated++
      } else {
        insert.run({ name:ch.name, category_id:catId, logo:ch.logo, epg_id:ch.tvgId, url_fhd:q==='fhd'?ch.url:'', url_hd:q==='hd'?ch.url:'', url_sd:q==='sd'?ch.url:'', stream_id:nextId++, source_id:ch.sourceId })
        added++
      }
    }
  })()
  return { added, updated }
}

export async function fetchM3USource(source) {
  const db = getDb()
  const start = Date.now()
  db.prepare(`UPDATE m3u_sources SET status='loading' WHERE id=?`).run(source.id)
  try {
    let text = source.content||''
    if (source.url) {
      const res = await got(source.url, { timeout:{ request:config.http.timeout }, retry:{ limit:config.http.retries } })
      text = res.body
    }
    if (!text) throw new Error('Sin contenido M3U')
    const parsed = parseM3U(text, source.default_cat_id, source.id)
    const { added, updated } = importChannels(parsed, source.dedup_mode||'name')
    db.prepare(`UPDATE m3u_sources SET status='ok',channel_count=?,last_fetched=datetime('now'),last_error=NULL WHERE id=?`).run(parsed.length, source.id)
    db.prepare(`INSERT INTO refresh_log (type,source_id,status,message,duration_ms) VALUES ('m3u',?,?,?,?)`).run(source.id,'ok',`+${added} nuevos ~${updated} actualizados`,Date.now()-start)
    console.log(`✅ M3U ${source.name}: +${added} nuevos, ~${updated} actualizados`)
    return { ok:true, added, updated }
  } catch(err) {
    const msg = err.message||String(err)
    db.prepare(`UPDATE m3u_sources SET status='error',last_error=? WHERE id=?`).run(msg, source.id)
    console.error(`❌ M3U ${source.name}: ${msg}`)
    return { ok:false, error:msg }
  }
}

export async function refreshAllM3USources() {
  const db = getDb()
  const sources = db.prepare(`SELECT * FROM m3u_sources WHERE enabled=1`).all()
  const results = []
  for (const src of sources) results.push(await fetchM3USource(src))
  return results
}

export function generateM3U(opts={}) {
  const db = getDb()
  const { epgUrl='', catId=null, qualities=['fhd','hd','sd'] } = opts
  let q = `SELECT c.*,cat.name as cat_name FROM channels c LEFT JOIN categories cat ON c.category_id=cat.id WHERE c.enabled=1`
  const params = []
  if (catId) { q+=` AND c.category_id=?`; params.push(catId) }
  q+=` ORDER BY cat.sort_order,c.sort_order,c.name`
  const channels = db.prepare(q).all(...params)
  const lines = [`#EXTM3U x-tvg-url="${epgUrl}" tvg-name="JaiboTV" refresh="604800"`, '']
  for (const ch of channels) {
    const base = `tvg-id="${ch.epg_id||''}" tvg-name="${ch.name}" tvg-logo="${ch.logo||''}" group-title="${ch.cat_name||'General'}"`
    if (qualities.includes('fhd')&&ch.url_fhd) { lines.push(`#EXTINF:-1 ${base} tvg-quality="FHD",${ch.name} [FHD]`); lines.push(ch.url_fhd) }
    if (qualities.includes('hd') &&ch.url_hd)  { lines.push(`#EXTINF:-1 ${base} tvg-quality="HD",${ch.name} [HD]`);  lines.push(ch.url_hd)  }
    if (qualities.includes('sd') &&ch.url_sd)  { lines.push(`#EXTINF:-1 ${base} tvg-quality="SD",${ch.name} [SD]`);  lines.push(ch.url_sd)  }
  }
  return lines.join('\n')
}
