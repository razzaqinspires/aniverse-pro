// GET /api/ratings?animeId= → {avg, count, userRating:{rating,review}|null}
// POST /api/ratings {animeId, rating(1-5), review?(max 500)} → upsert (1 user = 1 rating/anime)
import { NextRequest } from "next/server";
import { z } from "zod";
import { getStorage } from "@/lib/storage";
import { requireSession, apiOk, apiError, readJsonBody } from "@/lib/api-helpers";

function sanitize(text: string, max: number): string {
  return text.replace(/<[^>]*>/g, "").replace(/[\u0000-\u001F]/g, "").trim().slice(0, max);
}

const PostSchema = z.object({
  animeId: z.number().int().positive(),
  rating: z.number().int().min(1).max(5),
  review: z.string().max(500).optional(),
});

export async function GET(req: NextRequest) {
  const auth = await requireSession(req);
  if ("error" in auth) return auth.error;
  const url = new URL(req.url);
  const animeId = parseInt(url.searchParams.get("animeId") ?? "0", 10);
  if (!Number.isFinite(animeId) || animeId <= 0) return apiError(400, "animeId tidak valid");
  const storage = getStorage();
  const [summary, userRating] = await Promise.all([
    storage.getRatingSummary(animeId),
    storage.getUserRating(auth.userId, animeId),
  ]);
  return apiOk({ ...summary, userRating });
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(req);
  if ("error" in auth) return auth.error;
  let body: unknown;
  try { body = await readJsonBody(req); } catch { return apiError(400, "Data tidak valid"); }
  const parsed = PostSchema.safeParse(body);
  if (!parsed.success) return apiError(400, "Data tidak valid", { issues: parsed.error.issues });
  const { animeId, rating, review } = parsed.data;
  await getStorage().upsertRating(auth.userId, animeId, rating, sanitize(review ?? "", 500));
  const summary = await getStorage().getRatingSummary(animeId);
  return apiOk(summary);
}
