// XP & level business logic. Storage-agnostic — persistence via StorageAdapter.
// Level curve: to advance from level L to L+1 requires 100 * L^2 XP (cumulative sum).
// Reward: +1 key every 5 levels + badge. Anti-farming: server validates rate, hidden-tab
// rejection, and daily XP cap.

import { getStorage } from "./storage";
import { grantKeys } from "./keys";
import { config, nextMidnightFrom } from "./config";

export function xpForLevelGap(level: number): number {
  return 100 * level * level;
}

export function computeLevel(xpTotal: number): { level: number; xpInLevel: number; xpToNext: number; progressPct: number } {
  let level = 1;
  let remaining = xpTotal;
  while (remaining >= xpForLevelGap(level)) {
    remaining -= xpForLevelGap(level);
    level++;
    if (level > 1000) break;
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

export async function applyXpHeartbeat(
  userId: string,
  seconds: number,
  hidden: boolean,
  playing: boolean
): Promise<XpHeartbeatOutcome> {
  const storage = getStorage();
  const now = Date.now();
  const row = await storage.getXp(userId);
  if (!row) {
    return { ok: false, xp: 0, level: 1, xpToday: 0, dailyCap: config.xpDailyCap, leveledUp: false, newBadges: [], rewardKeysGranted: 0, capped: false };
  }

  let xpToday = row.xp_today;
  let capReset = row.daily_cap_reset;
  if (now >= capReset) {
    xpToday = 0;
    capReset = nextMidnightFrom(now);
  }

  const base: XpHeartbeatOutcome = {
    ok: true, xp: row.xp_total, level: row.level, xpToday, dailyCap: config.xpDailyCap,
    leveledUp: false, newBadges: [], rewardKeysGranted: 0, capped: false,
  };

  if (hidden || !playing) return { ...base, ok: false };

  // Rate limit: ignore heartbeats arriving faster than the configured interval.
  if (now - row.last_heartbeat < (config.xpHeartbeatIntervalSec - 1) * 1000) {
    return base;
  }
  const grantedSec = Math.min(Math.max(seconds, 0), config.xpHeartbeatIntervalSec + 1);
  const gainedXp = grantedSec * config.xpPerSecond;
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
    const crossed: number[] = [];
    for (let l = before.level + 1; l <= after.level; l++) crossed.push(l);
    rewardKeys = crossed.filter((l) => l % 5 === 0).length;
    if (rewardKeys > 0) await grantKeys(userId, rewardKeys, "level_up_reward");
    const beforeBadges = new Set(badgesForLevel(before.level));
    newBadges.push(...badgesForLevel(after.level).filter((b) => !beforeBadges.has(b)));
  }

  await storage.updateXp(userId, {
    xp_total: newXpTotal,
    level: after.level,
    xp_today: newXpToday,
    daily_cap_reset: capReset,
    last_heartbeat: now,
  });

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

export async function getXpStats(userId: string) {
  const storage = getStorage();
  const now = Date.now();
  const row = await storage.getXp(userId);
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
