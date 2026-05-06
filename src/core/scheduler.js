import cron from 'node-cron'
import { refreshAllM3USources } from './aggregator.js'
import { refreshAllEpgSources } from './epgEngine.js'
import config from '../../config.js'
import { scrapeAllTvtvChannels } from './tvtvScraper.js'
import { scrapeAllTvporiChannels } from './tvporiScraper.js'
import { invalidateAll as invalidateM3UCache } from './m3uCache.js'
import { checkPublicIp } from './ipMonitor.js'
import { checkAllStreams } from './streamChecker.js'

export function startScheduler() {
  if (!config.scheduler.enabled) return

  cron.schedule(config.scheduler.m3uCron, async () => {
    console.log('[cron] Actualizando fuentes M3U...')
    await refreshAllM3USources()
    invalidateM3UCache('cron m3u refresh')
  }, { timezone: 'America/Mexico_City' })

  cron.schedule(config.scheduler.epgCron, async () => {
    console.log('[cron] Actualizando fuentes EPG...')
    await refreshAllEpgSources()
  }, { timezone: 'America/Mexico_City' })

  // Check inicial de IP al arrancar (no esperar 10 min)
  checkPublicIp().catch(err => console.error('[IPMonitor inicial]', err.message))

  console.log('[scheduler] iniciado')
}

// Renovar URLs tvtvhd cada 4 horas
cron.schedule('0 */4 * * *', async () => {
  console.log('[cron] Renovando URLs tvtvhd...')
  await scrapeAllTvtvChannels()
  invalidateM3UCache('cron tvtv scrape')
}, { timezone: 'America/Mexico_City' })

// Renovar URLs tvporinternet2 cada 3.5 horas (tokens duran ~4h)
cron.schedule('30 */3 * * *', async () => {
  console.log('[cron] Renovando URLs tvporinternet2...')
  await scrapeAllTvporiChannels()
  invalidateM3UCache('cron tvpori scrape')
}, { timezone: 'America/Mexico_City' })

// Monitor de IP publica cada 10 minutos
cron.schedule('*/10 * * * *', async () => {
  await checkPublicIp()
}, { timezone: 'America/Mexico_City' })

// Verificar status de streams cada 6 horas (1AM, 7AM, 1PM, 7PM CST)
cron.schedule('0 */6 * * *', async () => {
  console.log('[cron] Verificando status de streams...')
  try {
    await checkAllStreams()
    console.log('[cron] ✅ Stream check completado')
  } catch(e) {
    console.error('[cron] ❌ Error en stream check:', e.message)
  }
}, { timezone: 'America/Mexico_City' })
