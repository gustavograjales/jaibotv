import cron from 'node-cron'
import { refreshAllM3USources } from './aggregator.js'
import { refreshAllEpgSources } from './epgEngine.js'
import config from '../../config.js'

export function startScheduler() {
  if (!config.scheduler.enabled) return
  cron.schedule(config.scheduler.m3uCron, async () => {
    console.log('⏰ Actualizando fuentes M3U...')
    await refreshAllM3USources()
  }, { timezone: 'America/Mexico_City' })
  cron.schedule(config.scheduler.epgCron, async () => {
    console.log('⏰ Actualizando fuentes EPG...')
    await refreshAllEpgSources()
  }, { timezone: 'America/Mexico_City' })
  console.log('⏰ Scheduler iniciado')
}

// Importar scraper
import { scrapeAllTvtvChannels } from './tvtvScraper.js'

// Renovar URLs tvtvhd cada 4 horas
cron.schedule('0 */4 * * *', async () => {
  console.log('⏰ Renovando URLs tvtvhd...')
  await scrapeAllTvtvChannels()
}, { timezone: 'America/Mexico_City' })
