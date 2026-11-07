// Shared DDL — identical for SQLite (better-sqlite3) and Turso/libsql (wire-compatible).
// Idempotent (CREATE TABLE IF NOT EXISTS), safe to run on every cold start.

export const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    name TEXT,
    image TEXT,
    is_demo INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS keys_balance (
    user_id TEXT PRIMARY KEY,
    keys INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS xp (
    user_id TEXT PRIMARY KEY,
    xp_total INTEGER NOT NULL DEFAULT 0,
    level INTEGER NOT NULL DEFAULT 1,
    xp_today INTEGER NOT NULL DEFAULT 0,
    daily_cap_reset INTEGER NOT NULL DEFAULT 0,
    last_heartbeat INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS watch_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    anime_id INTEGER NOT NULL,
    ep INTEGER NOT NULL,
    title TEXT NOT NULL,
    image TEXT NOT NULL,
    progress INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL,
    UNIQUE(user_id, anime_id, ep)
  )`,
  `CREATE TABLE IF NOT EXISTS key_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    delta INTEGER NOT NULL,
    reason TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS ad_watches (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    started_at INTEGER NOT NULL,
    last_progress INTEGER NOT NULL DEFAULT 0,
    last_heartbeat INTEGER NOT NULL DEFAULT 0,
    total_seconds INTEGER NOT NULL DEFAULT 0,
    completed INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE INDEX IF NOT EXISTS idx_ledger_user ON key_ledger(user_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_history_user ON watch_history(user_id, updated_at DESC)`,
  // --- v2 tables (auto-migrate, idempotent) ---
  `CREATE TABLE IF NOT EXISTS watchlist (
    user_id TEXT NOT NULL,
    anime_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'plan_to_watch',
    title TEXT NOT NULL DEFAULT '',
    image TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, anime_id)
  )`,
  `CREATE TABLE IF NOT EXISTS ratings (
    user_id TEXT NOT NULL,
    anime_id INTEGER NOT NULL,
    rating INTEGER NOT NULL,
    review_text TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, anime_id)
  )`,
  `CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    anime_id INTEGER NOT NULL,
    ep INTEGER NOT NULL,
    text TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_comments_ep ON comments(anime_id, ep, created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS user_meta (
    user_id TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    PRIMARY KEY (user_id, key)
  )`,
  `CREATE TABLE IF NOT EXISTS download_queue (
    user_id TEXT NOT NULL,
    anime_id INTEGER NOT NULL,
    ep INTEGER NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    image TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, anime_id, ep)
  )`,
];
