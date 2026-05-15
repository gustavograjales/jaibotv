// src/core/externalId.js — Genera el external_id (anchor estable) de un canal
//
// Formatos soportados:
//   tvpori:{host_slug}:{stream_id}             ej: tvpori:deportes:27
//   tvtv:{stream_param}                        ej: tvtv:abc123xyz
//   m3u:{source_id}:{tvg_id}                   ej: m3u:4:Discovery.us       (preparado, sin uso aún)
//   m3u:{source_id}:url:{sha1_8}               ej: m3u:4:url:a1b2c3d4       (preparado, sin uso aún)
//   manual:{nanoid8}                           (reservado)
//
// Diseño: el external_id es estable ante cambios de nombre del canal.

import { createHash } from 'node:crypto'

function hostSlug(host) {
  if (!host) return null
  return host.split('.')[0].toLowerCase()
}

function normalizeUrl(url) {
  if (!url) return ''
  try {
    const u = new URL(url)
    return `${u.protocol}//${u.host.toLowerCase()}${u.pathname}`.replace(/\/$/, '')
  } catch {
    return String(url).trim().toLowerCase()
  }
}

function sha1_8(str) {
  return createHash('sha1').update(str).digest('hex').slice(0, 8)
}

export function computeExternalId(channel) {
  if (channel.tvpori_host && channel.tvpori_stream_id) {
    const slug = hostSlug(channel.tvpori_host)
    return `tvpori:${slug}:${channel.tvpori_stream_id}`
  }

  if (channel.stream_param && !channel.source_id && !channel.tvpori_host) {
    return `tvtv:${channel.stream_param}`
  }

  const tvg = channel.tvg_id || channel.epg_id
  if (channel.source_id && tvg) {
    return `m3u:${channel.source_id}:${tvg}`
  }

  if (channel.source_id && channel.url) {
    return `m3u:${channel.source_id}:url:${sha1_8(normalizeUrl(channel.url))}`
  }

  return null
}
