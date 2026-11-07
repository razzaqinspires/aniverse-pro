// tests/auth.test.ts — demo user constant, authOptions shape, user provisioning via adapter.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";

const DB_PATH = `/tmp/test-auth-${process.pid}-${Date.now()}.db`;
process.env.DATABASE_PATH = DB_PATH;

let adapter: import("@/lib/storage/types").StorageAdapter & { raw: any };
let auth: typeof import("@/lib/auth");

beforeAll(async () => {
  const { SqliteAdapter } = await import("@/lib/storage/sqlite");
  adapter = new SqliteAdapter(DB_PATH) as any;
  auth = await import("@/lib/auth");
});

afterAll(() => {
  try { fs.unlinkSync(DB_PATH); } catch { /* ignore */ }
  try { fs.unlinkSync(`${DB_PATH}-wal`); } catch { /* ignore */ }
  try { fs.unlinkSync(`${DB_PATH}-shm`); } catch { /* ignore */ }
});

describe("auth constants", () => {
  it("DEMO_USER_ID is the stable demo identifier", () => {
    expect(auth.DEMO_USER_ID).toBe("demo-user");
    expect(auth.getDemoUserId()).toBe("demo-user");
  });

  it("authOptions exposes a demo credentials provider and JWT session", () => {
    expect(Array.isArray(auth.authOptions.providers)).toBe(true);
    expect(auth.authOptions.providers.length).toBeGreaterThanOrEqual(1);
    const providers = auth.authOptions.providers as Array<{ id?: string; options?: { id?: string } }>;
    const hasDemo = providers.some((p) => p.id === "demo" || p.options?.id === "demo");
    expect(hasDemo).toBe(true);
    expect((auth.authOptions.session as { strategy?: string })?.strategy).toBe("jwt");
  });
});

describe("getOrCreateUser provisioning", () => {
  it("is idempotent: repeated calls create exactly one user row", async () => {
    const userId = "auth-test-user";
    const before = (adapter.raw.prepare("SELECT COUNT(*) AS c FROM users WHERE id = ?").get(userId) as { c: number }).c;
    await adapter.getOrCreateUser(userId, { email: "a@b.c", name: "A", image: null, isDemo: false });
    await adapter.getOrCreateUser(userId, { email: "a@b.c", name: "A", image: null, isDemo: false });
    const after = (adapter.raw.prepare("SELECT COUNT(*) AS c FROM users WHERE id = ?").get(userId) as { c: number }).c;
    expect(after).toBe(before + 1);
  });

  it("creates keys_balance (starting keys) and xp (level 1) rows", async () => {
    const userId = "auth-provision-user";
    await adapter.getOrCreateUser(userId, { email: null, name: "P", image: null, isDemo: true });
    expect(await adapter.getKeys(userId)).toBeGreaterThan(0);
    const xpRow = await adapter.getXp(userId);
    expect(xpRow?.level).toBe(1);
    expect(xpRow?.xp_total).toBe(0);
    expect((await adapter.getUser(userId))?.is_demo).toBe(1);
  });
});
