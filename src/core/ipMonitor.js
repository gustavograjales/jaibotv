// Monitor de IP pública con cadena de fallback.
// Si la IP cambia, dispara scrapeAllTvtvChannels() automáticamente.

import { getState, setState, getStateMeta } from './systemState.js'
import { scrapeAllTvtvChannels } from './tvtvScraper.js'
import { invalidateAll as invalidateM3UCache } from './m3uCache.js'

const IP_PROVIDERS = [
  'https://api.ipify.org',
  'https://ifconfig.me/ip',
  'https://icanhazip.com'
]

const MAX_HISTORY = 10

async function fetchIp(url, timeoutMs = 5000) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'JaiboTV-IPMonitor/1.0' } })
    if (!res.ok) return null
    const txt = (await res.text()).trim()
    if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(txt)) return null
    return txt
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
}

export async function getCurrentPublicIp() {
  for (const url of IP_PROVIDERS) {
    const ip = await fetchIp(url)
    if (ip) return { ip, provider: url }
  }
  return null
}

export async function checkPublicIp() {
  const result = await getCurrentPublicIp()
  if (!result) {
    console.warn('⚠️  IPMonitor: ningún proveedor respondió, skip')
    return { ok: false, error: 'all_providers_failed' }
  }

  const { ip: newIp, provider } = result
  const prevIp = getState('public_ip')
  const ts = Date.now()

  if (!prevIp) {
    setState('public_ip', newIp)
    setState('public_ip_history', [{ ip: newIp, ts, event: 'baseline', provider }])
    console.log(`📡 IPMonitor: baseline establecida → ${newIp} (${provider})`)
    return { ok: true, ip: newIp, changed: false, baseline: true }
  }

  if (prevIp === newIp) {
    setState('public_ip_last_check', ts)
    return { ok: true, ip: newIp, changed: false }
  }

  console.log(`🔄 IPMonitor: IP cambió ${prevIp} → ${newIp} (${provider})`)
  setState('public_ip', newIp)
  setState('public_ip_last_check', ts)

  const history = getState('public_ip_history') || []
  history.push({ ip: newIp, prev: prevIp, ts, event: 'changed', provider })
  while (history.length > MAX_HISTORY) history.shift()
  setState('public_ip_history', history)

  try {
    console.log('🔄 IPMonitor: disparando scrapeAllTvtvChannels() por cambio de IP...')
    await scrapeAllTvtvChannels()
    invalidateM3UCache('public IP changed')
    console.log('✅ IPMonitor: re-scrape completado')
  } catch (err) {
    console.error('❌ IPMonitor: falló re-scrape automático:', err.message)
  }

  return { ok: true, ip: newIp, prev: prevIp, changed: true }
}

export function getIpStatus() {
  const ipMeta = getStateMeta('public_ip')
  const lastCheckMeta = getStateMeta('public_ip_last_check')
  const history = getState('public_ip_history') || []
  return {
    current_ip: ipMeta?.value || null,
    ip_set_at: ipMeta?.updated_at || null,
    last_check: lastCheckMeta?.value || lastCheckMeta?.updated_at || null,
    history
  }
}
