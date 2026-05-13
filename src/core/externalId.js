// src/core/externalId.js — Genera el external_id (anchor estable) de un canal
//
// Formato soportado (Fase 1 — solo tvpori):
//   tvpori:{host_slug}:{stream_id}   ej: tvpori:deportes:27
//
// Diseño: el external_id es estable ante cambios de nombre del canal.
// Los scrapers usan este ID para hacer match (no por nombre) y solo
// actualizan URLs de streaming. Campos como name, epg_id, category_id,
// logo permanecen intactos.
//
// Pendiente (fases siguientes): tvtv, m3u con tvg-id, m3u por hash de URL, manual.

/**
 * Extrae el slug del host: 'deportes.ksdjugfsddeports.com' -> 'deportes'
 */
function hostSlug(host) {
  if (!host) return null
  return host.split('.')[0].toLowerCase()
}

/**
 * Calcula el external_id de un canal basado en sus datos
 *
 * @param {Object} channel - objeto con campos del canal
 * @param {string} channel.tvpori_host - host de tvpori (si aplica)
 * @param {string} channel.tvpori_stream_id - stream_id de tvpori (si aplica)
 * @returns {string|null} external_id calculado, o null si no se puede determinar
 */
export function computeExternalId(channel) {
  // tvpori: usa host slug + stream_id
  if (channel.tvpori_host && channel.tvpori_stream_id) {
    const slug = hostSlug(channel.tvpori_host)
    return `tvpori:${slug}:${channel.tvpori_stream_id}`
  }

  // Si no podemos determinar, retornar null
  return null
}
