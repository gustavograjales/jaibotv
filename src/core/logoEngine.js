// src/core/logoEngine.js — motor de logos desde tv-logo/tv-logos
import got from 'got'
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import Fuse from 'fuse.js'

const GITHUB_API  = 'https://api.github.com/repos/tv-logo/tv-logos/contents/countries'
const RAW_BASE    = 'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries'
const CACHE_FILE  = './data/logo-index.json'
const CACHE_DIR   = './data'

// Países a indexar (priorizando LATAM + relevantes)
const COUNTRIES = [
  'mexico','spain','argentina','colombia','chile','venezuela','peru',
  'brazil','ecuador','uruguay','paraguay','bolivia','costa-rica',
  'united-states','united-kingdom','canada','france','germany','italy',
  'portugal','netherlands','international','world-latin-america','world-europe'
]

let _index  = []   // [{name, country, url, slug}]
let _fuse   = null

// ─── CONSTRUIR ÍNDICE DESDE GITHUB API ───────────────────────────────────────
export async function buildLogoIndex(force = false) {
  // Usar cache si existe y no es forzado
  if (!force && existsSync(CACHE_FILE)) {
    try {
      _index = JSON.parse(readFileSync(CACHE_FILE, 'utf8'))
      buildFuse()
      console.log(`🖼️  Logo index cargado desde cache: ${_index.length} logos`)
      return _index.length
    } catch(e) {}
  }

  console.log('🖼️  Construyendo índice de logos...')
  const results = []

  for (const country of COUNTRIES) {
    try {
      const res = await got(`${GITHUB_API}/${country}`, {
        headers: { 'User-Agent': 'JaiboTV-Server' },
        timeout: { request: 15000 },
      })
      const files = JSON.parse(res.body)
      if (!Array.isArray(files)) continue

      for (const file of files) {
        if (!file.name.endsWith('.png') && !file.name.endsWith('.svg')) continue
        if (file.name.startsWith('0_')) continue // saltar mosaicos

        // Convertir slug a nombre legible
        // ej: "canal-5-mx.png" → "Canal 5"
        const slug    = file.name.replace(/\.(png|svg)$/, '')
        const suffix  = `-${country.slice(0,2)}` // ej: -mx, -us
        const cleaned = slug
          .replace(/-[a-z]{2}$/, '')   // quitar sufijo país
          .replace(/-hz$/, '')          // quitar -hz (horizontal)
          .replace(/-/g, ' ')           // guiones → espacios
          .trim()
        const name = cleaned.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

        results.push({
          slug,
          name,
          name_lower: name.toLowerCase(),
          country,
          url: `${RAW_BASE}/${country}/${file.name}`,
        })
      }
      console.log(`  ✅ ${country}: ${files.filter(f=>f.name.endsWith('.png')||f.name.endsWith('.svg')).length} logos`)
    } catch(err) {
      console.error(`  ❌ ${country}: ${err.message}`)
    }
  }

  _index = results
  mkdirSync(CACHE_DIR, { recursive: true })
  writeFileSync(CACHE_FILE, JSON.stringify(results, null, 2))
  buildFuse()
  console.log(`🖼️  Logo index completo: ${results.length} logos`)
  return results.length
}

// ─── FUSE.JS INDEX ────────────────────────────────────────────────────────────
function buildFuse() {
  _fuse = new Fuse(_index, {
    keys: ['name', 'slug'],
    threshold: 0.35,
    includeScore: true,
    minMatchCharLength: 2,
  })
}

// ─── BUSCAR LOGOS POR NOMBRE ──────────────────────────────────────────────────
export function searchLogos(query, limit = 12) {
  if (!query || query.length < 2) return []
  if (!_fuse) { buildFuse(); if (!_fuse) return [] }

  // Búsqueda exacta primero
  const q = query.toLowerCase()
  const exact = _index.filter(l =>
    l.name_lower.includes(q) || l.slug.includes(q.replace(/\s+/g,'-'))
  ).slice(0, limit)

  if (exact.length >= 3) return exact.map(l => ({ ...l, score: 0.9 }))

  // Fuzzy fallback
  return _fuse.search(query, { limit }).map(r => ({
    ...r.item,
    score: Math.round((1 - (r.score || 0)) * 100) / 100,
  }))
}

// ─── AUTO-MATCH: mejor logo para un nombre de canal ──────────────────────────
export function autoMatchLogo(channelName) {
  const results = searchLogos(channelName, 3)
  if (!results.length) return null
  return results[0]
}

// ─── STATS ────────────────────────────────────────────────────────────────────
export function logoStats() {
  const byCountry = {}
  _index.forEach(l => { byCountry[l.country] = (byCountry[l.country] || 0) + 1 })
  return {
    total: _index.length,
    countries: Object.entries(byCountry)
      .sort((a,b) => b[1]-a[1])
      .map(([country, count]) => ({ country, count }))
  }
}
