// SQLite adapter (better-sqlite3) — default for local/dev. Synchronous under the hood,
// exposed as async to match the adapter contract. On Vercel, if DATABASE_PATH is relative
// or unset, we force /tmp (the only writable location at runtime; ephemeral per instance).

import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { config, nextMidnightFrom } from "../config";
import { SCHEMA_STATEMENTS } from "./schema";
import type {
  StorageAdapter, UserRow, XpRow, HistoryRow, AdWatchRow, UpsertHistoryData, XpPatch,
  WatchlistItem, WatchlistStatus, CommentRow, DownloadQueueItem,
} from "./types";

export function resolveSqlitePath(explicitPath?: string): string {
  const raw = explicitPath || config.databasePath;
  const onVercel = Boolean(process.env.VERCEL || process.env.VERCEL_URL);
  if (onVercel) {
    // Vercel runtime filesystem is read-only except /tmp.
    if (!raw || raw.startsWith("./") || raw.startsWith("data/") || !raw.startsWith("/tmp")) {
      return "/tmp/aniverse-pro.db";
    }
  }
  return path.resolve(raw);
}

export class SqliteAdapter implements StorageAdapter {
  readonly name = "sqlite";
  private db: Database.Database;

  constructor(dbPath?: string) {
    const resolved = resolveSqlitePath(dbPath);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    this.db = new Database(resolved);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    for (const stmt of SCHEMA_STATEMENTS) this.db.exec(stmt);
  }

  /** Escape hatch for tests / raw queries. */
  get raw(): Database.Database {
    return this.db;
  }

  async getOrCreateUser(id: string, opts: { email?: string | null; name?: string | null; image?: string | null; isDemo: boolean }) {
    const now = Date.now();
    const existing = this.db.prepare("SELECT id, is_demo FROM users WHERE id = ?").get(id) as
      | { id: string; is_demo: number } | undefined;
    if (existing) {
      this.db.prepare(
        "UPDATE users SET email = COALESCE(?, email), name = COALESCE(?, name), image = COALESCE(?, image) WHERE id = ?"
      ).run(opts.email ?? null, opts.name ?? null, opts.image ?? null, id);
      return existing;
    }
    const tx = this.db.transaction(() => {
      this.db.prepare(
        "INSERT INTO users (id, email, name, image, is_demo, created_at) VALUES (?, ?, ?, ?, ?, ?)"
      ).run(id, opts.email ?? null, opts.name ?? null, opts.image ?? null, opts.isDemo ? 1 : 0, now);
      this.db.prepare("INSERT INTO keys_balance (user_id, keys, updated_at) VALUES (?, ?, ?)").run(
        id, config.startingKeys, now
      );
      this.db.prepare(
        "INSERT INTO xp (user_id, xp_total, level, xp_today, daily_cap_reset, last_heartbeat) VALUES (?, 0, 1, 0, ?, 0)"
      ).run(id, nextMidnightFrom(now));
      this.db.prepare("INSERT INTO key_ledger (user_id, delta, reason, created_at) VALUES (?, ?, ?, ?)").run(
        id, config.startingKeys, "initial_balance", now
      );
    });
    tx();
    return { id, is_demo: opts.isDemo ? 1 : 0 };
  }

  async getUser(userId: string): Promise<UserRow | null> {
    return (this.db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as UserRow) ?? null;
  }

  async getKeys(userId: string): Promise<number> {
    const row = this.db.prepare("SELECT keys FROM keys_balance WHERE user_id = ?").get(userId) as
      | { keys: number } | undefined;
    return row?.keys ?? 0;
  }

  async spendKey(userId: string, reason: string): Promise<boolean> {
    const now = Date.now();
    const tx = this.db.transaction(() => {
      const res = this.db
        .prepare("UPDATE keys_balance SET keys = keys - 1, updated_at = ? WHERE user_id = ? AND keys > 0")
        .run(now, userId);
      if (res.changes !== 1) return false;
      this.db.prepare("INSERT INTO key_ledger (user_id, delta, reason, created_at) VALUES (?, -1, ?, ?)").run(
        userId, reason, now
      );
      return true;
    });
    return tx();
  }

