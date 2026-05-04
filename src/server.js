import Fastify from 'fastify'
import cors from '@fastify/cors'
import staticFiles from '@fastify/static'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { mkdirSync, existsSync } from 'fs'
import config from '../config.js'
import { getDb } from './db/schema.js'
import { rebuildFuseIndex } from './core/epgEngine.js'
import { buildLogoIndex } from './core/logoEngine.js'
import { startScheduler } from './core/scheduler.js'
import xtreamRoutes from './api/xtream.js'
import adminRoutes from './api/admin.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

mkdirSync('./data/epg-cache', { recursive: true })
mkdirSync('./data/m3u-cache', { recursive: true })
mkdirSync(join(__dirname, 'admin-ui'), { recursive: true })

const fastify = Fastify({
  logger: {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
    },
  },
})

await fastify.register(cors, { origin: true })

// Servir admin panel estático
await fastify.register(staticFiles, {
  root:   join(__dirname, 'admin-ui'),
  prefix: '/admin',
  decorateReply: false,
})

fastify.addContentTypeParser('application/json', { parseAs:'string' }, (req, body, done) => {
  try { done(null, JSON.parse(body)) } catch(e) { done(e) }
})

await fastify.register(xtreamRoutes)
await fastify.register(adminRoutes)

fastify.get('/health', async () => ({
  status:'ok', version:'1.0.0', name:'JaiboTV',
  time: new Date().toISOString()
}))

fastify.get('/server_info.php', async (req) => ({
  server_info: {
    url: `${req.protocol||'http'}://${req.hostname.split(':')[0]}:${config.port}`,
    port: String(config.port), https_port:'443',
    timezone:'America/Mexico_City',
    time_now: new Date().toISOString().replace('T',' ').slice(0,19),
  }
}))

try {
  const db = getDb()
  const users = db.prepare(`SELECT COUNT(*) as n FROM users`).get()?.n||0
  if (users===0) console.log('⚠️  Sin usuarios — ejecuta: npm run seed')
  rebuildFuseIndex()
  buildLogoIndex().catch(console.error)
  startScheduler()
  await fastify.listen({ port: config.port, host: config.host })

  console.log('\n' + '═'.repeat(52))
  console.log(`🚀 JaiboTV corriendo en http://0.0.0.0:${config.port}`)
  console.log('═'.repeat(52))
  console.log(`📺 Xtream:  http://${config.SERVER_IP}:${config.port}`)
  console.log(`🌐 Admin:   http://${config.SERVER_IP}:${config.port}/admin/`)
  console.log(`❤️  Health:  http://${config.SERVER_IP}:${config.port}/health`)
  console.log('═'.repeat(52) + '\n')
} catch(err) {
  fastify.log.error(err)
  process.exit(1)
}
