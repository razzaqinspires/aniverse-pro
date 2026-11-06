// GET /api/anime/browse?sort=TRENDING_DESC|POPULARITY_DESC|SCORE_DESC|START_DATE_DESC&page=
// → { ok:true, results, pageInfo }. START_DATE_DESC = upcoming (NOT_YET_RELEASED).
import { NextRequest } from "next/server";
import { z } from "zod";
import { browseAnime } from "@/lib/anilist";
import { apiOk, apiError } from "@/lib/api-helpers";

const SortEnum = z.enum(["TRENDING_DESC", "POPULARITY_DESC", "SCORE_DESC", "START_DATE_DESC"]);
type SortParam = z.infer<typeof SortEnum>;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sortParsed = SortEnum.safeParse(searchParams.get("sort") ?? "TRENDING_DESC");
  const sort: SortParam = sortParsed.success ? sortParsed.data : "TRENDING_DESC";

  const pageRaw = parseInt(searchParams.get("page") ?? "1", 10);
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? pageRaw : 1;

  try {
    const data = await browseAnime(sort, page);
    return apiOk({ results: data.results, pageInfo: data.pageInfo });
  } catch (err) {
    console.error("[api/anime/browse]", err);
    return apiError(502, "Gagal mengambil data anime");
  }
}
