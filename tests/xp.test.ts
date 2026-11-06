// tests/xp.test.ts — XP daily cap, hidden-tab rejection, level curve.
// XP_DAILY_CAP=100, XP_PER_SECOND=1 via env. Heartbeat rate-limit (5s window) is bypassed
// in tests by resetting last_heartbeat to 0 directly between calls.
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import fs from "node:fs";

const DB_PATH = `/tmp/test-xp-${process.pid}-${Date.now()}.db`;
process.env.DATABASE_PATH = DB_PATH;
process.env.XP_DAILY_CAP = "100";
process.env.XP_PER_SECOND = "1";

let db: typeof import("@/lib/db");
let xp: typeof import("@/lib/xp");

beforeAll(async () => {
  vi.resetModules();
  db = await import("@/lib/db");
  xp = await import("@/lib/xp");
  db.getDb();
});

afterAll(() => {
  try { fs.unlinkSync(DB_PATH); } catch { /* ignore */ }
  try { fs.unlinkSync(`${DB_PATH}-wal`); } catch { /* ignore */ }
  try { fs.unlinkSync(`${DB_PATH}-shm`); } catch { /* ignore */ }
});

function resetHeartbeat(userId: string) {
  db.getDb().prepare("UPDATE xp SET last_heartbeat = 0 WHERE user_id = ?").run(userId);
}

describe("XP daily cap", () => {
  it("caps xpToday at XP_DAILY_CAP and reports capped=true", () => {
    const userId = "cap-user";
    db.getOrCreateUser(userId, { email: null, name: "Cap", image: null, isDemo: false });

    let last = xp.applyXpHeartbeat(userId, 6, false, true); // max 6 xp/call
    let iterations = 0;
    while (!last.capped && iterations < 50) {
      resetHeartbeat(userId);
      last = xp.applyXpHeartbeat(userId, 6, false, true);
      iterations++;
    }

    expect(last.capped).toBe(true);
    expect(last.xpToday).toBeLessThanOrEqual(100);
    expect(last.xpToday).toBeGreaterThan(0);

    // One more heartbeat after cap: gains nothing, stays under cap.
    resetHeartbeat(userId);
    const beyond = xp.applyXpHeartbeat(userId, 6, false, true);
    expect(beyond.xpToday).toBeLessThanOrEqual(100);
    expect(beyond.xp).toBe(last.xp);
  });
});

describe("hidden tab heartbeat", () => {
  it("returns ok:false and adds no XP", () => {
    const userId = "hidden-user";
    db.getOrCreateUser(userId, { email: null, name: "Hidden", image: null, isDemo: false });
    resetHeartbeat(userId);

    const before = xp.getXpStats(userId);
    const result = xp.applyXpHeartbeat(userId, 5, true, true); // hidden=true

    expect(result.ok).toBe(false);
    expect(result.xp).toBe(before?.xp ?? 0);

    const after = xp.getXpStats(userId);
    expect(after?.xp).toBe(before?.xp ?? 0);
    expect(after?.xpToday).toBe(0);
  });
});

describe("computeLevel curve", () => {
  it("xp=0 → level 1; xp=100 → level 2 (gap level1 = 100*1^2 = 100)", () => {
    expect(xp.computeLevel(0).level).toBe(1);
    expect(xp.computeLevel(99).level).toBe(1);
    expect(xp.computeLevel(100).level).toBe(2);
    // gap to level 3 = 100*2^2 = 400, so 100+399=499 still level 2, 500 → level 3
    expect(xp.computeLevel(499).level).toBe(2);
    expect(xp.computeLevel(500).level).toBe(3);
  });
});
