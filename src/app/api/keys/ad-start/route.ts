// POST /api/keys/ad-start → AUTH. Starts a rewarded-ad session.
import { NextRequest } from "next/server";
import { startAdSession } from "@/lib/keys";
import { config } from "@/lib/config";
import { requireSession, apiOk } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  const auth = await requireSession(req);
  if ("error" in auth) return auth.error;

  const watchId = startAdSession(auth.userId);
  return apiOk({
    watchId,
    durationSec: config.adDurationSec,
    rewardKeys: config.adRewardKeys,
  });
}
