// src/core/tvtvScraper.js — scraper de playbackURL de tvtvhd.com
import { getDb } from '../db/schema.js'
import { computeExternalId } from './externalId.js'

const BASE_URL = 'https://tvtvhd.com/vivo/canales.php?stream='
const TOKEN_DURATION_MS = 5 * 60 * 60 * 1000  // ~5 horas de margen

// Extraer playbackURL del HTML
function extractPlaybackUrl(html) {
  const match = html.match(/var\s+playbackURL\s*=\s*["']([^"']+)["']/)
  return match ? match[1] : null
}

// Scrape un canal individual
export async function scrapeChannel(streamParam, timeout = 10000) {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)
    const res = await fetch(`${BASE_URL}${streamParam}`, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Referer': 'https://tvtvhd.com/',
      }
    })
    clearTimeout(timer)
    const html = await res.text()
    const url = extractPlaybackUrl(html)
    return { ok: !!url, url, streamParam }
  } catch(e) {
    return { ok: false, url: null, streamParam, error: e.message }
  }
}

// Scrape todos los canales del CSV y actualizar URLs en DB
export async function scrapeAllTvtvChannels(onProgress = null) {
  const db = getDb()

  // Obtener canales que tienen stream_param guardado
  let channels
  try {
    channels = db.prepare(`
      SELECT id, name, stream_param FROM channels 
      WHERE stream_param IS NOT NULL AND stream_param != '' AND enabled=1
    `).all()
  } catch(e) {
    // Agregar columna si no existe
    try { db.exec(`ALTER TABLE channels ADD COLUMN stream_param TEXT DEFAULT ''`) } catch(e2) {}
    try { db.exec(`ALTER TABLE channels ADD COLUMN scraped_url TEXT DEFAULT ''`) } catch(e2) {}
    try { db.exec(`ALTER TABLE channels ADD COLUMN scraped_at TEXT`) } catch(e2) {}
    return []
  }

  if (!channels.length) {
    console.log('⚠️  Sin canales con stream_param. Importa el CSV primero.')
    return []
  }

  const results = []
  let updated = 0

  for (const ch of channels) {
    const result = await scrapeChannel(ch.stream_param)
    if (result.ok && result.url) {
      db.prepare(`
        UPDATE channels SET 
          url_hd = ?,
          scraped_url = ?,
          scraped_at = datetime('now')
        WHERE id = ?
      `).run(result.url, result.url, ch.id)
      // Sincronizar stream_sources con nueva URL
      try {
        db.prepare(`UPDATE stream_sources SET url=?, status="unknown" WHERE channel_id=? AND quality="hd"`).run(result.url, ch.id)
      } catch(e) {}
      updated++
    }
    results.push({ ...result, name: ch.name })
    if (onProgress) onProgress({ 
      checked: results.length, 
      total: channels.length, 
      channel: ch.name, 
      ok: result.ok 
    })
    // Delay para no saturar el servidor
    await new Promise(r => setTimeout(r, 1500))
  }

  console.log(`✅ Scrape completado: ${updated}/${channels.length} URLs actualizadas`)
  return results
}

// Importar CSV de tvtvhd y guardar en DB
export async function importTvtvCsv(csvUrl) {
  const db = getDb()

  // Agregar columnas necesarias
  try { db.exec(`ALTER TABLE channels ADD COLUMN stream_param TEXT DEFAULT ''`) } catch(e) {}
  try { db.exec(`ALTER TABLE channels ADD COLUMN scraped_url TEXT DEFAULT ''`) } catch(e) {}
  try { db.exec(`ALTER TABLE channels ADD COLUMN scraped_at TEXT`) } catch(e) {}

  console.log(`📥 Descargando CSV: ${csvUrl}`)
  const res = await fetch(csvUrl)
  const csv = await res.text()

  const lines = csv.split('\n').filter(Boolean)
  const header = lines[0].split(',')
  const nameIdx   = header.findIndex(h => h.trim().toUpperCase() === 'NOMBRE')
  const paramIdx  = header.findIndex(h => h.trim().toUpperCase() === 'STREAM_PARAM')
  const urlIdx    = header.findIndex(h => h.trim().toUpperCase() === 'URL_COMPLETA')

  let added = 0, updated = 0

  // Buscar o crear categoría Deportes
  let deportesCat = db.prepare(`SELECT id FROM categories WHERE name='Deportes'`).get()
  if (!deportesCat) {
    const r = db.prepare(`INSERT OR IGNORE INTO categories (name, icon) VALUES ('Deportes','⚽')`).run()
    deportesCat = { id: r.lastInsertRowid }
  }

  const maxId = db.prepare(`SELECT COALESCE(MAX(stream_id),1000) as m FROM channels`).get()
  let nextId = (maxId?.m || 1000) + 1

for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',')
    if (cols.length < 2) continue
    const name        = cols[nameIdx]?.trim()
    const streamParam = cols[paramIdx]?.trim()
    const pageUrl     = cols[urlIdx]?.trim()
    if (!name || !streamParam) continue

    const externalId = computeExternalId({ stream_param: streamParam })

    // Match prioritario por external_id; fallback a name solo para canales legacy sin external_id
    const existing =
      db.prepare(`SELECT id FROM channels WHERE external_id=?`).get(externalId) ||
      db.prepare(`SELECT id FROM channels WHERE LOWER(name)=LOWER(?) AND (external_id IS NULL OR external_id='')`).get(name)

    if (existing) {
      db.prepare(`
        UPDATE channels
        SET stream_param=?, external_id=COALESCE(NULLIF(external_id,''), ?), updated_at=datetime('now')
        WHERE id=?
      `).run(streamParam, externalId, existing.id)
      updated++
    } else {
      db.prepare(`
        INSERT INTO channels (name, category_id, stream_param, url_hd, stream_id, enabled, external_id, updated_at)
        VALUES (?, ?, ?, '', ?, 1, ?, datetime('now'))
      `).run(name, deportesCat.id, streamParam, nextId++, externalId)
      added++
    }
  }

  console.log(`✅ CSV importado: +${added} nuevos, ~${updated} actualizados con stream_param`)
  return { added, updated }
}
