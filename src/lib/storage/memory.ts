// In-memory adapter — fallback for Vercel serverless when neither Turso nor a SQLite path is
// configured. Data lives in JS Maps and is lost on every cold start / instance recycle.
// Fully functional for demos; NOT for production persistence. Atomicity is guaranteed by the
// single-threaded JS event loop (no await points inside critical sections).

import { config, nextMidnightFrom } from "../config";
import type {
  StorageAdapter, UserRow, XpRow, HistoryRow, AdWatchRow, UpsertHistoryData, XpPatch,
  WatchlistItem, WatchlistStatus, CommentRow, DownloadQueueItem,
} from "./types";

export class MemoryAdapter implements StorageAdapter {
  readonly name = "memory";
  private users = new Map<string, UserRow>();
  private keys = new Map<string, number>();
  private xp = new Map<string, XpRow>();
  private history = new Map<number, HistoryRow & { user_id: string }>();
  private ledger: { id: number; user_id: string; delta: number; reason: string; created_at: number }[] = [];
  private adWatches = new Map<string, AdWatchRow>();
  private historySeq = 1;
  private ledgerSeq = 1;
  // --- v2 stores ---
  private watchlist = new Map<string, WatchlistItem & { user_id: string }>();
  private ratings = new Map<string, { user_id: string; anime_id: number; rating: number; review_text: string; created_at: number; updated_at: number }>();
  private comments: (Omit<CommentRow, "name" | "image" | "is_demo"> & { user_id: string })[] = [];
  private commentSeq = 1;
  private userMeta = new Map<string, string>();
  private downloadQueue = new Map<string, DownloadQueueItem & { user_id: string }>();

  async getOrCreateUser(id: string, opts: { email?: string | null; name?: string | null; image?: string | null; isDemo: boolean }) {
    const now = Date.now();
    const existing = this.users.get(id);
    if (existing) {
      if (opts.email) existing.email = opts.email;
      if (opts.name) existing.name = opts.name;
      if (opts.image) existing.image = opts.image;
      return { id, is_demo: existing.is_demo };
    }
    const isDemo = opts.isDemo ? 1 : 0;
    this.users.set(id, {
      id, email: opts.email ?? null, name: opts.name ?? null, image: opts.image ?? null,
      is_demo: isDemo, created_at: now,
    });
    this.keys.set(id, config.startingKeys);
    this.xp.set(id, { user_id: id, xp_total: 0, level: 1, xp_today: 0, daily_cap_reset: nextMidnightFrom(now), last_heartbeat: 0 });
    this.ledger.push({ id: this.ledgerSeq++, user_id: id, delta: config.startingKeys, reason: "initial_balance", created_at: now });
    return { id, is_demo: isDemo };
  }

  async getUser(userId: string): Promise<UserRow | null> {
    return this.users.get(userId) ?? null;
  }

  async getKeys(userId: string): Promise<number> {
    return this.keys.get(userId) ?? 0;
  }

  async spendKey(userId: string, reason: string): Promise<boolean> {
    const now = Date.now();
    const bal = this.keys.get(userId);
    if (!bal || bal <= 0) return false;
    this.keys.set(userId, bal - 1);
    this.ledger.push({ id: this.ledgerSeq++, user_id: userId, delta: -1, reason, created_at: now });
    return true;
  }

  async grantKeys(userId: string, amount: number, reason: string): Promise<number> {
    const now = Date.now();
    const next = (this.keys.get(userId) ?? 0) + amount;
    this.keys.set(userId, next);
    this.ledger.push({ id: this.ledgerSeq++, user_id: userId, delta: amount, reason, created_at: now });
    return next;
  }

  async getXp(userId: string): Promise<XpRow | null> {
    return this.xp.get(userId) ?? null;
  }

  async updateXp(userId: string, patch: XpPatch): Promise<void> {
    const row = this.xp.get(userId);
    if (!row) return;
    Object.assign(row, patch);
  }

  async getHistory(userId: string, limit: number): Promise<HistoryRow[]> {
    return [...this.history.values()]
      .filter((h) => h.user_id === userId)
      .sort((a, b) => b.updated_at - a.updated_at)
      .slice(0, limit)
      .map(({ user_id: _u, ...rest }) => rest);
  }

  async upsertHistory(userId: string, data: UpsertHistoryData): Promise<void> {
    const now = Date.now();
    const existing = [...this.history.values()].find(
      (h) => h.user_id === userId && h.anime_id === data.anime_id && h.ep === data.ep
    );
    if (existing) {
      existing.progress = data.progress;
      existing.title = data.title;
      existing.image = data.image;
      existing.updated_at = now;
    } else {
      this.history.set(this.historySeq++, { id: this.historySeq, user_id: userId, ...data, updated_at: now });
    }
  }

