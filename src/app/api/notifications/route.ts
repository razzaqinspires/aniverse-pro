// GET /api/notifications → AUTH. {items:[{animeId,title,image,episode,airingAt}], unread}
//   Computed from AniList nextAiringEpisode of watchlist anime, compared to last-seen timestamp.
// POST /api/notifications {action:"seen"} → mark all as seen (store timestamp in user_meta).
import { NextRequest } from "next/server";
import { getStorage } from "@/lib/storage";
import { requireSession, apiOk, apiError, readJsonBody } from "@/lib/api-helpers";
import { fetchAiringInfo } from "@/lib/anilist";

const LAST_SEEN_KEY = "last_notif_seen";

export async function GET(req: NextRequest) {
  const auth = await requireSession(req);
  if ("error" in auth) return auth.error;
  const storage = getStorage();
  const userId = auth.userId;
  try {
    const watchlist = await storage.getWatchlist(userId);
    const lastSeenRaw = await storage.getUserMeta(userId, LAST_SEEN_KEY);
    const lastSeen = lastSeenRaw ? parseInt(lastSeenRaw, 10) : Date.now() - 7 * 24 * 3600 * 1000; // default: 7 days window
    if (watchlist.length === 0) return apiOk({ items: [], unread: 0 });

    const airing = await fetchAiringInfo(watchlist.map((w) => w.anime_id));
    const now = Math.floor(Date.now() / 1000);
    const items = airing
      .filter((a) => a.nextAiringEpisode && a.nextAiringEpisode.airingAt <= now && a.nextAiringEpisode.airingAt * 1000 > lastSeen)
      .map((a) => ({
        animeId: a.id, title: a.title, image: a.image,
        episode: a.nextAiringEpisode!.episode, airingAt: a.nextAiringEpisode!.airingAt,
      }));
    const unread = items.length;
    return apiOk({ items, unread });
  } catch {
    return apiOk({ items: [], unread: 0 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(req);
  if ("error" in auth) return auth.error;
  let body: { action?: string } = {};
  try { body = await readJsonBody(req); } catch { /* ignore */ }
  if (body.action !== "seen") return apiError(400, "Action tidak dikenal");
  await getStorage().setUserMeta(auth.userId, LAST_SEEN_KEY, String(Date.now()));
  return apiOk({ ok: true });
}
