import { getDb } from '../db/schema.js'

// Códigos HTTP que consideramos "stream válido"
const OK_CODES = new Set([200, 206])

/**
 * Verifica un stream con GET + Range header (más confiable que HEAD).
 * Reintenta 1 vez con 1.5s de backoff si el primer intento falla.
 */
export async function checkStream(url, timeout = 8000, isRetry = false) {
  if (!url) return { status: 'no_url', ok: false }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)

  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Range': 'bytes=0-1',
        // NO Referer: tvporinternet2 bloquea con Referer del propio sitio
      },
    })
    clearTimeout(timer)

    // Cancelar el body inmediatamente para no descargar el stream completo
    try { await res.body?.cancel() } catch(_) {}

    const ok = OK_CODES.has(res.status)
    return { status: ok ? 'ok' : 'error', code: res.status, ok }
  } catch(e) {
    clearTimeout(timer)
    const reason = e.name === 'AbortError' ? 'timeout' : 'error'

    // Reintentar UNA vez con backoff (mitiga primer request "frío")
    if (!isRetry) {
      await new Promise(r => setTimeout(r, 1500))
      return checkStream(url, timeout, true)
    }

    return { status: reason, ok: false, error: e.message }
  }
}

export async function checkChannel(ch) {
  const results = {}
  if (ch.url_fhd) results.fhd = await checkStream(ch.url_fhd)
  if (ch.url_hd)  results.hd  = await checkStream(ch.url_hd)
  if (ch.url_sd)  results.sd  = await checkStream(ch.url_sd)
  const anyOk = Object.values(results).some(r => r.ok)
  return { id: ch.id, name: ch.name, streams: results, ok: anyOk }
}

export async function checkAllStreams(onProgress = null) {
  const db = getDb()
  try { db.exec(`ALTER TABLE channels ADD COLUMN stream_status TEXT DEFAULT 'unknown'`) } catch(e) {}
  try { db.exec(`ALTER TABLE channels ADD COLUMN stream_checked_at TEXT`) } catch(e) {}

  const channels = db.prepare(`SELECT id, name, url_fhd, url_hd, url_sd FROM channels WHERE enabled=1`).all()
  const results = []
  let checked = 0

  for (const ch of channels) {
    const result = await checkChannel(ch)
    const status = result.ok ? 'ok' : 'error'
    db.prepare(`UPDATE channels SET stream_status=?, stream_checked_at=datetime('now') WHERE id=?`).run(status, ch.id)
    results.push(result)
    checked++
    if (onProgress) onProgress({ checked, total: channels.length, channel: ch.name, ok: result.ok })
    await new Promise(r => setTimeout(r, 300))
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
  db.prepare(`UPDATE channels SET stream_status=?, stream_checked_at=datetime('now') WHERE id=?`).run(result.ok ? 'ok' : 'error', ch.id)
  return result
}

export function streamStats() {
  const db = getDb()
  try {
    return {
      ok:      db.prepare(`SELECT COUNT(*) as n FROM channels WHERE stream_status='ok'`).get()?.n || 0,
      error:   db.prepare(`SELECT COUNT(*) as n FROM channels WHERE stream_status='error'`).get()?.n || 0,
      unknown: db.prepare(`SELECT COUNT(*) as n FROM channels WHERE stream_status='unknown' OR stream_status IS NULL`).get()?.n || 0,
      total:   db.prepare(`SELECT COUNT(*) as n FROM channels WHERE enabled=1`).get()?.n || 0,
      last_check: db.prepare(`SELECT MAX(stream_checked_at) as t FROM channels`).get()?.t || null,
    }
  } catch(e) {
    return { ok: 0, error: 0, unknown: 0, total: 0, last_check: null }
  }
}
