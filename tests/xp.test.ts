// tests/xp.test.ts — level curve (pure), daily XP cap, hidden-tab rejection.
// Uses SqliteAdapter directly + resets last_heartbeat between heartbeats.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";

process.env.XP_DAILY_CAP = "100";
process.env.XP_PER_SECOND = "1";
const DB_PATH = `/tmp/test-xp-${process.pid}-${Date.now()}.db`;
process.env.DATABASE_PATH = DB_PATH;

let adapter: import("@/lib/storage/types").StorageAdapter;
let xp: typeof import("@/lib/xp");

beforeAll(async () => {
  const { SqliteAdapter } = await import("@/lib/storage/sqlite");
  adapter = new SqliteAdapter(DB_PATH);
  xp = await import("@/lib/xp");
});

afterAll(() => {
  try { fs.unlinkSync(DB_PATH); } catch { /* ignore */ }
  try { fs.unlinkSync(`${DB_PATH}-wal`); } catch { /* ignore */ }
  try { fs.unlinkSync(`${DB_PATH}-shm`); } catch { /* ignore */ }
});

describe("computeLevel curve", () => {
  it("level boundaries follow 100*L^2 gap", () => {
    expect(xp.computeLevel(0).level).toBe(1);
    expect(xp.computeLevel(99).level).toBe(1);
    expect(xp.computeLevel(100).level).toBe(2); // gap(1)=100
    expect(xp.computeLevel(100 + 400).level).toBe(3); // gap(2)=400 → total 500
  });
});

describe("applyXpHeartbeat anti-farming", () => {
  it("hidden tab heartbeat is rejected (ok:false) and adds no XP", async () => {
    const userId = "xp-hidden-user";
    await adapter.getOrCreateUser(userId, { email: null, name: "H", image: null, isDemo: false });
    const before = await adapter.getXp(userId);
    const out = await xp.applyXpHeartbeat(userId, 5, true, true);
    expect(out.ok).toBe(false);
    const after = await adapter.getXp(userId);
    expect(after?.xp_total).toBe(before?.xp_total);
  });

  it("daily cap is enforced (capped=true, xpToday <= cap)", async () => {
    const userId = "xp-cap-user";
    await adapter.getOrCreateUser(userId, { email: null, name: "C", image: null, isDemo: false });
    let capped = false;
    for (let i = 0; i < 40; i++) {
      await adapter.updateXp(userId, { last_heartbeat: 0 });
      const out = await xp.applyXpHeartbeat(userId, 5, false, true);
      if (out.capped) { capped = true; break; }
    }
    expect(capped).toBe(true);
    const row = await adapter.getXp(userId);
    expect(row!.xp_today).toBeLessThanOrEqual(100);
  });
});
