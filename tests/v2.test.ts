// tests/v2.test.ts — watchlist add/remove, rating upsert (1 user 1 rating),
// progress (history) upsert, download queue. Uses SqliteAdapter directly.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";

const DB_PATH = `/tmp/test-v2-${process.pid}-${Date.now()}.db`;
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

describe("watchlist", () => {
  it("add then remove — upsert is idempotent per (user, anime)", async () => {
    const u = "wl-user";
    await adapter.getOrCreateUser(u, { email: null, name: "W", image: null, isDemo: false });
    await adapter.upsertWatchlist(u, 100, "plan_to_watch", "Anime A", "imgA");
    await adapter.upsertWatchlist(u, 100, "watching", "Anime A", "imgA"); // status change, same row
    const list = await adapter.getWatchlist(u);
    expect(list.length).toBe(1);
    expect(list[0].status).toBe("watching");
    expect(list[0].title).toBe("Anime A");
    await adapter.removeFromWatchlist(u, 100);
    expect((await adapter.getWatchlist(u)).length).toBe(0);
  });

  it("filter by status works", async () => {
    const u = "wl-filter-user";
    await adapter.getOrCreateUser(u, { email: null, name: "WF", image: null, isDemo: false });
    await adapter.upsertWatchlist(u, 1, "watching", "A", "");
    await adapter.upsertWatchlist(u, 2, "completed", "B", "");
    expect((await adapter.getWatchlist(u, "watching")).length).toBe(1);
    expect((await adapter.getWatchlist(u, "completed")).length).toBe(1);
    expect((await adapter.getWatchlist(u)).length).toBe(2);
  });
});

describe("ratings (1 user = 1 rating/anime, upsert)", () => {
  it("second rating overwrites the first, avg reflects it", async () => {
    const u = "rate-user";
    await adapter.getOrCreateUser(u, { email: null, name: "R", image: null, isDemo: false });
    await adapter.upsertRating(u, 500, 5, "bagus");
    await adapter.upsertRating(u, 500, 3, "biasa aja"); // overwrite
    const urs = await adapter.getUserRating(u, 500);
    expect(urs?.rating).toBe(3);
    expect(urs?.review_text).toBe("biasa aja");
    const summary = await adapter.getRatingSummary(500);
    expect(summary.count).toBe(1);
    expect(summary.avg).toBe(3);
  });
});

describe("progress (history) upsert", () => {
  it("same anime+ep updates progress instead of duplicate row", async () => {
    const u = "prog-user";
    await adapter.getOrCreateUser(u, { email: null, name: "P", image: null, isDemo: false });
    await adapter.upsertHistory(u, { anime_id: 7, ep: 2, title: "T", image: "i", progress: 100 });
    await adapter.upsertHistory(u, { anime_id: 7, ep: 2, title: "T", image: "i", progress: 250 });
    const hist = await adapter.getHistory(u, 50);
    const row = hist.find((h) => h.anime_id === 7 && h.ep === 2);
    expect(row?.progress).toBe(250);
    expect(hist.filter((h) => h.anime_id === 7 && h.ep === 2).length).toBe(1);
  });
});

describe("download queue", () => {
  it("add then remove works, upsert per (user, anime, ep)", async () => {
    const u = "dl-user";
    await adapter.getOrCreateUser(u, { email: null, name: "D", image: null, isDemo: false });
    await adapter.upsertDownloadQueue(u, 9, 1, "T", "i");
    await adapter.upsertDownloadQueue(u, 9, 1, "T", "i"); // idempotent
    expect((await adapter.getDownloadQueue(u)).length).toBe(1);
    await adapter.removeFromDownloadQueue(u, 9, 1);
    expect((await adapter.getDownloadQueue(u)).length).toBe(0);
  });
});

describe("user meta KV", () => {
  it("set then get returns value, null if missing", async () => {
    const u = "meta-user";
    await adapter.getOrCreateUser(u, { email: null, name: "M", image: null, isDemo: false });
    expect(await adapter.getUserMeta(u, "k")).toBeNull();
    await adapter.setUserMeta(u, "k", "v1");
    expect(await adapter.getUserMeta(u, "k")).toBe("v1");
    await adapter.setUserMeta(u, "k", "v2");
    expect(await adapter.getUserMeta(u, "k")).toBe("v2");
  });
});
