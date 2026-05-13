// src/core/tvporiScraper.js
import { getDb } from '../db/schema.js'
import { Agent, fetch as undiciFetch } from 'undici'

// Agent permisivo para fallback ante certs problemáticos (expirados, self-signed, etc.)
const insecureAgent = new Agent({ connect: { rejectUnauthorized: false } })

export const TVPORI_CHANNELS = [
  // ── DEPORTES
  { scrape_host: 'deportes.ksdjugfsddeports.com', stream_id: '1',  db_name: 'TUDN' },
  { scrape_host: 'deportes.ksdjugfsddeports.com', stream_id: '3',  db_name: 'DirecTV Sports' },
  { scrape_host: 'deportes.ksdjugfsddeports.com', stream_id: '4',  db_name: 'TNT Sports' },
  { scrape_host: 'deportes.ksdjugfsddeports.com', stream_id: '6',  db_name: 'TyC Sports' },
  { scrape_host: 'deportes.ksdjugfsddeports.com', stream_id: '8',  db_name: 'Fox Sports' },
  { scrape_host: 'deportes.ksdjugfsddeports.com', stream_id: '9',  db_name: 'FOX Sports 2' },
  { scrape_host: 'deportes.ksdjugfsddeports.com', stream_id: '10', db_name: 'FOX Sports 3' },
  { scrape_host: 'deportes.ksdjugfsddeports.com', stream_id: '12', db_name: 'Fox Sports Premium' },
  { scrape_host: 'deportes.ksdjugfsddeports.com', stream_id: '13', db_name: 'ESPN' },
  { scrape_host: 'deportes.ksdjugfsddeports.com', stream_id: '14', db_name: 'ESPN 2' },
  { scrape_host: 'deportes.ksdjugfsddeports.com', stream_id: '15', db_name: 'ESPN 3' },
  { scrape_host: 'deportes.ksdjugfsddeports.com', stream_id: '16', db_name: 'FOX Sports MX' },
  { scrape_host: 'deportes.ksdjugfsddeports.com', stream_id: '17', db_name: 'FOX Sports 2 MX' },
  { scrape_host: 'deportes.ksdjugfsddeports.com', stream_id: '19', db_name: 'ESPN MX' },
  { scrape_host: 'deportes.ksdjugfsddeports.com', stream_id: '22', db_name: 'Liga 1 MAX' },
  { scrape_host: 'deportes.ksdjugfsddeports.com', stream_id: '23', db_name: 'ESPN 4' },
  { scrape_host: 'deportes.ksdjugfsddeports.com', stream_id: '24', db_name: 'ESPN 5' },
  { scrape_host: 'deportes.ksdjugfsddeports.com', stream_id: '25', db_name: 'ESPN 6' },
  { scrape_host: 'deportes.ksdjugfsddeports.com', stream_id: '26', db_name: 'ESPN 7' },
  { scrape_host: 'deportes.ksdjugfsddeports.com', stream_id: '27', db_name: 'DAZN F1' },
  { scrape_host: 'deportes.ksdjugfsddeports.com', stream_id: '28', db_name: 'DAZN La Liga' },
  { scrape_host: 'deportes.ksdjugfsddeports.com', stream_id: '29', db_name: 'Movistar Liga' },
  { scrape_host: 'deportes.ksdjugfsddeports.com', stream_id: '30', db_name: 'Win Sports Plus' },
  { scrape_host: 'deportes.ksdjugfsddeports.com', stream_id: '31', db_name: 'Bein Sports Xtra' },
  { scrape_host: 'deportes.ksdjugfsddeports.com', stream_id: '33', db_name: 'ESPN 4 MX' },
  { scrape_host: 'deportes.ksdjugfsddeports.com', stream_id: '34', db_name: 'Azteca Deportes' },
  { scrape_host: 'deportes.ksdjugfsddeports.com', stream_id: '35', db_name: 'TNT Sports Chile' },
  { scrape_host: 'deportes.ksdjugfsddeports.com', stream_id: '38', db_name: 'ESPN 5 MX' },
  { scrape_host: 'deportes.ksdjugfsddeports.com', stream_id: '39', db_name: 'Liga 1' },
  // ── REGIONALES
  { scrape_host: 'regionales.saohgdasregions.fun', stream_id: '1',  db_name: 'Azteca 7' },
  { scrape_host: 'regionales.saohgdasregions.fun', stream_id: '2',  db_name: 'Canal 5' },
  { scrape_host: 'regionales.saohgdasregions.fun', stream_id: '5',  db_name: 'TNT Novelas' },
  { scrape_host: 'regionales.saohgdasregions.fun', stream_id: '9',  db_name: 'Univision' },
  { scrape_host: 'regionales.saohgdasregions.fun', stream_id: '12', db_name: 'TLNovelas' },
  { scrape_host: 'regionales.saohgdasregions.fun', stream_id: '13', db_name: 'Las Estrellas' },
  { scrape_host: 'regionales.saohgdasregions.fun', stream_id: '24', db_name: 'Unicable' },
  { scrape_host: 'regionales.saohgdasregions.fun', stream_id: '25', db_name: 'Imagen TV' },
  { scrape_host: 'regionales.saohgdasregions.fun', stream_id: '26', db_name: 'Azteca Uno' },
  { scrape_host: 'regionales.saohgdasregions.fun', stream_id: '28', db_name: 'Disney Channel' },
  { scrape_host: 'regionales.saohgdasregions.fun', stream_id: '31', db_name: 'Cartoon Network' },
  { scrape_host: 'regionales.saohgdasregions.fun', stream_id: '32', db_name: 'Tooncast' },
  { scrape_host: 'regionales.saohgdasregions.fun', stream_id: '37', db_name: 'Discovery Channel' },
  { scrape_host: 'regionales.saohgdasregions.fun', stream_id: '41', db_name: 'ID Investigation' },
  { scrape_host: 'regionales.saohgdasregions.fun', stream_id: '42', db_name: 'H&H Discovery' },
  { scrape_host: 'regionales.saohgdasregions.fun', stream_id: '43', db_name: 'A&E Discovery' },
  { scrape_host: 'regionales.saohgdasregions.fun', stream_id: '44', db_name: 'History' },
  { scrape_host: 'regionales.saohgdasregions.fun', stream_id: '45', db_name: 'History 2' },
  { scrape_host: 'regionales.saohgdasregions.fun', stream_id: '46', db_name: 'Animal Planet' },
  { scrape_host: 'regionales.saohgdasregions.fun', stream_id: '47', db_name: 'Nat Geo' },
  { scrape_host: 'regionales.saohgdasregions.fun', stream_id: '49', db_name: 'Universal Channel' },
  { scrape_host: 'regionales.saohgdasregions.fun', stream_id: '50', db_name: 'Universal Premiere' },
  { scrape_host: 'regionales.saohgdasregions.fun', stream_id: '51', db_name: 'Universal Cinema' },
  { scrape_host: 'regionales.saohgdasregions.fun', stream_id: '52', db_name: 'TNT' },
  { scrape_host: 'regionales.saohgdasregions.fun', stream_id: '53', db_name: 'TNT Series' },
  { scrape_host: 'regionales.saohgdasregions.fun', stream_id: '54', db_name: 'Star Channel' },
  { scrape_host: 'regionales.saohgdasregions.fun', stream_id: '55', db_name: 'Cinemax' },
  { scrape_host: 'regionales.saohgdasregions.fun', stream_id: '56', db_name: 'Space' },
  { scrape_host: 'regionales.saohgdasregions.fun', stream_id: '58', db_name: 'Warner Channel' },
  { scrape_host: 'regionales.saohgdasregions.fun', stream_id: '59', db_name: 'Cinecanal' },
  { scrape_host: 'regionales.saohgdasregions.fun', stream_id: '60', db_name: 'FX' },
  { scrape_host: 'regionales.saohgdasregions.fun', stream_id: '61', db_name: 'AXN' },
  { scrape_host: 'regionales.saohgdasregions.fun', stream_id: '63', db_name: 'AMC' },
  { scrape_host: 'regionales.saohgdasregions.fun', stream_id: '64', db_name: 'Studio Universal' },
  { scrape_host: 'regionales.saohgdasregions.fun', stream_id: '67', db_name: 'Golden' },
  { scrape_host: 'regionales.saohgdasregions.fun', stream_id: '68', db_name: 'Golden Plus' },
  { scrape_host: 'regionales.saohgdasregions.fun', stream_id: '69', db_name: 'Golden Edge' },
  { scrape_host: 'regionales.saohgdasregions.fun', stream_id: '70', db_name: 'Caras TV' },
  { scrape_host: 'regionales.saohgdasregions.fun', stream_id: '72', db_name: 'Canal Sony' },
  { scrape_host: 'regionales.saohgdasregions.fun', stream_id: '75', db_name: 'Distrito Comedia' },
]

