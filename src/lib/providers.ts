// Video source resolution with multi-server failover.
//
// Servers are tried in order: configured upstream providers (ANIME_PROVIDERS env, Consumet-style
// /meta/anilist/watch endpoint) first, then the built-in DEMO server which ALWAYS works
// (royalty-free sample MP4 from Google's public bucket) so the app is always demo-able.
//
// Each server gets a 5s timeout; on failure/timeout we move to the next.
// Health checks are cached for 2 minutes.

import { config } from "./config";
import type { WatchResult, ServerHealth } from "./types";

export interface ProviderDef {
  id: string;
  name: string;
  base?: string; // undefined => built-in demo
}

export function getProviders(): ProviderDef[] {
  const upstream: ProviderDef[] = config.animeProviders.map((base, i) => ({
    id: `upstream-${i + 1}`,
    name: `Server ${i + 1}`,
    base: base.replace(/\/$/, ""),
  }));
  return [
    ...upstream,
    { id: "demo", name: "Server Demo (Sample Video)", base: undefined },
  ];
}

const DEMO_SOURCES = [
  { url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4", type: "mp4" as const, quality: "1080p" },
  { url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4", type: "mp4" as const, quality: "720p" },
];

async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
  } finally {
    clearTimeout(t);
  }
}

async function resolveUpstream(p: ProviderDef, animeId: number, ep: number): Promise<WatchResult | null> {
  if (!p.base) return null;
  try {
    // Consumet-style: {base}/meta/anilist/watch/{episodeId} — we don't have episodeId, so we
    // attempt the common info+watch pattern via /meta/anilist/info first.
    const infoRes = await fetchWithTimeout(
      `${p.base}/meta/anilist/info/${animeId}?fetchFiller=false`,
      5000
    );
    if (!infoRes.ok) return null;
    const info = await infoRes.json();
    const epObj = (info.episodes || []).find((e: any) => Number(e.number) === Number(ep));
    const epId = epObj?.id;
    if (!epId) return null;
    const watchRes = await fetchWithTimeout(`${p.base}/meta/anilist/watch/${epId}`, 5000);
    if (!watchRes.ok) return null;
    const watch = await watchRes.json();
    const sources = (watch.sources || [])
      .filter((s: any) => s?.url)
      .map((s: any) => ({
        url: s.url,
        type: (s.isM3U8 || s.url.endsWith(".m3u8")) ? ("hls" as const) : ("mp4" as const),
        quality: s.quality,
      }));
    if (sources.length === 0) return null;
    return {
      server: p.id,
      serverName: p.name,
      sources,
      subtitles: (watch.subtitles || []).map((s: any) => ({ lang: s.lang || s.label || "id", url: s.url })),
      isDemo: false,
    };
  } catch {
    return null;
  }
}

function resolveDemo(animeId: number, ep: number): WatchResult {
  // Rotate sample by episode so different episodes "feel" different.
  const pick = DEMO_SOURCES[ep % DEMO_SOURCES.length];
  return {
    server: "demo",
    serverName: "Server Demo (Sample Video)",
    sources: [pick],
    subtitles: [],
    isDemo: true,
  };
}

/**
 * Resolve a watch source. If `preferServer` is given and works, use it; otherwise fall back
 * through the full ordered list. Always returns a result (demo is last).
 */
export async function resolveWatch(animeId: number, ep: number, preferServer?: string): Promise<WatchResult> {
  const providers = getProviders();
  const order = preferServer
    ? [providers.find((p) => p.id === preferServer)!, ...providers.filter((p) => p.id !== preferServer)].filter(Boolean)
    : providers;
  for (const p of order) {
    if (p.id === "demo") continue; // try real upstreams first
    const r = await resolveUpstream(p, animeId, ep);
    if (r) return r;
  }
  return resolveDemo(animeId, ep);
}

// ---------- Health check (cached) ----------
let healthCache: { at: number; data: ServerHealth[] } | null = null;
const HEALTH_TTL = 120_000;

export async function serverHealth(): Promise<ServerHealth[]> {
  if (healthCache && Date.now() - healthCache.at < HEALTH_TTL) return healthCache.data;
  const providers = getProviders();
  const checks = await Promise.all(
    providers.map(async (p): Promise<ServerHealth> => {
      if (!p.base) return { id: p.id, name: p.name, ok: true, isDemo: true };
      const start = Date.now();
      try {
        const res = await fetchWithTimeout(`${p.base}/meta/anilist/advanced-search?perPage=1`, 4000);
        return { id: p.id, name: p.name, ok: res.ok, latencyMs: Date.now() - start, isDemo: false };
      } catch {
        return { id: p.id, name: p.name, ok: false, isDemo: false };
      }
    })
  );
  healthCache = { at: Date.now(), data: checks };
  return checks;
}
