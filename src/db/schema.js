import Database from 'better-sqlite3'
import { mkdirSync } from 'fs'
import { dirname } from 'path'
import config from '../../config.js'

let _db = null

export function getDb() {
  if (_db) return _db
  mkdirSync(dirname(config.db.path), { recursive: true })
  _db = new Database(config.db.path)
  _db.pragma('journal_mode = WAL')
  _db.pragma('foreign_keys = ON')
  runMigrations(_db)
  return _db
}

function runMigrations(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL UNIQUE,
      icon       TEXT DEFAULT '📺',
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS m3u_sources (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      name           TEXT NOT NULL,
      url            TEXT DEFAULT '',
      content        TEXT DEFAULT '',
      default_cat_id INTEGER REFERENCES categories(id),
      dedup_mode     TEXT DEFAULT 'name',
      enabled        INTEGER DEFAULT 1,
      status         TEXT DEFAULT 'pending',
      channel_count  INTEGER DEFAULT 0,
      last_fetched   TEXT,
      last_error     TEXT,
      created_at     TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS channels (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      country     TEXT DEFAULT '',
      logo        TEXT DEFAULT '',
      epg_id      TEXT DEFAULT '',
      url_fhd     TEXT DEFAULT '',
      url_hd      TEXT DEFAULT '',
      url_sd      TEXT DEFAULT '',
      stream_id   INTEGER,
      enabled     INTEGER DEFAULT 1,
      sort_order  INTEGER DEFAULT 0,
      source_id   INTEGER REFERENCES m3u_sources(id) ON DELETE SET NULL,
      created_at  TEXT DEFAULT (datetime('now')),
      updated_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS epg_sources (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT NOT NULL,
      url           TEXT NOT NULL UNIQUE,
      country       TEXT DEFAULT '',
      enabled       INTEGER DEFAULT 1,
      status        TEXT DEFAULT 'pending',
      channel_count INTEGER DEFAULT 0,
      last_fetched  TEXT,
      last_error    TEXT,
      created_at    TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS epg_index (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      epg_id      TEXT NOT NULL,
      name        TEXT NOT NULL,
      name_lower  TEXT NOT NULL,
      icon        TEXT DEFAULT '',
      lang        TEXT DEFAULT '',
      source_id   INTEGER REFERENCES epg_sources(id) ON DELETE CASCADE,
      source_name TEXT DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS idx_epg_name ON epg_index(name_lower);
    CREATE INDEX IF NOT EXISTS idx_epg_id   ON epg_index(epg_id);

    CREATE TABLE IF NOT EXISTS users (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      username    TEXT NOT NULL UNIQUE,
      password    TEXT NOT NULL,
      token       TEXT NOT NULL UNIQUE,
      plan        TEXT DEFAULT 'basic',
      max_streams INTEGER DEFAULT 1,
      status      TEXT DEFAULT 'active',
      expires_at  TEXT,
      created_at  TEXT DEFAULT (datetime('now')),
      notes       TEXT DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS idx_users_token    ON users(token);
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

    CREATE TABLE IF NOT EXISTS refresh_log (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      type        TEXT,
      source_id   INTEGER,
      status      TEXT,
      message     TEXT,
      duration_ms INTEGER,
      created_at  TEXT DEFAULT (datetime('now'))
    );
  `)
}

export default getDb
