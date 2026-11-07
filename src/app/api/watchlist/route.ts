// GET /api/watchlist?status=all|watching|completed|plan_to_watch → {items:[{animeId,title,image,status,updatedAt}]}
// POST /api/watchlist {animeId, status, title?, image?} → upsert (1 user = 1 row/anime)
// DELETE /api/watchlist?animeId= → remove
import { NextRequest } from "next/server";
import { z } from "zod";
import { getStorage } from "@/lib/storage";
import { requireSession, apiOk, apiError, readJsonBody } from "@/lib/api-helpers";
import type { WatchlistStatus } from "@/lib/storage/types";

const STATUS = ["plan_to_watch", "watching", "completed"] as const;
const PostSchema = z.object({
  animeId: z.number().int().positive(),
  status: z.enum(STATUS),
  title: z.string().optional(),
  image: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const auth = await requireSession(req);
  if ("error" in auth) return auth.error;
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const valid = status && STATUS.includes(status as WatchlistStatus) ? (status as WatchlistStatus) : undefined;
  const rows = await getStorage().getWatchlist(auth.userId, valid);
  const items = rows.map((r) => ({
    animeId: r.anime_id, title: r.title, image: r.image, status: r.status, updatedAt: r.updated_at,
  }));
  return apiOk({ items });
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(req);
  if ("error" in auth) return auth.error;
  let body: unknown;
  try { body = await readJsonBody(req); } catch { return apiError(400, "Data tidak valid"); }
  const parsed = PostSchema.safeParse(body);
  if (!parsed.success) return apiError(400, "Data tidak valid", { issues: parsed.error.issues });
  const { animeId, status, title, image } = parsed.data;
  await getStorage().upsertWatchlist(auth.userId, animeId, status, title ?? "", image ?? "");
  return apiOk({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireSession(req);
  if ("error" in auth) return auth.error;
  const url = new URL(req.url);
  const animeId = parseInt(url.searchParams.get("animeId") ?? "0", 10);
  if (!Number.isFinite(animeId) || animeId <= 0) return apiError(400, "animeId tidak valid");
  await getStorage().removeFromWatchlist(auth.userId, animeId);
  return apiOk({ ok: true });
}
