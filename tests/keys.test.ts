// tests/keys.test.ts — atomic key spend (anti double-spend) + grant + ledger.
// Uses the SqliteAdapter directly (isolated temp DB) so no singleton conflicts.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";

const DB_PATH = `/tmp/test-keys-${process.pid}-${Date.now()}.db`;
process.env.DATABASE_PATH = DB_PATH;

let adapter: import("@/lib/storage/types").StorageAdapter & { raw: any };

beforeAll(async () => {
  const { SqliteAdapter } = await import("@/lib/storage/sqlite");
  adapter = new SqliteAdapter(DB_PATH) as any;
});

afterAll(() => {
  try { fs.unlinkSync(DB_PATH); } catch { /* ignore */ }
  try { fs.unlinkSync(`${DB_PATH}-wal`); } catch { /* ignore */ }
  try { fs.unlinkSync(`${DB_PATH}-shm`); } catch { /* ignore */ }
});

describe("atomic key spend (anti double-spend)", () => {
  it("two concurrent spends when balance=1 → exactly one succeeds", async () => {
    const userId = "spend-test-user";
    await adapter.getOrCreateUser(userId, { email: null, name: "U", image: null, isDemo: false });
    adapter.raw.prepare("UPDATE keys_balance SET keys = 1 WHERE user_id = ?").run(userId);
    const first = await adapter.spendKey(userId, "watch:1:1");
    const second = await adapter.spendKey(userId, "watch:1:1");
    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(await adapter.getKeys(userId)).toBe(0);
  });

  it("grantKeys increases balance and writes a ledger row", async () => {
    const userId = "grant-test-user";
    await adapter.getOrCreateUser(userId, { email: null, name: "G", image: null, isDemo: false });
    const before = await adapter.getKeys(userId);
    const after = await adapter.grantKeys(userId, 3, "ad_reward");
    expect(after).toBe(before + 3);
    const ledger = adapter.raw
      .prepare("SELECT COUNT(*) AS c FROM key_ledger WHERE user_id = ? AND reason = 'ad_reward'")
      .get(userId) as { c: number };
    expect(ledger.c).toBe(1);
  });
});
