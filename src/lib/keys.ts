// Atomic key balance operations. Anti double-spend: single UPDATE ... WHERE keys > 0,
// rowsAffected === 1 means success; 0 means insufficient funds (or concurrent spend).

import { getDb } from "./db";
import { config } from "./config";

export function getKeys(userId: string): number {
  const db = getDb();
  const row = db.prepare("SELECT keys FROM keys_balance WHERE user_id = ?").get(userId) as
    | { keys: number }
    | undefined;
  return row?.keys ?? 0;
}

/** Returns true if a key was actually consumed. Atomic — concurrent calls cannot both succeed. */
export function spendKey(userId: string, reason: string): boolean {
  const db = getDb();
  const now = Date.now();
  const tx = db.transaction(() => {
    const res = db
      .prepare("UPDATE keys_balance SET keys = keys - 1, updated_at = ? WHERE user_id = ? AND keys > 0")
      .run(now, userId);
    if (res.changes !== 1) return false;
    db.prepare("INSERT INTO key_ledger (user_id, delta, reason, created_at) VALUES (?, -1, ?, ?)").run(
      userId,
      reason,
      now
    );
    return true;
  });
  return tx();
}

export function grantKeys(userId: string, amount: number, reason: string): number {
  const db = getDb();
  const now = Date.now();
  const tx = db.transaction(() => {
    db.prepare(
      "UPDATE keys_balance SET keys = keys + ?, updated_at = ? WHERE user_id = ?"
    ).run(amount, now, userId);
    db.prepare("INSERT INTO key_ledger (user_id, delta, reason, created_at) VALUES (?, ?, ?, ?)").run(
      userId,
      amount,
      reason,
      now
    );
    const row = db.prepare("SELECT keys FROM keys_balance WHERE user_id = ?").get(userId) as { keys: number };
    return row.keys;
  });
  return tx();
}

// ---------- Ad sessions (anti-bypass) ----------
export function startAdSession(userId: string): string {
  const db = getDb();
  const now = Date.now();
  const id = `ad_${userId}_${now}_${Math.random().toString(36).slice(2, 8)}`;
  db.prepare(
    "INSERT INTO ad_watches (id, user_id, started_at, last_progress, last_heartbeat, total_seconds, completed) VALUES (?, ?, ?, 0, ?, 0, 0)"
  ).run(id, userId, now, now);
  return id;
}

export function heartbeatAd(
  watchId: string,
  userId: string,
  progressSec: number,
  hidden: boolean
): { ok: boolean; reset: boolean; resetReason?: string; progress: number } {
  const db = getDb();
  const now = Date.now();
  const row = db
    .prepare("SELECT * FROM ad_watches WHERE id = ? AND user_id = ?")
    .get(watchId, userId) as any;
  if (!row) return { ok: false, reset: true, resetReason: "Sesi iklan tidak ditemukan", progress: 0 };
  if (row.completed) return { ok: true, reset: false, progress: config.adDurationSec };

  // Anti-bypass: tab hidden / minimized => reset progress to last validated total.
  if (hidden) {
    db.prepare(
      "UPDATE ad_watches SET last_progress = 0, last_heartbeat = ? WHERE id = ?"
    ).run(now, watchId);
    return { ok: true, reset: true, resetReason: "Tab tidak aktif — progress iklan direset", progress: 0 };
  }
  // Heartbeat must arrive within reasonable window; if client jumps too far, clamp.
  const elapsed = (now - row.last_heartbeat) / 1000;
  const claimed = Math.min(progressSec - row.last_progress, Math.max(elapsed, 0) + 1);
  const newTotal = Math.min(row.total_seconds + Math.max(claimed, 0), config.adDurationSec);
  db.prepare(
    "UPDATE ad_watches SET last_progress = ?, last_heartbeat = ?, total_seconds = ? WHERE id = ?"
  ).run(progressSec, now, newTotal, watchId);
  return { ok: true, reset: false, progress: newTotal };
}

export function completeAd(watchId: string, userId: string): { ok: boolean; granted: number; keys: number; reason?: string } {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM ad_watches WHERE id = ? AND user_id = ?")
    .get(watchId, userId) as any;
  if (!row) return { ok: false, granted: 0, keys: getKeys(userId), reason: "Sesi iklan tidak ditemukan" };
  if (row.total_seconds < config.adDurationSec) {
    return { ok: false, granted: 0, keys: getKeys(userId), reason: "Iklan belum ditonton penuh" };
  }
  if (row.completed) return { ok: false, granted: 0, keys: getKeys(userId), reason: "Iklan sudah diklaim" };
  db.prepare("UPDATE ad_watches SET completed = 1 WHERE id = ?").run(watchId);
  const keys = grantKeys(userId, config.adRewardKeys, "ad_reward");
  return { ok: true, granted: config.adRewardKeys, keys };
}
