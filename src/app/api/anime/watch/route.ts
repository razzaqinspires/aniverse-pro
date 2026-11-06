// GET /api/anime/watch?animeId=&ep=&server=&spendKey= (default "true") → AUTH REQUIRED.
// Spends one key per episode (atomic) unless spendKey=false. 402 when keys=0.
import { NextRequest } from "next/server";
import { resolveWatch } from "@/lib/providers";
import { spendKey, getKeys } from "@/lib/keys";
import { requireSession, apiOk, apiError } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const auth = await requireSession(req);
  if ("error" in auth) return auth.error;
  const { userId, isDemo } = auth;

  const { searchParams } = new URL(req.url);
  const animeId = parseInt(searchParams.get("animeId") ?? "", 10);
  const ep = parseInt(searchParams.get("ep") ?? "", 10);
  const server = searchParams.get("server") ?? undefined;
  const shouldSpend = searchParams.get("spendKey") !== "false";

  if (!Number.isFinite(animeId) || animeId <= 0 || !Number.isFinite(ep) || ep <= 0) {
    return apiError(400, "Parameter animeId dan ep tidak valid");
  }

  if (shouldSpend) {
    const spent = spendKey(userId, `watch:${animeId}:${ep}`);
    if (!spent) {
      return apiError(402, "Kunci habis", { keys: 0, needAd: true });
    }
  }

  try {
    const watch = await resolveWatch(animeId, ep, server);
    return apiOk({ watch, keys: getKeys(userId), isDemo });
  } catch (err) {
    console.error("[api/anime/watch]", err);
    return apiError(502, "Gagal mengambil sumber video");
  }
}
