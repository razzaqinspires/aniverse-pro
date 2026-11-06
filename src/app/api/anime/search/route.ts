// GET /api/anime/search?q=&page= → { ok:true, results: AnimeSummary[], pageInfo }
import { NextRequest } from "next/server";
import { searchAnime } from "@/lib/anilist";
import { apiOk, apiError } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const pageRaw = parseInt(searchParams.get("page") ?? "1", 10);
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? pageRaw : 1;

  if (!q.trim()) {
    return apiOk({
      results: [],
      pageInfo: { total: 0, currentPage: 1, lastPage: 1, hasNextPage: false },
    });
  }

  try {
    const data = await searchAnime(q, page);
    return apiOk({ results: data.results, pageInfo: data.pageInfo });
  } catch (err) {
    console.error("[api/anime/search]", err);
    return apiError(502, "Gagal mengambil data anime");
  }
}
