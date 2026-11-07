// GET /api/comments?animeId=&ep= → {items:[{id,userId,name,image,isDemo,text,createdAt}]}
// POST /api/comments {animeId, ep, text(max 500, sanitized)} → {ok, id}
import { NextRequest } from "next/server";
import { z } from "zod";
import { getStorage } from "@/lib/storage";
import { requireSession, apiOk, apiError, readJsonBody } from "@/lib/api-helpers";

function sanitize(text: string, max: number): string {
  return text.replace(/<[^>]*>/g, "").replace(/[\u0000-\u001F]/g, "").trim().slice(0, max);
}

const PostSchema = z.object({
  animeId: z.number().int().positive(),
  ep: z.number().int().positive(),
  text: z.string().min(1).max(500),
});

export async function GET(req: NextRequest) {
  const auth = await requireSession(req);
  if ("error" in auth) return auth.error;
  const url = new URL(req.url);
  const animeId = parseInt(url.searchParams.get("animeId") ?? "0", 10);
  const ep = parseInt(url.searchParams.get("ep") ?? "0", 10);
  if (!Number.isFinite(animeId) || animeId <= 0 || !Number.isFinite(ep) || ep <= 0) {
    return apiError(400, "Parameter animeId/ep tidak valid");
  }
  const rows = await getStorage().getComments(animeId, ep, 100);
  const items = rows.map((r) => ({
    id: r.id, userId: r.user_id, name: r.name, image: r.image, isDemo: r.is_demo === 1,
    text: r.text, createdAt: r.created_at,
  }));
  return apiOk({ items });
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(req);
  if ("error" in auth) return auth.error;
  let body: unknown;
  try { body = await readJsonBody(req); } catch { return apiError(400, "Data tidak valid"); }
  const parsed = PostSchema.safeParse(body);
  if (!parsed.success) return apiError(400, "Komentar tidak valid (maks 500 karakter)", { issues: parsed.error.issues });
  const clean = sanitize(parsed.data.text, 500);
  if (!clean) return apiError(400, "Komentar tidak boleh kosong");
  const id = await getStorage().addComment(auth.userId, parsed.data.animeId, parsed.data.ep, clean);
  return apiOk({ ok: true, id });
}
