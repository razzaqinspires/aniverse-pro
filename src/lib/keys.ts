// Atomic key balance + ad-session business logic. Storage-agnostic — all persistence goes
// through the StorageAdapter (sqlite / turso / memory). Anti double-spend is enforced by the
// adapter's compare-and-decrement (UPDATE ... WHERE keys > 0, rowsAffected === 1).

import { getStorage } from "./storage";
import { config } from "./config";
import type { AdHeartbeatOutcome, AdCompleteOutcome } from "./storage/types";

export async function getKeys(userId: string): Promise<number> {
  return getStorage().getKeys(userId);
}

/** Returns true if a key was actually consumed. Atomic — concurrent calls cannot both succeed. */
export async function spendKey(userId: string, reason: string): Promise<boolean> {
  return getStorage().spendKey(userId, reason);
}

export async function grantKeys(userId: string, amount: number, reason: string): Promise<number> {
  return getStorage().grantKeys(userId, amount, reason);
}

// ---------- Ad sessions (anti-bypass) ----------
export async function startAdSession(userId: string): Promise<string> {
  return getStorage().createAdWatch(userId);
}

export async function heartbeatAd(
  watchId: string,
  userId: string,
  progressSec: number,
  hidden: boolean
): Promise<AdHeartbeatOutcome> {
  const storage = getStorage();
  const now = Date.now();
  const row = await storage.getAdWatch(watchId, userId);
  if (!row) return { ok: false, reset: true, resetReason: "Sesi iklan tidak ditemukan", progress: 0 };
  if (row.completed) return { ok: true, reset: false, progress: config.adDurationSec };

  // Anti-bypass: tab hidden / minimized => reset validated progress to 0.
  if (hidden) {
    await storage.updateAdWatch(watchId, { last_progress: 0, last_heartbeat: now });
    return { ok: true, reset: true, resetReason: "Tab tidak aktif — progress iklan direset", progress: 0 };
  }
  // Clamp claimed progress to elapsed wall-clock (+1s tolerance) to block cheating.
  const elapsed = (now - row.last_heartbeat) / 1000;
  const claimed = Math.min(progressSec - row.last_progress, Math.max(elapsed, 0) + 1);
  const newTotal = Math.min(row.total_seconds + Math.max(claimed, 0), config.adDurationSec);
  await storage.updateAdWatch(watchId, {
    last_progress: progressSec,
    last_heartbeat: now,
    total_seconds: newTotal,
  });
  return { ok: true, reset: false, progress: newTotal };
}

export async function completeAd(watchId: string, userId: string): Promise<AdCompleteOutcome> {
  const storage = getStorage();
  const row = await storage.getAdWatch(watchId, userId);
  const keys = await storage.getKeys(userId);
  if (!row) return { ok: false, granted: 0, keys, reason: "Sesi iklan tidak ditemukan" };
  if (row.total_seconds < config.adDurationSec) {
    return { ok: false, granted: 0, keys, reason: "Iklan belum ditonton penuh" };
  }
  if (row.completed) return { ok: false, granted: 0, keys, reason: "Iklan sudah diklaim" };
  await storage.updateAdWatch(watchId, { completed: 1 });
  const newKeys = await grantKeys(userId, config.adRewardKeys, "ad_reward");
  return { ok: true, granted: config.adRewardKeys, keys: newKeys };
}
