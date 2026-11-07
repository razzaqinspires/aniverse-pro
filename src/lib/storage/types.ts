// Storage adapter contract. All DB access goes through this interface so the app can run on
// better-sqlite3 (local/dev), Turso/libsql (remote, serverless-friendly, pure JS), or an
// in-memory fallback (Vercel without Turso — ephemeral, for demo only).
// Methods are async to accommodate remote adapters; local adapters resolve immediately.

export interface UserRow {
  id: string;
  email: string | null;
  name: string | null;
  image: string | null;
  is_demo: number;
  created_at: number;
}

export interface XpRow {
  user_id: string;
  xp_total: number;
  level: number;
  xp_today: number;
  daily_cap_reset: number;
  last_heartbeat: number;
}

export interface HistoryRow {
  id: number;
  anime_id: number;
  ep: number;
  title: string;
  image: string;
  progress: number;
  updated_at: number;
}

export interface AdWatchRow {
  id: string;
  user_id: string;
  started_at: number;
  last_progress: number;
  last_heartbeat: number;
  total_seconds: number;
  completed: number;
}

export interface AdHeartbeatOutcome {
  ok: boolean;
  reset: boolean;
  resetReason?: string;
  progress: number;
}

export interface AdCompleteOutcome {
  ok: boolean;
  granted: number;
  keys: number;
  reason?: string;
}

export interface UserProfile {
  id: string;
  email: string | null;
  name: string | null;
  image: string | null;
  isDemo: boolean;
  createdAt: number;
  keys: number;
  xp: number;
  level: number;
}

export interface UpsertHistoryData {
  anime_id: number;
  ep: number;
  title: string;
  image: string;
  progress: number;
}

export interface XpPatch {
  xp_total?: number;
  level?: number;
  xp_today?: number;
  daily_cap_reset?: number;
  last_heartbeat?: number;
}

// --- v2 row types ---
export type WatchlistStatus = "plan_to_watch" | "watching" | "completed";

export interface WatchlistItem {
  anime_id: number;
  title: string;
  image: string;
  status: WatchlistStatus;
  created_at: number;
  updated_at: number;
}

export interface RatingRow {
  user_id: string;
  anime_id: number;
  rating: number;
  review_text: string;
  created_at: number;
  updated_at: number;
}

export interface CommentRow {
  id: number;
  user_id: string;
  anime_id: number;
  ep: number;
  text: string;
  created_at: number;
  name: string | null;
  image: string | null;
  is_demo: number;
}

export interface DownloadQueueItem {
  anime_id: number;
  ep: number;
  title: string;
  image: string;
  created_at: number;
}

export interface StorageAdapter {
  readonly name: string;
  getOrCreateUser(
    id: string,
    opts: { email?: string | null; name?: string | null; image?: string | null; isDemo: boolean }
  ): Promise<{ id: string; is_demo: number }>;
  getUser(userId: string): Promise<UserRow | null>;
  getKeys(userId: string): Promise<number>;
  /** Atomic compare-and-decrement. Returns true iff a key was actually consumed. */
  spendKey(userId: string, reason: string): Promise<boolean>;
  /** Adds keys + ledger entry. Returns the new balance. */
  grantKeys(userId: string, amount: number, reason: string): Promise<number>;
  getXp(userId: string): Promise<XpRow | null>;
  updateXp(userId: string, patch: XpPatch): Promise<void>;
  getHistory(userId: string, limit: number): Promise<HistoryRow[]>;
  upsertHistory(userId: string, data: UpsertHistoryData): Promise<void>;
  createAdWatch(userId: string): Promise<string>;
  getAdWatch(watchId: string, userId: string): Promise<AdWatchRow | null>;
  updateAdWatch(
    watchId: string,
    patch: { last_progress?: number; last_heartbeat?: number; total_seconds?: number; completed?: number }
  ): Promise<void>;
  // --- v2: watchlist ---
  getWatchlist(userId: string, status?: WatchlistStatus): Promise<WatchlistItem[]>;
  upsertWatchlist(userId: string, animeId: number, status: WatchlistStatus, title?: string, image?: string): Promise<void>;
  removeFromWatchlist(userId: string, animeId: number): Promise<void>;
  // --- v2: ratings ---
  getRatingSummary(animeId: number): Promise<{ avg: number; count: number }>;
  getUserRating(userId: string, animeId: number): Promise<{ rating: number; review_text: string } | null>;
  upsertRating(userId: string, animeId: number, rating: number, reviewText: string): Promise<void>;
  // --- v2: comments (joined with user name/image/is_demo) ---
  getComments(animeId: number, ep: number, limit: number): Promise<CommentRow[]>;
  addComment(userId: string, animeId: number, ep: number, text: string): Promise<number>;
  // --- v2: user meta (KV, e.g. last notification check) ---
  getUserMeta(userId: string, key: string): Promise<string | null>;
  setUserMeta(userId: string, key: string, value: string): Promise<void>;
  // --- v2: download / tonton-nanti queue ---
  getDownloadQueue(userId: string): Promise<DownloadQueueItem[]>;
  upsertDownloadQueue(userId: string, animeId: number, ep: number, title: string, image: string): Promise<void>;
  removeFromDownloadQueue(userId: string, animeId: number, ep: number): Promise<void>;
}
