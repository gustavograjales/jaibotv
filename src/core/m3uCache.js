// Cache en memoria para M3U generado.
// Key compuesta: ${catId||'all'}:${qualities.sort().join(',')}:${epgUrl}
// TTL: 60s. Invalidacion explicita en eventos (CRUD canales, scrapes, etc.).

const TTL_MS = 60 * 1000

const store = new Map()
const stats = { hits: 0, misses: 0, invalidations: 0, sets: 0 }

function buildKey({ catId, qualities, epgUrl }) {
  const cat = catId || 'all'
  const q = (qualities || ['fhd', 'hd', 'sd']).slice().sort().join(',')
  return `${cat}:${q}:${epgUrl || ''}`
}

export function getCached(opts) {
  const key = buildKey(opts)
  const entry = store.get(key)
  if (!entry) { stats.misses++; return null }
  if (Date.now() - entry.ts > TTL_MS) {
    store.delete(key); stats.misses++; return null
  }
  stats.hits++
  return entry.body
}

export function setCached(opts, body) {
  const key = buildKey(opts)
  store.set(key, { body, ts: Date.now() })
  stats.sets++
}

export function invalidateAll(reason = 'manual') {
  const size = store.size
  store.clear()
  stats.invalidations++
  if (size > 0) console.log(`[M3U cache] invalidado (${size} entradas) - ${reason}`)
}

export function cacheStats() {
  const total = stats.hits + stats.misses
  const hitRate = total > 0 ? ((stats.hits / total) * 100).toFixed(1) + '%' : 'n/a'
  const entries = []
  for (const [key, entry] of store.entries()) {
    entries.push({
      key,
      age_seconds: Math.floor((Date.now() - entry.ts) / 1000),
      size_bytes: Buffer.byteLength(entry.body, 'utf8')
    })
  }
  return { ttl_seconds: TTL_MS / 1000, entries_count: store.size, hit_rate: hitRate, ...stats, entries }
}
