// GET /api/xp/stats → AUTH. { ok:true, ...XpStats }
import { NextRequest } from "next/server";
import { getXpStats } from "@/lib/xp";
import { config } from "@/lib/config";
import { requireSession, apiOk } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const auth = await requireSession(req);
  if ("error" in auth) return auth.error;

  const stats = await getXpStats(auth.userId);
  if (!stats) {
    return apiOk({
      xp: 0,
      level: 1,
      xpToday: 0,
      dailyCap: config.xpDailyCap,
      xpToNext: 100,
      progressPct: 0,
      badges: ["Pemula"],
    });
  }
  return apiOk(stats);
}
