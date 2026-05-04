import { getDb } from './schema.js'
import config from '../../config.js'
import { randomBytes } from 'crypto'

const db = getDb()

const categories = [
  { name: 'Noticias',        icon: '📰', sort_order: 1 },
  { name: 'Deportes',        icon: '⚽', sort_order: 2 },
  { name: 'Entretenimiento', icon: '🎭', sort_order: 3 },
  { name: 'Películas',       icon: '🎬', sort_order: 4 },
  { name: 'Series',          icon: '📺', sort_order: 5 },
  { name: 'Infantil',        icon: '🧸', sort_order: 6 },
  { name: 'Documentales',    icon: '🎥', sort_order: 7 },
  { name: 'Música',          icon: '🎵', sort_order: 8 },
  { name: 'Internacionales', icon: '🌍', sort_order: 9 },
  { name: 'General',         icon: '📡', sort_order: 10 },
]

const insertCat = db.prepare(`INSERT OR IGNORE INTO categories (name, icon, sort_order) VALUES (@name, @icon, @sort_order)`)
for (const cat of categories) insertCat.run(cat)
console.log('✅ Categorías creadas')

const adminToken = randomBytes(16).toString('hex')
const existing = db.prepare(`SELECT id FROM users WHERE username = ?`).get('admin')
if (!existing) {
  db.prepare(`INSERT INTO users (username, password, token, plan, max_streams, status) VALUES (?, ?, ?, 'admin', 99, 'active')`)
    .run(config.admin.username, config.admin.password, adminToken)
  console.log(`✅ Admin creado — usuario: ${config.admin.username} | pass: ${config.admin.password} | token: ${adminToken}`)
} else {
  console.log('ℹ️  Admin ya existe')
}

const insertEpg = db.prepare(`INSERT OR IGNORE INTO epg_sources (name, url, country, enabled) VALUES (@name, @url, @country, @enabled)`)
for (const src of config.defaultEpgSources) {
  insertEpg.run({ name: src.name, url: src.url, country: src.country, enabled: src.enabled ? 1 : 0 })
}
console.log('✅ Fuentes EPG agregadas')
console.log('\n🚀 Seed completado — inicia con: npm run dev\n')
