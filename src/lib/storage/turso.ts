// Turso / libSQL adapter — pure JS client (no native module), works on Vercel serverless.
// Wire-compatible with SQLite so the same schema/SQL works. Recommended for production
// persistence on Vercel. Enable with TURSO_DATABASE_URL + TURSO_AUTH_TOKEN.

import { createClient, type Client } from "@libsql/client";
import { config, nextMidnightFrom } from "../config";
import { SCHEMA_STATEMENTS } from "./schema";
import type {
  StorageAdapter, UserRow, XpRow, HistoryRow, AdWatchRow, UpsertHistoryData, XpPatch,
  WatchlistItem, WatchlistStatus, CommentRow, DownloadQueueItem,
} from "./types";

function row<T>(r: unknown): T {
  return r as T;
}

export class TursoAdapter implements StorageAdapter {
  readonly name = "turso";
  private client: Client;
  private migrated = false;

  constructor(url: string, authToken: string) {
    this.client = createClient({ url, authToken });
  }

  private async ensureSchema(): Promise<void> {
    if (this.migrated) return;
    for (const stmt of SCHEMA_STATEMENTS) {
      await this.client.execute(stmt);
    }
    this.migrated = true;
  }

  async getOrCreateUser(id: string, opts: { email?: string | null; name?: string | null; image?: string | null; isDemo: boolean }) {
    await this.ensureSchema();
    const now = Date.now();
    const existing = await this.client.execute({
      sql: "SELECT id, is_demo FROM users WHERE id = ?",
      args: [id],
    });
    if (existing.rows.length > 0) {
      await this.client.execute({
        sql: "UPDATE users SET email = COALESCE(?, email), name = COALESCE(?, name), image = COALESCE(?, image) WHERE id = ?",
        args: [opts.email ?? null, opts.name ?? null, opts.image ?? null, id],
      });
      return { id, is_demo: Number(existing.rows[0].is_demo) };
    }
    const isDemo = opts.isDemo ? 1 : 0;
    const batch = [
      { sql: "INSERT INTO users (id, email, name, image, is_demo, created_at) VALUES (?, ?, ?, ?, ?, ?)", args: [id, opts.email ?? null, opts.name ?? null, opts.image ?? null, isDemo, now] },
      { sql: "INSERT INTO keys_balance (user_id, keys, updated_at) VALUES (?, ?, ?)", args: [id, config.startingKeys, now] },
      { sql: "INSERT INTO xp (user_id, xp_total, level, xp_today, daily_cap_reset, last_heartbeat) VALUES (?, 0, 1, 0, ?, 0)", args: [id, nextMidnightFrom(now)] },
      { sql: "INSERT INTO key_ledger (user_id, delta, reason, created_at) VALUES (?, ?, ?, ?)", args: [id, config.startingKeys, "initial_balance", now] },
    ];
    await this.client.batch(batch, "write");
    return { id, is_demo: isDemo };
  }

  async getUser(userId: string): Promise<UserRow | null> {
    await this.ensureSchema();
    const res = await this.client.execute({ sql: "SELECT * FROM users WHERE id = ?", args: [userId] });
    return res.rows.length ? row<UserRow>(res.rows[0]) : null;
  }

  async getKeys(userId: string): Promise<number> {
    const res = await this.client.execute({ sql: "SELECT keys FROM keys_balance WHERE user_id = ?", args: [userId] });
    return res.rows.length ? Number(res.rows[0].keys) : 0;
  }

  async spendKey(userId: string, reason: string): Promise<boolean> {
    const now = Date.now();
    const res = await this.client.execute({
      sql: "UPDATE keys_balance SET keys = keys - 1, updated_at = ? WHERE user_id = ? AND keys > 0",
      args: [now, userId],
    });
    if (res.rowsAffected !== 1) return false;
    await this.client.execute({
      sql: "INSERT INTO key_ledger (user_id, delta, reason, created_at) VALUES (?, -1, ?, ?)",
      args: [userId, reason, now],
    });
    return true;
  }

