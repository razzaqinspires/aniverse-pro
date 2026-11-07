// Storage factory — picks the adapter based on environment.
//   1. TURSO_DATABASE_URL + TURSO_AUTH_TOKEN  → Turso (persistent, serverless, recommended on Vercel)
//   2. DATABASE_PATH explicitly set            → better-sqlite3 (on Vercel the path is forced to /tmp)
//   3. Running on Vercel, neither above       → in-memory (ephemeral, demo-only — noted in README)
//   4. Local dev (default)                    → better-sqlite3 at ./data/aniverse.db

import { config, isTursoConfigured } from "../config";
import { SqliteAdapter } from "./sqlite";
import { TursoAdapter } from "./turso";
import { MemoryAdapter } from "./memory";
import type { StorageAdapter, UserProfile } from "./types";

let _adapter: StorageAdapter | null = null;

export function getStorage(): StorageAdapter {
  if (_adapter) return _adapter;
  if (isTursoConfigured()) {
    _adapter = new TursoAdapter(config.tursoDatabaseUrl, config.tursoAuthToken);
  } else if (process.env.DATABASE_PATH) {
    _adapter = new SqliteAdapter(process.env.DATABASE_PATH);
  } else if (config.isVercel) {
    // No persistent store configured on Vercel — ephemeral in-memory fallback.
    _adapter = new MemoryAdapter();
  } else {
    _adapter = new SqliteAdapter();
  }
  return _adapter;
}

/** Which adapter is active — surfaced in /api/health and README troubleshooting. */
export function activeStorageName(): string {
  return getStorage().name;
}

/** Build a joined user profile from raw adapter calls (used by /api/user/me). */
export async function buildUserProfile(
  storage: StorageAdapter,
  userId: string,
  fallbackIsDemo: boolean
): Promise<UserProfile> {
  const [user, keys, xp] = await Promise.all([
    storage.getUser(userId),
    storage.getKeys(userId),
    storage.getXp(userId),
  ]);
  return {
    id: userId,
    email: user?.email ?? null,
    name: user?.name ?? null,
    image: user?.image ?? null,
    isDemo: user ? user.is_demo === 1 : fallbackIsDemo,
    createdAt: user?.created_at ?? Date.now(),
    keys,
    xp: xp?.xp_total ?? 0,
    level: xp?.level ?? 1,
  };
}
