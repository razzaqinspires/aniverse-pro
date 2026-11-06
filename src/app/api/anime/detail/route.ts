// GET /api/anime/detail?id= → { ok:true, anime: AnimeDetail }. id required numeric.
import { NextRequest } from "next/server";
import { detailAnime } from "@/lib/anilist";
import { apiOk, apiError } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const idRaw = searchParams.get("id");
  const id = idRaw ? parseInt(idRaw, 10) : NaN;

  if (!idRaw || !Number.isFinite(id) || id <= 0) {
    return apiError(400, "Parameter id tidak valid");
  }

  try {
    const anime = await detailAnime(id);
    return apiOk({ anime });
  } catch (err) {
    console.error("[api/anime/detail]", err);
    return apiError(502, "Gagal mengambil detail anime");
  }
}
