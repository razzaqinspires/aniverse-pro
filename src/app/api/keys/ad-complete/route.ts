// POST /api/keys/ad-complete → AUTH. Body { watchId }. Claims ad reward after full watch.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { completeAd } from "@/lib/keys";
import { requireSession, apiOk, apiError, readJsonBody } from "@/lib/api-helpers";

const BodySchema = z.object({
  watchId: z.string().min(1),
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

  const result = await completeAd(parsed.data.watchId, userId);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, reason: result.reason ?? "Gagal mengklaim hadiah iklan", keys: result.keys },
      { status: 400 }
    );
  }
  return apiOk({ granted: result.granted, keys: result.keys });
}
