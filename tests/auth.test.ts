// tests/auth.test.ts — NextAuth config shape, demo user constant, user provisioning idempotency.
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import fs from "node:fs";

const DB_PATH = `/tmp/test-auth-${process.pid}-${Date.now()}.db`;
process.env.DATABASE_PATH = DB_PATH;

let db: typeof import("@/lib/db");
let auth: typeof import("@/lib/auth");

beforeAll(async () => {
  vi.resetModules();
  db = await import("@/lib/db");
  auth = await import("@/lib/auth");
  db.getDb();
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
    // next-auth v4 shims providers with default id/name at top level and stores
    // user overrides under .options; core merges them at runtime (parseProviders),
    // so signIn("demo") resolves correctly. Accept either location.
    const hasDemo = providers.some((p) => p.id === "demo" || p.options?.id === "demo");
    expect(hasDemo).toBe(true);
    expect((auth.authOptions.session as { strategy?: string })?.strategy).toBe("jwt");
  });
});

describe("getOrCreateUser provisioning", () => {
  it("is idempotent: repeated calls create exactly one user row", () => {
    const userId = "auth-test-user";
    const countSql = "SELECT COUNT(*) AS c FROM users WHERE id = ?";
    const before = db.getDb().prepare(countSql).get(userId) as { c: number };

    db.getOrCreateUser(userId, { email: "a@b.c", name: "A", image: null, isDemo: false });
    db.getOrCreateUser(userId, { email: "a@b.c", name: "A", image: null, isDemo: false });

    const after = db.getDb().prepare(countSql).get(userId) as { c: number };
    expect(after.c).toBe(before.c + 1);
  });

  it("creates keys_balance (starting keys) and xp (level 1) rows", () => {
    const userId = "auth-provision-user";
    db.getOrCreateUser(userId, { email: null, name: "P", image: null, isDemo: true });

    const kb = db.getDb().prepare("SELECT keys FROM keys_balance WHERE user_id = ?").get(userId) as
      | { keys: number }
      | undefined;
    expect(kb).toBeDefined();
    expect(kb!.keys).toBeGreaterThan(0);

    const xpRow = db.getDb().prepare("SELECT level, xp_total FROM xp WHERE user_id = ?").get(userId) as
      | { level: number; xp_total: number }
      | undefined;
    expect(xpRow).toBeDefined();
    expect(xpRow!.level).toBe(1);
    expect(xpRow!.xp_total).toBe(0);

    const userRow = db.getDb().prepare("SELECT is_demo FROM users WHERE id = ?").get(userId) as
      | { is_demo: number }
      | undefined;
    expect(userRow?.is_demo).toBe(1);
  });
});
