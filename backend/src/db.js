const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const DB_PATH = path.join(DB_DIR, 'crawler.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function run(sql, params = []) {
  return Promise.resolve().then(() => {
    const stmt = db.prepare(sql);
    const result =
      params && !Array.isArray(params) && typeof params === 'object'
        ? stmt.run(params)
        : stmt.run(...params);
    return {
      lastID: Number(result.lastInsertRowid ?? 0),
      changes: result.changes ?? 0,
    };
  });
}

function get(sql, params = []) {
  return Promise.resolve().then(() => {
    const stmt = db.prepare(sql);
    return params && !Array.isArray(params) && typeof params === 'object'
      ? stmt.get(params)
      : stmt.get(...params);
  });
}

function all(sql, params = []) {
  return Promise.resolve().then(() => {
    const stmt = db.prepare(sql);
    return params && !Array.isArray(params) && typeof params === 'object'
      ? stmt.all(params)
      : stmt.all(...params);
  });
}

function exec(sql) {
  return Promise.resolve().then(() => {
    db.exec(sql);
  });
}

// Initialize schema
const ready = exec(`
  CREATE TABLE IF NOT EXISTS threads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT UNIQUE NOT NULL,
    thread_id TEXT NOT NULL DEFAULT '',
    title TEXT,
    page_count INTEGER DEFAULT 1,
    status TEXT DEFAULT 'pending',
    crawled_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    thread_id INTEGER NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    post_id TEXT,
    author TEXT,
    content TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(thread_id, post_id)
  );

  CREATE TABLE IF NOT EXISTS media (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    thread_id INTEGER NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('image','video')),
    thumbnail TEXT,
    platform TEXT,
    video_id TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(thread_id, url)
  );

  CREATE INDEX IF NOT EXISTS idx_media_type ON media(type);
  CREATE INDEX IF NOT EXISTS idx_media_thread ON media(thread_id);
  CREATE INDEX IF NOT EXISTS idx_media_url ON media(url);
  CREATE INDEX IF NOT EXISTS idx_threads_status ON threads(status);
`);

module.exports = { db, run, get, all, exec, ready };
