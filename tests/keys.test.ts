// tests/keys.test.ts — atomic key spend + grant/ledger.
// Isolated temp DB: set env BEFORE dynamic import (vi.resetModules clears the cache so
// config.ts re-reads process.env and getDb() opens a fresh file).
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import fs from "node:fs";

const DB_PATH = `/tmp/test-keys-${process.pid}-${Date.now()}.db`;
process.env.DATABASE_PATH = DB_PATH;
process.env.STARTING_KEYS = "1"; // balance starts at exactly 1 for the atomic test

let db: typeof import("@/lib/db");
let keys: typeof import("@/lib/keys");

beforeAll(async () => {
  vi.resetModules();
  db = await import("@/lib/db");
  keys = await import("@/lib/keys");
  db.getDb(); // initialize schema + connection
});

afterAll(() => {
  try { fs.unlinkSync(DB_PATH); } catch { /* ignore */ }
  try { fs.unlinkSync(`${DB_PATH}-wal`); } catch { /* ignore */ }
  try { fs.unlinkSync(`${DB_PATH}-shm`); } catch { /* ignore */ }
});

describe("spendKey atomicity (anti double-spend)", () => {
  it("two synchronous spends when balance=1 → exactly one succeeds", () => {
    const userId = "atomic-user";
    db.getOrCreateUser(userId, { email: null, name: "Atomic", image: null, isDemo: false });
    expect(keys.getKeys(userId)).toBe(1);

    // better-sqlite3 is synchronous; calling twice in the same tick simulates the
    // concurrent double-spend race. The UPDATE ... WHERE keys > 0 guard makes the
    // second call affect 0 rows.
    const first = keys.spendKey(userId, "watch:1:1");
    const second = keys.spendKey(userId, "watch:1:1");

    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(keys.getKeys(userId)).toBe(0);
  });
});

describe("grantKeys", () => {
  it("increases balance and writes a ledger row", () => {
    const userId = "grant-user";
    db.getOrCreateUser(userId, { email: null, name: "Grant", image: null, isDemo: false });
    const before = keys.getKeys(userId); // STARTING_KEYS = 1

    const after = keys.grantKeys(userId, 5, "test_grant");
    expect(after).toBe(before + 5);
    expect(keys.getKeys(userId)).toBe(before + 5);

    const rows = db
      .getDb()
      .prepare("SELECT delta, reason FROM key_ledger WHERE user_id = ? ORDER BY id")
      .all(userId) as { delta: number; reason: string }[];

    const grantRow = rows.find((r) => r.reason === "test_grant");
    expect(grantRow).toBeDefined();
    expect(grantRow?.delta).toBe(5);
    // initial balance ledger entry must also exist
    expect(rows.some((r) => r.reason === "initial_balance")).toBe(true);
  });
});