  async grantKeys(userId: string, amount: number, reason: string): Promise<number> {
    const now = Date.now();
    const tx = this.db.transaction(() => {
      this.db.prepare("UPDATE keys_balance SET keys = keys + ?, updated_at = ? WHERE user_id = ?").run(amount, now, userId);
      this.db.prepare("INSERT INTO key_ledger (user_id, delta, reason, created_at) VALUES (?, ?, ?, ?)").run(
        userId, amount, reason, now
      );
      const row = this.db.prepare("SELECT keys FROM keys_balance WHERE user_id = ?").get(userId) as { keys: number };
      return row.keys;
    });
    return tx();
  }

  async getXp(userId: string): Promise<XpRow | null> {
    return (this.db.prepare("SELECT * FROM xp WHERE user_id = ?").get(userId) as XpRow) ?? null;
  }

  async updateXp(userId: string, patch: XpPatch): Promise<void> {
    const sets: string[] = [];
    const vals: (string | number | null)[] = [];
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) continue;
      sets.push(`${k} = ?`);
      vals.push(v);
    }
    if (sets.length === 0) return;
    vals.push(userId);
    this.db.prepare(`UPDATE xp SET ${sets.join(", ")} WHERE user_id = ?`).run(...vals);
  }

  async getHistory(userId: string, limit: number): Promise<HistoryRow[]> {
    return this.db
      .prepare(
        "SELECT id, anime_id, ep, title, image, progress, updated_at FROM watch_history WHERE user_id = ? ORDER BY updated_at DESC LIMIT ?"
      )
      .all(userId, limit) as HistoryRow[];
  }

  async upsertHistory(userId: string, data: UpsertHistoryData): Promise<void> {
    const now = Date.now();
    this.db.prepare(
      `INSERT INTO watch_history (user_id, anime_id, ep, title, image, progress, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, anime_id, ep) DO UPDATE SET
         progress = excluded.progress, title = excluded.title, image = excluded.image, updated_at = excluded.updated_at`
    ).run(userId, data.anime_id, data.ep, data.title, data.image, data.progress, now);
  }

  async createAdWatch(userId: string): Promise<string> {
    const now = Date.now();
    const id = `ad_${userId}_${now}_${Math.random().toString(36).slice(2, 8)}`;
    this.db.prepare(
      "INSERT INTO ad_watches (id, user_id, started_at, last_progress, last_heartbeat, total_seconds, completed) VALUES (?, ?, ?, 0, ?, 0, 0)"
    ).run(id, userId, now, now);
    return id;
  }

  async getAdWatch(watchId: string, userId: string): Promise<AdWatchRow | null> {
    return (
      (this.db.prepare("SELECT * FROM ad_watches WHERE id = ? AND user_id = ?").get(watchId, userId) as AdWatchRow) ??
      null
    );
  }

  async updateAdWatch(watchId: string, patch: { last_progress?: number; last_heartbeat?: number; total_seconds?: number; completed?: number }): Promise<void> {
    const sets: string[] = [];
    const vals: (string | number | null)[] = [];
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) continue;
      sets.push(`${k} = ?`);
      vals.push(v);
    }
    if (sets.length === 0) return;
    vals.push(watchId);
    this.db.prepare(`UPDATE ad_watches SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  }

  // --- v2: watchlist ---
  async getWatchlist(userId: string, status?: WatchlistStatus): Promise<WatchlistItem[]> {
    if (status) {
      return this.db
        .prepare("SELECT * FROM watchlist WHERE user_id = ? AND status = ? ORDER BY updated_at DESC")
        .all(userId, status) as WatchlistItem[];
    }
    return this.db
      .prepare("SELECT * FROM watchlist WHERE user_id = ? ORDER BY updated_at DESC")
      .all(userId) as WatchlistItem[];
  }

  async upsertWatchlist(userId: string, animeId: number, status: WatchlistStatus, title = "", image = ""): Promise<void> {
    const now = Date.now();
    this.db.prepare(
      `INSERT INTO watchlist (user_id, anime_id, status, title, image, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, anime_id) DO UPDATE SET status = excluded.status,
         title = COALESCE(NULLIF(excluded.title, ''), title),
         image = COALESCE(NULLIF(excluded.image, ''), image),
         updated_at = excluded.updated_at`
    ).run(userId, animeId, status, title, image, now, now);
  }

  async removeFromWatchlist(userId: string, animeId: number): Promise<void> {
    this.db.prepare("DELETE FROM watchlist WHERE user_id = ? AND anime_id = ?").run(userId, animeId);
  }

  // --- v2: ratings ---
  async getRatingSummary(animeId: number): Promise<{ avg: number; count: number }> {
    const row = this.db
      .prepare("SELECT AVG(rating) AS avg, COUNT(*) AS count FROM ratings WHERE anime_id = ?")
      .get(animeId) as { avg: number | null; count: number };
    return { avg: row.avg ? Math.round(row.avg * 10) / 10 : 0, count: row.count };
  }

  async getUserRating(userId: string, animeId: number): Promise<{ rating: number; review_text: string } | null> {
    const row = this.db
      .prepare("SELECT rating, review_text FROM ratings WHERE user_id = ? AND anime_id = ?")
      .get(userId, animeId) as { rating: number; review_text: string } | undefined;
    return row ?? null;
  }

  async upsertRating(userId: string, animeId: number, rating: number, reviewText: string): Promise<void> {
    const now = Date.now();
    this.db.prepare(
      `INSERT INTO ratings (user_id, anime_id, rating, review_text, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, anime_id) DO UPDATE SET rating = excluded.rating,
         review_text = excluded.review_text, updated_at = excluded.updated_at`
    ).run(userId, animeId, rating, reviewText, now, now);
  }

  // --- v2: comments ---
  async getComments(animeId: number, ep: number, limit: number): Promise<CommentRow[]> {
    return this.db
      .prepare(
        `SELECT c.id, c.user_id, c.anime_id, c.ep, c.text, c.created_at,
                u.name, u.image, u.is_demo
         FROM comments c LEFT JOIN users u ON u.id = c.user_id
         WHERE c.anime_id = ? AND c.ep = ? ORDER BY c.created_at DESC LIMIT ?`
      )
      .all(animeId, ep, limit) as CommentRow[];
  }

  async addComment(userId: string, animeId: number, ep: number, text: string): Promise<number> {
    const now = Date.now();
    const res = this.db
      .prepare("INSERT INTO comments (user_id, anime_id, ep, text, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(userId, animeId, ep, text, now);
    return Number(res.lastInsertRowid);
  }

  // --- v2: user meta KV ---
  async getUserMeta(userId: string, key: string): Promise<string | null> {
    const row = this.db.prepare("SELECT value FROM user_meta WHERE user_id = ? AND key = ?").get(userId, key) as
      | { value: string } | undefined;
    return row?.value ?? null;
  }

  async setUserMeta(userId: string, key: string, value: string): Promise<void> {
    this.db.prepare(
      `INSERT INTO user_meta (user_id, key, value) VALUES (?, ?, ?)
       ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value`
    ).run(userId, key, value);
  }

  // --- v2: download queue ---
  async getDownloadQueue(userId: string): Promise<DownloadQueueItem[]> {
    return this.db
      .prepare("SELECT anime_id, ep, title, image, created_at FROM download_queue WHERE user_id = ? ORDER BY created_at DESC")
      .all(userId) as DownloadQueueItem[];
  }

  async upsertDownloadQueue(userId: string, animeId: number, ep: number, title: string, image: string): Promise<void> {
    const now = Date.now();
    this.db.prepare(
      `INSERT INTO download_queue (user_id, anime_id, ep, title, image, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, anime_id, ep) DO UPDATE SET created_at = excluded.created_at`
    ).run(userId, animeId, ep, title, image, now);
  }

  async removeFromDownloadQueue(userId: string, animeId: number, ep: number): Promise<void> {
    this.db.prepare("DELETE FROM download_queue WHERE user_id = ? AND anime_id = ? AND ep = ?").run(userId, animeId, ep);
  }
}
