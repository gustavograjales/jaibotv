import { getDb } from '../db/schema.js'

export async function checkStream(url, timeout=8000) {
  if (!url) return { status:'no_url', ok:false }
  try {
    const controller = new AbortController()
    const timer = setTimeout(()=>controller.abort(), timeout)
    const res = await fetch(url, {
      method:'HEAD',
      signal:controller.signal,
      headers:{'User-Agent':'VLC/3.0 LibVLC/3.0'},
    })
    clearTimeout(timer)
    const ok = res.status < 400
    return { status:ok?'ok':'error', code:res.status, ok }
  } catch(e) {
    return { status:e.name==='AbortError'?'timeout':'error', ok:false, error:e.message }
  }
}

export async function checkChannel(ch) {
  const results = {}
  if (ch.url_fhd) results.fhd = await checkStream(ch.url_fhd)
  if (ch.url_hd)  results.hd  = await checkStream(ch.url_hd)
  if (ch.url_sd)  results.sd  = await checkStream(ch.url_sd)
  const anyOk = Object.values(results).some(r=>r.ok)
  return { id:ch.id, name:ch.name, streams:results, ok:anyOk }
}

export async function checkAllStreams(onProgress=null) {
  const db = getDb()
  try { db.exec(`ALTER TABLE channels ADD COLUMN stream_status TEXT DEFAULT 'unknown'`) } catch(e) {}
  try { db.exec(`ALTER TABLE channels ADD COLUMN stream_checked_at TEXT`) } catch(e) {}
  const channels = db.prepare(`SELECT id,name,url_fhd,url_hd,url_sd FROM channels WHERE enabled=1`).all()
  const results = []
  let checked = 0
  for (const ch of channels) {
    const result = await checkChannel(ch)
    const status = result.ok?'ok':'error'
    db.prepare(`UPDATE channels SET stream_status=?,stream_checked_at=datetime('now') WHERE id=?`).run(status,ch.id)
    results.push(result)
    checked++
    if (onProgress) onProgress({checked,total:channels.length,channel:ch.name,ok:result.ok})
  }
  return results
}

export async function checkChannelById(id) {
  const db = getDb()
  try { db.exec(`ALTER TABLE channels ADD COLUMN stream_status TEXT DEFAULT 'unknown'`) } catch(e) {}
  try { db.exec(`ALTER TABLE channels ADD COLUMN stream_checked_at TEXT`) } catch(e) {}
  const ch = db.prepare(`SELECT * FROM channels WHERE id=?`).get(id)
  if (!ch) return null
  const result = await checkChannel(ch)
  db.prepare(`UPDATE channels SET stream_status=?,stream_checked_at=datetime('now') WHERE id=?`).run(result.ok?'ok':'error',ch.id)
  return result
}

export function streamStats() {
  const db = getDb()
  try {
    return {
      ok:      db.prepare(`SELECT COUNT(*) as n FROM channels WHERE stream_status='ok'`).get()?.n||0,
      error:   db.prepare(`SELECT COUNT(*) as n FROM channels WHERE stream_status='error'`).get()?.n||0,
      unknown: db.prepare(`SELECT COUNT(*) as n FROM channels WHERE stream_status='unknown' OR stream_status IS NULL`).get()?.n||0,
      total:   db.prepare(`SELECT COUNT(*) as n FROM channels WHERE enabled=1`).get()?.n||0,
      last_check: db.prepare(`SELECT MAX(stream_checked_at) as t FROM channels`).get()?.t||null,
    }
  } catch(e) { return {ok:0,error:0,unknown:0,total:0,last_check:null} }
}
