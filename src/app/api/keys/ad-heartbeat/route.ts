// POST /api/keys/ad-heartbeat → AUTH. Body { watchId, progress, hidden }.
import { NextRequest } from "next/server";
import { z } from "zod";
import { heartbeatAd } from "@/lib/keys";
import { requireSession, apiOk, apiError, readJsonBody } from "@/lib/api-helpers";

const BodySchema = z.object({
  watchId: z.string().min(1),
  progress: z.number().min(0),
  hidden: z.boolean(),
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
  const { watchId, progress, hidden } = parsed.data;

  const result = heartbeatAd(watchId, userId, progress, hidden);
  if (!result.ok) {
    return apiError(400, result.resetReason ?? "Gagal memproses heartbeat iklan");
  }
  return apiOk({
    progress: result.progress,
    reset: result.reset,
    ...(result.resetReason ? { resetReason: result.resetReason } : {}),
  });
}
