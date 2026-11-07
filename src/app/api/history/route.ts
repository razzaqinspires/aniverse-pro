// GET /api/history → AUTH. { ok:true, items: HistoryItem[] } (updated_at DESC, limit 50).
// POST /api/history → AUTH. Body { animeId, ep, title, image, progress? }. UPSERT.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getStorage } from "@/lib/storage";
import { requireSession, apiOk, apiError, readJsonBody } from "@/lib/api-helpers";
import type { HistoryItem } from "@/lib/types";

const PostSchema = z.object({
  animeId: z.number().int().positive(),
  ep: z.number().int().positive(),
  title: z.string().min(1),
  image: z.string().min(1),
  progress: z.number().int().min(0).optional(),
});

export async function GET(req: NextRequest) {
  const auth = await requireSession(req);
  if ("error" in auth) return auth.error;
  const rows = await getStorage().getHistory(auth.userId, 50);
  const items: HistoryItem[] = rows.map((r) => ({
    id: r.id,
    animeId: r.anime_id,
    ep: r.ep,
    title: r.title,
    image: r.image,
    progress: r.progress,
    updatedAt: r.updated_at,
  }));
  return apiOk({ items });
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(req);
  if ("error" in auth) return auth.error;
  const { userId } = auth;
  let body: unknown;
  try {
    body = await readJsonBody(req);
  } catch {
    return apiError(400, "Data tidak valid");
  }
  const parsed = PostSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "Data tidak valid", { issues: parsed.error.issues });
  }
  const { animeId, ep, title, image, progress } = parsed.data;
  await getStorage().upsertHistory(userId, {
    anime_id: animeId,
    ep,
    title,
    image,
    progress: progress ?? 0,
  });
  return NextResponse.json({ ok: true }, { status: 200 });
}
