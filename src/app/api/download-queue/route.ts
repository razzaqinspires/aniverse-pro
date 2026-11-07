// GET /api/download-queue → {items:[{animeId,ep,title,image,createdAt}]}
// POST /api/download-queue {animeId, ep, title, image} → upsert (tonton-nanti queue)
// DELETE /api/download-queue?animeId=&ep= → remove
// Catatan: ini adalah "Queue Tonton Nanti". Download asli hanya tersedia untuk Server Demo
// (mp4 publik) via anchor <a download> di UI; stream m3u8/CORS tidak bisa di-download dari browser.
import { NextRequest } from "next/server";
import { z } from "zod";
import { getStorage } from "@/lib/storage";
import { requireSession, apiOk, apiError, readJsonBody } from "@/lib/api-helpers";

const PostSchema = z.object({
  animeId: z.number().int().positive(),
  ep: z.number().int().positive(),
  title: z.string().min(1),
  image: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const auth = await requireSession(req);
  if ("error" in auth) return auth.error;
  const rows = await getStorage().getDownloadQueue(auth.userId);
  const items = rows.map((r) => ({
    animeId: r.anime_id, ep: r.ep, title: r.title, image: r.image, createdAt: r.created_at,
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
  const { animeId, ep, title, image } = parsed.data;
  await getStorage().upsertDownloadQueue(auth.userId, animeId, ep, title, image ?? "");
  return apiOk({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireSession(req);
  if ("error" in auth) return auth.error;
  const url = new URL(req.url);
  const animeId = parseInt(url.searchParams.get("animeId") ?? "0", 10);
  const ep = parseInt(url.searchParams.get("ep") ?? "0", 10);
  if (!Number.isFinite(animeId) || animeId <= 0 || !Number.isFinite(ep) || ep <= 0) {
    return apiError(400, "Parameter animeId/ep tidak valid");
  }
  await getStorage().removeFromDownloadQueue(auth.userId, animeId, ep);
  return apiOk({ ok: true });
}
