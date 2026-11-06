"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import type { AnimeDetail, ServerHealth, WatchResult } from "@/lib/types";
import { ApiError, apiFetch } from "@/hooks/useAnime";
import { dispatchKeysRefresh } from "@/hooks/useKeys";
import { useXp } from "@/hooks/useXp";
import ServerSwitcher from "@/components/ServerSwitcher";
import ErrorBoundary from "@/components/ErrorBoundary";
import Skeleton from "@/components/Skeleton";

// Player + ad modal reference browser-only libraries (plyr, hls.js) at module load,
// so they must be excluded from SSR entirely and hydrated client-side.
const VideoPlayer = dynamic(() => import("@/components/VideoPlayer"), {
  ssr: false,
  loading: () => (
    <div className="card" style={{ aspectRatio: "16/9", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="spinner" role="status" aria-label="Memuat pemain video" />
    </div>
  ),
});
const AdModal = dynamic(() => import("@/components/AdModal"), { ssr: false });

export default function WatchPage() {
  const params = useParams<{ id: string; ep: string }>();
  const router = useRouter();
  const { status } = useSession();

  const animeId = parseInt(params?.id ?? "0", 10);
  const ep = parseInt(params?.ep ?? "1", 10);

  const { startHeartbeat, stopHeartbeat } = useXp();
  const playingRef = useRef(false);

  const [watch, setWatch] = useState<WatchResult | null>(null);
  const [currentServer, setCurrentServer] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showAd, setShowAd] = useState(false);
  const [servers, setServers] = useState<ServerHealth[]>([]);
  const [anime, setAnime] = useState<AnimeDetail | null>(null);

  const startedKeyRef = useRef<string>("");
  const triedServersRef = useRef<Set<string>>(new Set());

  // Redirect if not logged in.
  useEffect(() => {
    if (status === "unauthenticated") {
      toast.info("Silakan login untuk menonton");
      router.replace(`/login?redirect=${encodeURIComponent(`/watch/${animeId}/${ep}`)}`);
    }
  }, [status, router, animeId, ep]);

  const loadWatch = useCallback(
    async (serverId?: string, spendKey = true) => {
      setSwitching(true);
      setErrorMsg(null);
      const qs = new URLSearchParams({
        animeId: String(animeId),
        ep: String(ep),
        spendKey: String(spendKey),
      });
      if (serverId) qs.set("server", serverId);
      try {
        const data = await apiFetch<{ watch: WatchResult; keys: number; isDemo: boolean }>(
          `/api/anime/watch?${qs.toString()}`,
        );
        setWatch(data.watch);
        setCurrentServer(data.watch.server);
        dispatchKeysRefresh();
        if (data.watch.isDemo && !serverId) {
          toast.info("Menggunakan Server Demo", { description: "Video sampel royalty-free." });
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 402 && err.data?.needAd) {
          setShowAd(true);
          return;
        }
        const msg = err instanceof Error ? err.message : "Gagal memuat stream";
        setErrorMsg(msg);
        toast.error(msg);
      } finally {
        setSwitching(false);
        setLoading(false);
      }
    },
    [animeId, ep],
  );

  // Initial load: detail + servers + watch (spend a key once per anime+ep).
  useEffect(() => {
    const key = `${animeId}-${ep}`;
    if (!Number.isFinite(animeId) || animeId <= 0) {
      setErrorMsg("ID anime tidak valid");
      setLoading(false);
      return;
    }
    // Reset per-episode state.
    triedServersRef.current = new Set();
    setWatch(null);
    setErrorMsg(null);

    // Detail + servers (no guard — cheap, idempotent).
    let alive = true;
    apiFetch<{ anime: AnimeDetail }>(`/api/anime/detail?id=${animeId}`)
      .then((d) => { if (alive) setAnime(d.anime); })
      .catch(() => { /* detail is non-critical */ });
    apiFetch<{ servers: ServerHealth[] }>("/api/health/servers")
      .then((d) => { if (alive) setServers(d.servers); })
      .catch(() => { /* servers optional */ });

    // Spend a key at most once per episode (also defeats StrictMode double-invoke).
    if (startedKeyRef.current !== key) {
      startedKeyRef.current = key;
      setLoading(true);
      loadWatch(undefined, true);
    } else {
      setLoading(false);
    }
    return () => {
      alive = false;
    };
  }, [animeId, ep, loadWatch]);

  // XP heartbeat while a stream is loaded.
  useEffect(() => {
    if (!watch) return;
    startHeartbeat(playingRef);
    return () => stopHeartbeat();
  }, [watch, startHeartbeat, stopHeartbeat]);

  const autoSwitchServer = useCallback(() => {
    if (servers.length === 0) {
      setErrorMsg("Tidak ada server lain untuk dicoba.");
      return;
    }
    if (currentServer) triedServersRef.current.add(currentServer);
    const candidates = servers.filter((s) => !triedServersRef.current.has(s.id));
    // Prefer healthy servers, fall back to any untried.
    const next = candidates.find((s) => s.ok) ?? candidates[0];
    if (!next) {
      const msg = "Semua server gagal memutar episode ini. Coba lagi nanti.";
      setErrorMsg(msg);
      toast.error(msg);
      return;
    }
    toast.info(`Beralih ke server ${next.name}...`, { description: "Stream sebelumnya bermasalah." });
    loadWatch(next.id, false);
  }, [servers, currentServer, loadWatch]);

  const handleManualServer = useCallback(
    (serverId: string) => {
      triedServersRef.current.add(currentServer ?? "");
      loadWatch(serverId, false);
    },
    [currentServer, loadWatch],
  );

  const handleProgress = useCallback(
    (seconds: number) => {
      apiFetch("/api/history", {
        method: "POST",
        body: JSON.stringify({
          animeId,
          ep,
          title: anime?.title ?? `Anime ${animeId}`,
          image: anime?.image ?? "",
          progress: Math.round(seconds),
        }),
      }).catch(() => {
        // history save is best-effort
      });
    },
    [animeId, ep, anime],
  );

  const handleAdSuccess = useCallback(() => {
    setShowAd(false);
    toast.success("Kunci diterima — memuat stream...");
    loadWatch(undefined, true);
  }, [loadWatch]);

  if (status === "loading" || status === "unauthenticated") {
    return (
      <div className="container-x" style={{ paddingTop: 120, display: "flex", justifyContent: "center" }}>
        <div className="spinner" role="status" aria-label="Memuat" />
      </div>
    );
  }

  const totalEps = anime?.episodes ?? anime?.episodesList?.length ?? 0;
  const hasPrev = ep > 1;
  const hasNext = totalEps === 0 || ep < totalEps;

  return (
    <div className="container-x" style={{ paddingTop: 24, paddingBottom: 40 }}>
      <AnimatePresence>{showAd ? <AdModal onSuccess={handleAdSuccess} /> : null}</AnimatePresence>

      {/* Breadcrumb / title */}
      <div style={{ marginBottom: 16 }}>
        <Link href={`/anime/${animeId}`} style={{ fontSize: 13, color: "var(--accent-2)" }}>← Kembali ke detail anime</Link>
        <h1 style={{ margin: "8px 0 0", fontSize: "clamp(18px, 3vw, 24px)", fontFamily: "var(--font-display)" }}>
          {anime?.title ?? `Anime #${animeId}`} <span style={{ color: "var(--text-muted)" }}>— Episode {ep}</span>
        </h1>
      </div>

      <div style={{ display: "grid", gap: 20, gridTemplateColumns: "1fr" }} className="watch-grid">
        {/* Main column */}
        <div style={{ minWidth: 0 }}>
          {loading || switching ? (
            <div className="card" style={{ aspectRatio: "16/9", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }} aria-busy="true">
              <div className="spinner" />
              <span style={{ fontSize: 13, color: "var(--text-soft)" }}>{switching ? "Beralih server..." : "Memuat stream..."}</span>
            </div>
          ) : errorMsg ? (
            <div className="card" style={{ padding: 24, textAlign: "center" }} role="alert">
              <div style={{ fontSize: 36, marginBottom: 8 }} aria-hidden="true">📺</div>
              <p style={{ color: "var(--danger)", margin: "0 0 16px" }}>{errorMsg}</p>
              <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                <button type="button" className="btn btn-primary" onClick={() => loadWatch(currentServer, false)}>Coba Lagi</button>
                {servers.length > 0 ? (
                  <button type="button" className="btn btn-ghost" onClick={autoSwitchServer}>Ganti Server</button>
                ) : null}
              </div>
            </div>
          ) : watch ? (
            <>
              {watch.isDemo ? (
                <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: "var(--radius-md)", background: "rgba(255,201,60,0.1)", border: "1px solid rgba(255,201,60,0.3)", fontSize: 13, color: "var(--warning)" }} role="status">
                  🎬 <strong>Server Demo aktif.</strong> Video adalah sampel royalty-free. Tambahkan provider video di environment untuk konten asli.
                </div>
              ) : null}

              <ErrorBoundary onSwitchServer={autoSwitchServer} switchLabel="Ganti Server" title="Pemain video error">
                <VideoPlayer
                  key={`${watch.server}-${ep}`}
                  sources={watch.sources}
                  subtitles={watch.subtitles}
                  serverName={watch.serverName}
                  onError={autoSwitchServer}
                  onProgress={handleProgress}
                  playingRef={playingRef}
                />
              </ErrorBoundary>

              {/* Episode nav */}
              <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
                {hasPrev ? (
                  <Link href={`/watch/${animeId}/${ep - 1}`} className="btn btn-ghost">← Episode {ep - 1}</Link>
                ) : (
                  <button type="button" className="btn btn-ghost" disabled>← Episode Sebelumnya</button>
                )}
                <Link href={`/anime/${animeId}`} className="btn btn-outline" style={{ marginLeft: "auto" }}>Daftar Episode</Link>
                {hasNext ? (
                  <Link href={`/watch/${animeId}/${ep + 1}`} className="btn btn-primary">Episode {ep + 1} →</Link>
                ) : (
                  <button type="button" className="btn btn-primary" disabled>Episode Terakhir ✓</button>
                )}
              </div>

              {anime?.description ? (
                <div className="card" style={{ padding: 16, marginTop: 20 }}>
                  <h3 style={{ margin: "0 0 8px", fontSize: 15 }}>Sinopsis</h3>
                  <p style={{ margin: 0, fontSize: 13, color: "var(--text-soft)", lineHeight: 1.6 }}>
                    {anime.description.replace(/<[^>]*>/g, "")}
                  </p>
                </div>
              ) : null}
            </>
          ) : (
            <Skeleton height={300} style={{ borderRadius: "var(--radius-md)" }} />
          )}
        </div>

        {/* Sidebar */}
        <aside style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          <ServerSwitcher servers={servers.length ? servers : undefined} currentServer={currentServer} onSelect={handleManualServer} loading={loading} />
          {anime ? (
            <div className="card" style={{ padding: 16, display: "flex", gap: 12 }}>
              {anime.image ? (
                <img src={anime.image} alt={anime.title} referrerPolicy="no-referrer" style={{ width: 72, height: 108, objectFit: "cover", borderRadius: "var(--radius-sm)", flexShrink: 0 }} />
              ) : null}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{anime.title}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {anime.year ? <span className="badge">{anime.year}</span> : null}
                  {anime.rating ? <span className="badge">★ {anime.rating.toFixed(1)}</span> : null}
                  {totalEps > 0 ? <span className="badge">{totalEps} EPS</span> : null}
                </div>
                <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-muted)" }}>
                  Server: <strong style={{ color: "var(--text-soft)" }}>{watch?.serverName ?? "—"}</strong>
                </div>
              </div>
            </div>
          ) : null}
        </aside>
      </div>

      <style>{`
        @media (min-width: 1024px) {
          .watch-grid { grid-template-columns: minmax(0, 1fr) 320px !important; }
        }
      `}</style>
    </div>
  );
}
