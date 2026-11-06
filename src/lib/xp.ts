// XP & level logic. Level curve: to advance from level L to L+1 requires 100 * L^2 XP
// (cumulative triangular-sum). Reward: +1 key every 5 levels + badge.

import { getDb, nextMidnight } from "./db";
import { config } from "./config";
import { grantKeys } from "./keys";

export function xpForLevelGap(level: number): number {
  // XP needed to go from `level` to `level + 1`
  return 100 * level * level;
}

export function cumulativeXpForLevel(level: number): number {
  // total XP needed to *reach* `level` (level 1 => 0)
  let sum = 0;
  for (let l = 1; l < level; l++) sum += xpForLevelGap(l);
  return sum;
}

export function computeLevel(xpTotal: number): { level: number; xpInLevel: number; xpToNext: number; progressPct: number } {
  let level = 1;
  let remaining = xpTotal;
  while (remaining >= xpForLevelGap(level)) {
    remaining -= xpForLevelGap(level);
    level++;
    if (level > 1000) break; // safety
  }
  const gap = xpForLevelGap(level);
  return {
    level,
    xpInLevel: remaining,
    xpToNext: gap,
    progressPct: Math.min(100, Math.round((remaining / gap) * 100)),
  };
}

export function badgesForLevel(level: number): string[] {
  const b: string[] = ["Pemula"];
  if (level >= 5) b.push("Penonton Setia");
  if (level >= 10) b.push("Anime Lover");
  if (level >= 20) b.push("Wibu Sejati");
  if (level >= 50) b.push("Legenda Aniverse");
  return b;
}

export interface XpHeartbeatOutcome {
  ok: boolean;
  xp: number;
  level: number;
  xpToday: number;
  dailyCap: number;
  leveledUp: boolean;
  newBadges: string[];
  rewardKeysGranted: number;
  capped: boolean;
}

/**
 * Server-validated XP heartbeat.
 * - rejects if tab hidden / not playing (client must not send, but server double-checks)
 * - rate-limited: at most 1 heartbeat per XP_HEARTBEAT_INTERVAL_SEC
 * - daily cap enforced; xp_today resets at midnight
 */
export function applyXpHeartbeat(
  userId: string,
  seconds: number,
  hidden: boolean,
  playing: boolean
): XpHeartbeatOutcome {
  const db = getDb();
  const now = Date.now();
  const row = db.prepare("SELECT * FROM xp WHERE user_id = ?").get(userId) as any;
  if (!row) {
    return { ok: false, xp: 0, level: 1, xpToday: 0, dailyCap: config.xpDailyCap, leveledUp: false, newBadges: [], rewardKeysGranted: 0, capped: false };
  }

  // Daily cap reset
  let xpToday = row.xp_today;
  let capReset = row.daily_cap_reset;
  if (now >= capReset) {
    xpToday = 0;
    capReset = nextMidnight(now);
  }

  const base: XpHeartbeatOutcome = {
    ok: true, xp: row.xp_total, level: row.level, xpToday, dailyCap: config.xpDailyCap,
    leveledUp: false, newBadges: [], rewardKeysGranted: 0, capped: false,
  };

  if (hidden || !playing) return { ...base, ok: false };

  // Rate limit: ignore heartbeats arriving too fast
  if (now - row.last_heartbeat < (config.xpHeartbeatIntervalSec - 1) * 1000) {
    return base;
  }
  // Clamp claimed seconds to one interval window
  const grantedSec = Math.min(Math.max(seconds, 0), config.xpHeartbeatIntervalSec + 1);
  const gainedXp = grantedSec * config.xpPerSecond;

  // Daily cap
  const room = Math.max(0, config.xpDailyCap - xpToday);
  const actualXp = Math.min(gainedXp, room);
  const capped = actualXp < gainedXp;

  const newXpTotal = row.xp_total + actualXp;
  const newXpToday = xpToday + actualXp;
  const before = computeLevel(row.xp_total);
  const after = computeLevel(newXpTotal);
  const leveledUp = after.level > before.level;

  let rewardKeys = 0;
  const newBadges: string[] = [];
  if (leveledUp) {
    // +1 key every 5 levels crossed
    const crossed = [];
    for (let l = before.level + 1; l <= after.level; l++) crossed.push(l);
    rewardKeys = crossed.filter((l) => l % 5 === 0).length;
    if (rewardKeys > 0) grantKeys(userId, rewardKeys, "level_up_reward");
    const beforeBadges = new Set(badgesForLevel(before.level));
    newBadges.push(...badgesForLevel(after.level).filter((b) => !beforeBadges.has(b)));
  }

  db.prepare(
    "UPDATE xp SET xp_total = ?, level = ?, xp_today = ?, daily_cap_reset = ?, last_heartbeat = ? WHERE user_id = ?"
  ).run(newXpTotal, after.level, newXpToday, capReset, now, userId);

  return {
    ok: true,
    xp: newXpTotal,
    level: after.level,
    xpToday: newXpToday,
    dailyCap: config.xpDailyCap,
    leveledUp,
    newBadges,
    rewardKeysGranted: rewardKeys,
    capped,
  };
}

export function getXpStats(userId: string) {
  const db = getDb();
  const now = Date.now();
  const row = db.prepare("SELECT * FROM xp WHERE user_id = ?").get(userId) as any;
  if (!row) return null;
  let xpToday = row.xp_today;
  if (now >= row.daily_cap_reset) xpToday = 0;
  const lvl = computeLevel(row.xp_total);
  return {
    xp: row.xp_total,
    level: lvl.level,
    xpToday,
    dailyCap: config.xpDailyCap,
    xpToNext: lvl.xpToNext,
    progressPct: lvl.progressPct,
    badges: badgesForLevel(lvl.level),
  };
}