export async function scrapeTvporiChannel(channel, timeout = 12000) {
  const url = `https://${channel.scrape_host}/tvporinternet.php?stream=${channel.stream_id}_`
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)
    const fetchOptions = {
      signal: controller.signal,
      headers: {
        'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36',
        'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-MX,es;q=0.9,en;q=0.8',
        'Referer':         'https://www.tvporinternet2.com/',
      },
    }
    let res
    try {
      res = await fetch(url, fetchOptions)
    } catch (e) {
      // Fallback ante certs TLS problemáticos (expirado, self-signed, no verificable)
      const certErrors = ['CERT_HAS_EXPIRED', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'SELF_SIGNED_CERT_IN_CHAIN', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'CERT_NOT_YET_VALID']
      const code = e.cause?.code || e.code
      if (certErrors.includes(code)) {
        console.warn(`⚠️ [tvpori] Cert TLS problemático en ${channel.scrape_host} (${code}), reintentando con agent permisivo`)
        res = await undiciFetch(url, { ...fetchOptions, dispatcher: insecureAgent })
      } else {
        throw e
      }
    }
    clearTimeout(timer)
    if (!res.ok) return { ok: false, channel: channel.db_name, error: `HTTP ${res.status}` }
    const html = await res.text()
    const match = html.match(/var\s+src\s*=\s*"(https?:[^"]+\.m3u8[^"]+)"/)
    if (!match) return { ok: false, channel: channel.db_name, error: 'var src no encontrada en HTML' }
    const streamUrl = match[1].replace(/\\/g, '')
    const expiresMatch = streamUrl.match(/expires=(\d+)/)
    const expiresAt = expiresMatch ? new Date(parseInt(expiresMatch[1]) * 1000).toISOString() : null
    return { ok: true, channel: channel.db_name, url: streamUrl, expiresAt }
  } catch (e) {
    return { ok: false, channel: channel.db_name, error: e.name === 'AbortError' ? 'timeout' : e.message }
  }
}

