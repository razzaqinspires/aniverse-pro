// AniList GraphQL client — stable metadata source (trending, popular, top, upcoming, search, detail).
// No API key required. All calls go through our backend proxy; frontend never hits AniList directly.

const ANILIST = "https://graphql.anilist.co";

const MEDIA_FIELDS = `
  id
  title { romaji english native userPreferred }
  coverImage { large medium color }
  description
  seasonYear
  genres
  format
  episodes
  averageScore
  status
  bannerImage
`;

async function gql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(ANILIST, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`AniList HTTP ${res.status}`);
    const json = (await res.json()) as { data: T; errors?: unknown[] };
    if (json.errors) throw new Error("AniList GraphQL error");
    return json.data;
  } finally {
    clearTimeout(timeout);
  }
}

function pickTitle(t: { romaji?: string; english?: string; native?: string; userPreferred?: string }): string {
  return t.userPreferred || t.english || t.romaji || t.native || "Unknown";
}

function mapMedia(m: any) {
  return {
    id: m.id,
    title: pickTitle(m.title || {}),
    image: m.coverImage?.large || m.coverImage?.medium || "",
    description: m.description?.replace(/<[^>]+>/g, "") ?? "",
    year: m.seasonYear,
    genres: m.genres || [],
    format: m.format,
    episodes: m.episodes,
    rating: m.averageScore,
    status: m.status,
    banner: m.bannerImage,
  };
}

export async function searchAnime(q: string, page = 1) {
  const data = await gql<{ Page: { media: any[]; pageInfo: any } }>(
    `query ($q: String, $page: Int) {
      Page(page: $page, perPage: 24) {
        pageInfo { total currentPage lastPage hasNextPage }
        media(search: $q, type: ANIME, sort: SEARCH_MATCH) { ${MEDIA_FIELDS} }
      }
    }`,
    { q, page }
  );
  return { results: data.Page.media.map(mapMedia), pageInfo: data.Page.pageInfo };
}

export async function browseAnime(sort: "TRENDING_DESC" | "POPULARITY_DESC" | "SCORE_DESC" | "UPDATED_DESC" | "START_DATE_DESC", page = 1, perPage = 24) {
  const statusIn = sort === "START_DATE_DESC" ? "NOT_YET_RELEASED" : undefined;
  const data = await gql<{ Page: { media: any[]; pageInfo: any } }>(
    `query ($sort: [MediaSort], $page: Int, $perPage: Int, $status: MediaStatus) {
      Page(page: $page, perPage: $perPage) {
        pageInfo { total currentPage lastPage hasNextPage }
        media(type: ANIME, sort: $sort, status: $status) { ${MEDIA_FIELDS} }
      }
    }`,
    { sort: [sort], page, perPage, status: statusIn ?? null }
  );
  return { results: data.Page.media.map(mapMedia), pageInfo: data.Page.pageInfo };
}

export async function detailAnime(id: number) {
  const data = await gql<{ Media: any }>(
    `query ($id: Int) {
      Media(id: $id, type: ANIME) {
        ${MEDIA_FIELDS}
        synonyms
        duration
        studios { nodes { name } }
        trailer { id site }
        relations { edges { relationType node { id title { userPreferred english romaji } coverImage { large } } } }
        recommendations { nodes { mediaRecommendation { id title { userPreferred } coverImage { large } } } }
      }
    }`,
    { id }
  );
  const m = data.Media;
  const base = mapMedia(m);
  const episodes = m.episodes ?? 12;
  return {
    ...base,
    synonyms: m.synonyms || [],
    duration: m.duration,
    studios: (m.studios?.nodes || []).map((s: any) => s.name),
    trailer: m.trailer,
    relations: (m.relations?.edges || [])
      .filter((e: any) => e.node)
      .map((e: any) => ({
        id: e.node.id,
        title: pickTitle(e.node.title || {}),
        image: e.node.coverImage?.large || "",
        relationType: e.relationType,
      })),
    recommendations: (m.recommendations?.nodes || [])
      .filter((r: any) => r.mediaRecommendation)
      .map((r: any) => ({
        id: r.mediaRecommendation.id,
        title: pickTitle(r.mediaRecommendation.title || {}),
        image: r.mediaRecommendation.coverImage?.large || "",
      })),
    episodesList: Array.from({ length: episodes }, (_, i) => ({ number: i + 1, title: `Episode ${i + 1}` })),
  };
}