  async grantKeys(userId: string, amount: number, reason: string): Promise<number> {
    const now = Date.now();
    await this.client.batch(
      [
        { sql: "UPDATE keys_balance SET keys = keys + ?, updated_at = ? WHERE user_id = ?", args: [amount, now, userId] },
        { sql: "INSERT INTO key_ledger (user_id, delta, reason, created_at) VALUES (?, ?, ?, ?)", args: [userId, amount, reason, now] },
      ],
      "write"
    );
    return this.getKeys(userId);
  }

  async getXp(userId: string): Promise<XpRow | null> {
    const res = await this.client.execute({ sql: "SELECT * FROM xp WHERE user_id = ?", args: [userId] });
    return res.rows.length ? row<XpRow>(res.rows[0]) : null;
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
    await this.client.execute({ sql: `UPDATE xp SET ${sets.join(", ")} WHERE user_id = ?`, args: vals });
  }

  async getHistory(userId: string, limit: number): Promise<HistoryRow[]> {
    const res = await this.client.execute({
      sql: "SELECT id, anime_id, ep, title, image, progress, updated_at FROM watch_history WHERE user_id = ? ORDER BY updated_at DESC LIMIT ?",
      args: [userId, limit],
    });
    return res.rows.map((r) => row<HistoryRow>(r));
  }

  async upsertHistory(userId: string, data: UpsertHistoryData): Promise<void> {
    const now = Date.now();
    await this.client.execute({
      sql: `INSERT INTO watch_history (user_id, anime_id, ep, title, image, progress, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id, anime_id, ep) DO UPDATE SET
              progress = excluded.progress, title = excluded.title, image = excluded.image, updated_at = excluded.updated_at`,
      args: [userId, data.anime_id, data.ep, data.title, data.image, data.progress, now],
    });
  }

  async createAdWatch(userId: string): Promise<string> {
    const now = Date.now();
    const id = `ad_${userId}_${now}_${Math.random().toString(36).slice(2, 8)}`;
    await this.client.execute({
      sql: "INSERT INTO ad_watches (id, user_id, started_at, last_progress, last_heartbeat, total_seconds, completed) VALUES (?, ?, ?, 0, ?, 0, 0)",
      args: [id, userId, now, now],
    });
    return id;
  }

  async getAdWatch(watchId: string, userId: string): Promise<AdWatchRow | null> {
    const res = await this.client.execute({
      sql: "SELECT * FROM ad_watches WHERE id = ? AND user_id = ?",
      args: [watchId, userId],
    });
    return res.rows.length ? row<AdWatchRow>(res.rows[0]) : null;
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
    await this.client.execute({ sql: `UPDATE ad_watches SET ${sets.join(", ")} WHERE id = ?`, args: vals });
  }

  // --- v2: watchlist ---
  async getWatchlist(userId: string, status?: WatchlistStatus): Promise<WatchlistItem[]> {
    const sql = status
      ? "SELECT * FROM watchlist WHERE user_id = ? AND status = ? ORDER BY updated_at DESC"
      : "SELECT * FROM watchlist WHERE user_id = ? ORDER BY updated_at DESC";
    const args = status ? [userId, status] : [userId];
    const res = await this.client.execute({ sql, args });
    return res.rows.map((r) => row<WatchlistItem>(r));
  }

  async upsertWatchlist(userId: string, animeId: number, status: WatchlistStatus, title = "", image = ""): Promise<void> {
    const now = Date.now();
    await this.client.execute({
      sql: `INSERT INTO watchlist (user_id, anime_id, status, title, image, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id, anime_id) DO UPDATE SET status = excluded.status,
              title = COALESCE(NULLIF(excluded.title, ''), title),
              image = COALESCE(NULLIF(excluded.image, ''), image),
              updated_at = excluded.updated_at`,
      args: [userId, animeId, status, title, image, now, now],
    });
  }

  async removeFromWatchlist(userId: string, animeId: number): Promise<void> {
    await this.client.execute({ sql: "DELETE FROM watchlist WHERE user_id = ? AND anime_id = ?", args: [userId, animeId] });
  }

