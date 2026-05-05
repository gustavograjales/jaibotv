// Helpers para tabla system_state (key-value genérica).
// Valores se serializan como JSON para soportar cualquier tipo.

import { getDb } from '../db/schema.js'

export function getState(key) {
  const row = getDb().prepare(`SELECT value FROM system_state WHERE key=?`).get(key)
  if (!row) return null
  try { return JSON.parse(row.value) } catch { return row.value }
}

export function setState(key, value) {
  const json = JSON.stringify(value)
  const ts = Date.now()
  getDb().prepare(`
    INSERT INTO system_state (key, value, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at
  `).run(key, json, ts)
}

export function getStateMeta(key) {
  const row = getDb().prepare(`SELECT value, updated_at FROM system_state WHERE key=?`).get(key)
  if (!row) return null
  let value
  try { value = JSON.parse(row.value) } catch { value = row.value }
  return { value, updated_at: row.updated_at }
}
