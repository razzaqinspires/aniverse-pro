// POST /api/keys/spend → AUTH. Body { animeId, ep, title?, image? }. Atomic key spend.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { spendKey, getKeys } from "@/lib/keys";
import { requireSession, apiOk, apiError, readJsonBody } from "@/lib/api-helpers";

const BodySchema = z.object({
  animeId: z.number().int().positive(),
  ep: z.number().int().positive(),
  title: z.string().optional(),
  image: z.string().optional(),
});

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
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "Data tidak valid", { issues: parsed.error.issues });
  }
  const { animeId, ep } = parsed.data;

  const spent = spendKey(userId, `watch:${animeId}:${ep}`);
  if (!spent) {
    return NextResponse.json(
      { ok: false, keys: 0, reason: "Kunci tidak mencukupi", needAd: true },
      { status: 402 }
    );
  }
  return apiOk({ keys: getKeys(userId) });
}
