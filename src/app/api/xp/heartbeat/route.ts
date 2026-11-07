// POST /api/xp/heartbeat → AUTH. Body { seconds (clamp 0-10), hidden, playing }.
// Always returns 200 with the outcome object (outcome.ok may be false).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { applyXpHeartbeat } from "@/lib/xp";
import { requireSession, apiError, readJsonBody } from "@/lib/api-helpers";

const BodySchema = z.object({
  seconds: z.number(),
  hidden: z.boolean(),
  playing: z.boolean(),
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
  const seconds = Math.min(Math.max(parsed.data.seconds, 0), 10);

  const outcome = await applyXpHeartbeat(userId, seconds, parsed.data.hidden, parsed.data.playing);
  return NextResponse.json(outcome, { status: 200 });
}
