// GET /api/history → AUTH. { ok:true, items: HistoryItem[] } (updated_at DESC, limit 50).
// POST /api/history → AUTH. Body { animeId, ep, title, image, progress? }. UPSERT.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { requireSession, apiOk, apiError, readJsonBody } from "@/lib/api-helpers";
import type { HistoryItem } from "@/lib/types";

const PostSchema = z.object({
  animeId: z.number().int().positive(),
  ep: z.number().int().positive(),
  title: z.string().min(1),
  image: z.string().min(1),
  progress: z.number().int().min(0).optional(),
});

interface HistoryRow {
  id: number;
  anime_id: number;
  ep: number;
  title: string;
  image: string;
  progress: number;
  updated_at: number;
}

export async function GET(req: NextRequest) {
  const auth = await requireSession(req);
  if ("error" in auth) return auth.error;

  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, anime_id, ep, title, image, progress, updated_at
       FROM watch_history
       WHERE user_id = ?
       ORDER BY updated_at DESC
       LIMIT 50`
    )
    .all(auth.userId) as HistoryRow[];

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

  const db = getDb();
  const now = Date.now();
  db.prepare(
    `INSERT INTO watch_history (user_id, anime_id, ep, title, image, progress, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, anime_id, ep) DO UPDATE SET
       progress = excluded.progress,
       title = excluded.title,
       image = excluded.image,
       updated_at = excluded.updated_at`
  ).run(userId, animeId, ep, title, image, progress ?? 0, now);

  return NextResponse.json({ ok: true }, { status: 200 });
}