export async function scrapeAllTvporiChannels(onProgress = null) {
  const db = getDb()
  try { db.exec(`ALTER TABLE channels ADD COLUMN tvpori_host TEXT DEFAULT ''`) } catch (e) {}
  try { db.exec(`ALTER TABLE channels ADD COLUMN tvpori_stream_id TEXT DEFAULT ''`) } catch (e) {}
  try { db.exec(`ALTER TABLE channels ADD COLUMN tvpori_scraped_at TEXT`) } catch (e) {}
  const results = []
  let updated = 0, failed = 0
  for (const ch of TVPORI_CHANNELS) {
    const result = await scrapeTvporiChannel(ch)
    if (result.ok && result.url) {
      const slug = ch.scrape_host.split('.')[0].toLowerCase()
      const externalId = `tvpori:${slug}:${ch.stream_id}`
      const dbCh = db.prepare(`SELECT id FROM channels WHERE external_id=?`).get(externalId)
      if (dbCh) {
        db.prepare(`UPDATE channels SET url_hd=?, tvpori_host=?, tvpori_stream_id=?, tvpori_scraped_at=datetime('now'), updated_at=datetime('now') WHERE id=?`)
          .run(result.url, ch.scrape_host, ch.stream_id, dbCh.id)
      } else {
        const maxId = db.prepare(`SELECT COALESCE(MAX(stream_id),2000) as m FROM channels`).get()
        const nextStreamId = (maxId?.m || 2000) + 1
        const catName = ch.scrape_host.includes('deportes') ? 'Deportes' : 'General'
        const cat = db.prepare(`SELECT id FROM categories WHERE name=?`).get(catName)
        db.prepare(`INSERT INTO channels (name, category_id, url_hd, tvpori_host, tvpori_stream_id, tvpori_scraped_at, stream_id, enabled, external_id) VALUES (?,?,?,?,?,datetime('now'),?,1,?)`)
          .run(ch.db_name, cat?.id || null, result.url, ch.scrape_host, ch.stream_id, nextStreamId, externalId)
      }
      updated++
    } else {
      failed++
    }
    results.push(result)
    if (onProgress) onProgress({ checked: results.length, total: TVPORI_CHANNELS.length, channel: ch.db_name, ok: result.ok })
    await new Promise(r => setTimeout(r, 1200))
  }
  console.log(`✅ tvpori scrape: ${updated} actualizados, ${failed} fallidos de ${TVPORI_CHANNELS.length}`)
  return results
}

export async function scrapeTvporiByName(dbName) {
  const ch = TVPORI_CHANNELS.find(c => c.db_name.toLowerCase() === dbName.toLowerCase())
  if (!ch) return { ok: false, error: `Canal "${dbName}" no está en el catálogo tvpori` }
  const result = await scrapeTvporiChannel(ch)
  if (result.ok && result.url) {
    const db = getDb()
    const slug = ch.scrape_host.split('.')[0].toLowerCase()
    const externalId = `tvpori:${slug}:${ch.stream_id}`
    const dbCh = db.prepare(`SELECT id FROM channels WHERE external_id=?`).get(externalId)
    if (dbCh) db.prepare(`UPDATE channels SET url_hd=?, tvpori_scraped_at=datetime('now'), updated_at=datetime('now') WHERE id=?`).run(result.url, dbCh.id)
  }
  return result
}