  async createAdWatch(userId: string): Promise<string> {
    const now = Date.now();
    const id = `ad_${userId}_${now}_${Math.random().toString(36).slice(2, 8)}`;
    this.adWatches.set(id, {
      id, user_id: userId, started_at: now, last_progress: 0, last_heartbeat: now, total_seconds: 0, completed: 0,
    });
    return id;
  }

  async getAdWatch(watchId: string, userId: string): Promise<AdWatchRow | null> {
    const row = this.adWatches.get(watchId);
    return row && row.user_id === userId ? row : null;
  }

  async updateAdWatch(watchId: string, patch: { last_progress?: number; last_heartbeat?: number; total_seconds?: number; completed?: number }): Promise<void> {
    const row = this.adWatches.get(watchId);
    if (!row) return;
    Object.assign(row, patch);
  }

  // --- v2: watchlist ---
  async getWatchlist(userId: string, status?: WatchlistStatus): Promise<WatchlistItem[]> {
    return [...this.watchlist.values()]
      .filter((w) => w.user_id === userId && (!status || w.status === status))
      .sort((a, b) => b.updated_at - a.updated_at)
      .map(({ user_id: _u, ...rest }) => rest);
  }

  async upsertWatchlist(userId: string, animeId: number, status: WatchlistStatus, title = "", image = ""): Promise<void> {
    const now = Date.now();
    const key = `${userId}:${animeId}`;
    const existing = this.watchlist.get(key);
    this.watchlist.set(key, {
      user_id: userId,
      anime_id: animeId,
      status,
      title: title || existing?.title || "",
      image: image || existing?.image || "",
      created_at: existing?.created_at ?? now,
      updated_at: now,
    });
  }

  async removeFromWatchlist(userId: string, animeId: number): Promise<void> {
    this.watchlist.delete(`${userId}:${animeId}`);
  }

  // --- v2: ratings ---
  async getRatingSummary(animeId: number): Promise<{ avg: number; count: number }> {
    const all = [...this.ratings.values()].filter((r) => r.anime_id === animeId);
    if (all.length === 0) return { avg: 0, count: 0 };
    const avg = all.reduce((s, r) => s + r.rating, 0) / all.length;
    return { avg: Math.round(avg * 10) / 10, count: all.length };
  }

  async getUserRating(userId: string, animeId: number): Promise<{ rating: number; review_text: string } | null> {
    const r = this.ratings.get(`${userId}:${animeId}`);
    return r ? { rating: r.rating, review_text: r.review_text } : null;
  }

  async upsertRating(userId: string, animeId: number, rating: number, reviewText: string): Promise<void> {
    const now = Date.now();
    const key = `${userId}:${animeId}`;
    const existing = this.ratings.get(key);
    this.ratings.set(key, {
      user_id: userId, anime_id: animeId, rating, review_text: reviewText,
      created_at: existing?.created_at ?? now, updated_at: now,
    });
  }

  // --- v2: comments ---
  async getComments(animeId: number, ep: number, limit: number): Promise<CommentRow[]> {
    return this.comments
      .filter((c) => c.anime_id === animeId && c.ep === ep)
      .sort((a, b) => b.created_at - a.created_at)
      .slice(0, limit)
      .map((c) => {
        const u = this.users.get(c.user_id);
        return {
          id: c.id, user_id: c.user_id, anime_id: c.anime_id, ep: c.ep, text: c.text, created_at: c.created_at,
          name: u?.name ?? null, image: u?.image ?? null, is_demo: u?.is_demo ?? 0,
        };
      });
  }

  async addComment(userId: string, animeId: number, ep: number, text: string): Promise<number> {
    const id = this.commentSeq++;
    this.comments.push({ id, user_id: userId, anime_id: animeId, ep, text, created_at: Date.now() });
    return id;
  }

  // --- v2: user meta KV ---
  async getUserMeta(userId: string, key: string): Promise<string | null> {
    return this.userMeta.get(`${userId}:${key}`) ?? null;
  }

  async setUserMeta(userId: string, key: string, value: string): Promise<void> {
    this.userMeta.set(`${userId}:${key}`, value);
  }

  // --- v2: download queue ---
  async getDownloadQueue(userId: string): Promise<DownloadQueueItem[]> {
    return [...this.downloadQueue.values()]
      .filter((d) => d.user_id === userId)
      .sort((a, b) => b.created_at - a.created_at)
      .map(({ user_id: _u, ...rest }) => rest);
  }

  async upsertDownloadQueue(userId: string, animeId: number, ep: number, title: string, image: string): Promise<void> {
    this.downloadQueue.set(`${userId}:${animeId}:${ep}`, {
      user_id: userId, anime_id: animeId, ep, title, image, created_at: Date.now(),
    });
  }

  async removeFromDownloadQueue(userId: string, animeId: number, ep: number): Promise<void> {
    this.downloadQueue.delete(`${userId}:${animeId}:${ep}`);
  }
}