  // --- v2: ratings ---
  async getRatingSummary(animeId: number): Promise<{ avg: number; count: number }> {
    const res = await this.client.execute({
      sql: "SELECT AVG(rating) AS avg, COUNT(*) AS count FROM ratings WHERE anime_id = ?",
      args: [animeId],
    });
    const r = res.rows[0] as any;
    const avg = Number(r?.avg ?? 0);
    return { avg: avg ? Math.round(avg * 10) / 10 : 0, count: Number(r?.count ?? 0) };
  }

  async getUserRating(userId: string, animeId: number): Promise<{ rating: number; review_text: string } | null> {
    const res = await this.client.execute({
      sql: "SELECT rating, review_text FROM ratings WHERE user_id = ? AND anime_id = ?",
      args: [userId, animeId],
    });
    if (res.rows.length === 0) return null;
    const r = res.rows[0] as any;
    return { rating: Number(r.rating), review_text: String(r.review_text ?? "") };
  }

  async upsertRating(userId: string, animeId: number, rating: number, reviewText: string): Promise<void> {
    const now = Date.now();
    await this.client.execute({
      sql: `INSERT INTO ratings (user_id, anime_id, rating, review_text, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id, anime_id) DO UPDATE SET rating = excluded.rating,
              review_text = excluded.review_text, updated_at = excluded.updated_at`,
      args: [userId, animeId, rating, reviewText, now, now],
    });
  }

  // --- v2: comments ---
  async getComments(animeId: number, ep: number, limit: number): Promise<CommentRow[]> {
    const res = await this.client.execute({
      sql: `SELECT c.id, c.user_id, c.anime_id, c.ep, c.text, c.created_at,
                   u.name, u.image, u.is_demo
            FROM comments c LEFT JOIN users u ON u.id = c.user_id
            WHERE c.anime_id = ? AND c.ep = ? ORDER BY c.created_at DESC LIMIT ?`,
      args: [animeId, ep, limit],
    });
    return res.rows.map((r) => row<CommentRow>(r));
  }

  async addComment(userId: string, animeId: number, ep: number, text: string): Promise<number> {
    const now = Date.now();
    const res = await this.client.execute({
      sql: "INSERT INTO comments (user_id, anime_id, ep, text, created_at) VALUES (?, ?, ?, ?, ?)",
      args: [userId, animeId, ep, text, now],
    });
    return Number(res.lastInsertRowid ?? 0);
  }

  // --- v2: user meta KV ---
  async getUserMeta(userId: string, key: string): Promise<string | null> {
    const res = await this.client.execute({
      sql: "SELECT value FROM user_meta WHERE user_id = ? AND key = ?",
      args: [userId, key],
    });
    return res.rows.length ? String((res.rows[0] as any).value) : null;
  }

  async setUserMeta(userId: string, key: string, value: string): Promise<void> {
    await this.client.execute({
      sql: `INSERT INTO user_meta (user_id, key, value) VALUES (?, ?, ?)
            ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value`,
      args: [userId, key, value],
    });
  }

  // --- v2: download queue ---
  async getDownloadQueue(userId: string): Promise<DownloadQueueItem[]> {
    const res = await this.client.execute({
      sql: "SELECT anime_id, ep, title, image, created_at FROM download_queue WHERE user_id = ? ORDER BY created_at DESC",
      args: [userId],
    });
    return res.rows.map((r) => row<DownloadQueueItem>(r));
  }

  async upsertDownloadQueue(userId: string, animeId: number, ep: number, title: string, image: string): Promise<void> {
    const now = Date.now();
    await this.client.execute({
      sql: `INSERT INTO download_queue (user_id, anime_id, ep, title, image, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id, anime_id, ep) DO UPDATE SET created_at = excluded.created_at`,
      args: [userId, animeId, ep, title, image, now],
    });
  }

  async removeFromDownloadQueue(userId: string, animeId: number, ep: number): Promise<void> {
    await this.client.execute({
      sql: "DELETE FROM download_queue WHERE user_id = ? AND anime_id = ? AND ep = ?",
      args: [userId, animeId, ep],
    });
  }
}
