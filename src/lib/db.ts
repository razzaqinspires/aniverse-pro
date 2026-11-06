// Zero-config SQLite database (better-sqlite3, synchronous, file-based).
// All mutations that touch balance use atomic SQL (UPDATE ... WHERE keys > 0) to prevent double-spend.

import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { config } from "./config";

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  const dbPath = path.resolve(config.databasePath);
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  _db = db;
  return db;
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      name TEXT,
      image TEXT,
      is_demo INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS keys_balance (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      keys INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS xp (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      xp_total INTEGER NOT NULL DEFAULT 0,
      level INTEGER NOT NULL DEFAULT 1,
      xp_today INTEGER NOT NULL DEFAULT 0,
      daily_cap_reset INTEGER NOT NULL DEFAULT 0,
      last_heartbeat INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS watch_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      anime_id INTEGER NOT NULL,
      ep INTEGER NOT NULL,
      title TEXT NOT NULL,
      image TEXT NOT NULL,
      progress INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL,
      UNIQUE(user_id, anime_id, ep)
    );
    CREATE TABLE IF NOT EXISTS key_ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      delta INTEGER NOT NULL,
      reason TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ad_watches (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      last_progress INTEGER NOT NULL DEFAULT 0,
      last_heartbeat INTEGER NOT NULL DEFAULT 0,
      total_seconds INTEGER NOT NULL DEFAULT 0,
      completed INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_ledger_user ON key_ledger(user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_history_user ON watch_history(user_id, updated_at DESC);
  `);
}

// ---------- Users ----------
export function getOrCreateUser(
  id: string,
  opts: { email?: string | null; name?: string | null; image?: string | null; isDemo: boolean }
): { id: string; is_demo: number } {
  const db = getDb();
  const now = Date.now();
  const existing = db.prepare("SELECT id, is_demo FROM users WHERE id = ?").get(id) as
    | { id: string; is_demo: number }
    | undefined;
  if (existing) {
    db.prepare(
      "UPDATE users SET email = COALESCE(?, email), name = COALESCE(?, name), image = COALESCE(?, image) WHERE id = ?"
    ).run(opts.email ?? null, opts.name ?? null, opts.image ?? null, id);
    return existing;
  }
  const tx = db.transaction(() => {
    db.prepare(
      "INSERT INTO users (id, email, name, image, is_demo, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(id, opts.email ?? null, opts.name ?? null, opts.image ?? null, opts.isDemo ? 1 : 0, now);
    db.prepare(
      "INSERT INTO keys_balance (user_id, keys, updated_at) VALUES (?, ?, ?)"
    ).run(id, config.startingKeys, now);
    db.prepare(
      "INSERT INTO xp (user_id, xp_total, level, xp_today, daily_cap_reset, last_heartbeat) VALUES (?, 0, 1, 0, ?, 0)"
    ).run(id, nextMidnight());
    db.prepare("INSERT INTO key_ledger (user_id, delta, reason, created_at) VALUES (?, ?, ?, ?)").run(
      id,
      config.startingKeys,
      "initial_balance",
      now
    );
  });
  tx();
  return { id, is_demo: opts.isDemo ? 1 : 0 };
}

export function nextMidnight(now = Date.now()): number {
  const d = new Date(now);
  d.setHours(24, 0, 0, 0);
  return d.getTime();
}
