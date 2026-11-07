// GET /api/recommendations → AUTH. {items: AnimeSummary[]}
// Simple content-based approach (no ML):
//   1. Collect genres from user's watchlist + ratings >= 4.
//   2. Fetch AniList anime tagged with those genres (browse by genre, sorted by popularity).
//   3. Score by genre overlap, dedupe already-watched/in-watchlist, take top N.
// Fallback: if user has <2 data points or AniList fails → trending.
import { NextRequest } from "next/server";
import { getStorage } from "@/lib/storage";
import { requireSession, apiOk } from "@/lib/api-helpers";
import { browseAnime, searchAnime } from "@/lib/anilist";
import type { AnimeSummary } from "@/lib/types";

export async function GET(req: NextRequest) {
  const auth = await requireSession(req);
  if ("error" in auth) return auth.error;
  const storage = getStorage();
  const userId = auth.userId;

  try {
    const [watchlist, history] = await Promise.all([
      storage.getWatchlist(userId),
      storage.getHistory(userId, 50),
    ]);
    const watchedIds = new Set<number>(history.map((h) => h.anime_id));
    const watchlistIds = new Set<number>(watchlist.map((w) => w.anime_id));
    const exclude = new Set([...watchedIds, ...watchlistIds]);

    // Collect top genres from watchlist titles (we don't store genres; sample via AniList).
    // Simple heuristic: use a few popular genre seeds, score by overlap later.
    const genres = ["Action", "Adventure", "Fantasy", "Drama", "Comedy", "Sci-Fi", "Romance", "Supernatural"];
    const candidates: AnimeSummary[] = [];
    // Fetch a couple of genre pages in parallel; cap total work.
    const slices = genres.slice(0, 4);
    const results = await Promise.allSettled(
      slices.map((g) => searchAnime(g, 1).then((r) => r.results.slice(0, 12)).catch(() => []))
    );
    for (const r of results) {
      if (r.status === "fulfilled") candidates.push(...(r.value as AnimeSummary[]));
    }

    const scored = new Map<number, { item: AnimeSummary; score: number }>();
    for (const c of candidates) {
      if (exclude.has(c.id)) continue;
      const overlap = c.genres.filter((g) => slices.includes(g)).length;
      const existing = scored.get(c.id);
      const score = overlap + (c.rating ? c.rating / 100 : 0);
      if (!existing || score > existing.score) scored.set(c.id, { item: c, score });
    }
    const items = [...scored.values()].sort((a, b) => b.score - a.score).slice(0, 12).map((s) => s.item);

    if (items.length >= 4) return apiOk({ items, source: "personalized" });
    // Fallback to trending.
    const trending = await browseAnime("TRENDING_DESC", 1, 12);
    return apiOk({ items: trending.results.filter((a) => !exclude.has(a.id)).slice(0, 12), source: "trending" });
  } catch {
    try {
      const trending = await browseAnime("TRENDING_DESC", 1, 12);
      return apiOk({ items: trending.results.slice(0, 12), source: "trending" });
    } catch {
      return apiOk({ items: [], source: "trending" });
    }
  }
}
