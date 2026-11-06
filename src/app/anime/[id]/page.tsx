"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { apiFetch, useDetail } from "@/hooks/useAnime";
import type { HistoryItem } from "@/lib/types";
import AnimeRow from "@/components/AnimeRow";
import AnimeGridSkeleton from "@/components/AnimeGridSkeleton";
import EmptyState from "@/components/EmptyState";

export default function AnimeDetailPage() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params?.id ?? "0", 10);
  const { data: anime, loading, error, reload } = useDetail(Number.isFinite(id) && id > 0 ? id : null);
  const [watchedEps, setWatchedEps] = useState<Set<number>>(new Set());
  const [historyLoading, setHistoryLoading] = useState(true);

  // Load history to mark watched episodes.
  useEffect(() => {
    let alive = true;
    apiFetch<{ items: HistoryItem[] }>("/api/history")
      .then((d) => {
        if (!alive) return;
        const set = new Set<number>();
        for (const it of d.items) {
          if (it.animeId === id) set.add(it.ep);
        }
        setWatchedEps(set);
      })
      .catch(() => {
        // Not logged in or history unavailable — silently skip watched marks.
      })
      .finally(() => {
        if (alive) setHistoryLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [id]);

  const episodes = useMemo(() => {
    if (!anime) return [] as { number: number; title?: string }[];
    if (anime.episodesList && anime.episodesList.length > 0) return anime.episodesList;
    const total = anime.episodes ?? 0;
    return Array.from({ length: total }, (_, i) => ({ number: i + 1 }));
  }, [anime]);

  if (loading) {
    return (
      <div className="container-x" style={{ paddingTop: 24 }}>
        <div className="skeleton" style={{ height: 260, marginBottom: 24, borderRadius: "var(--radius-lg)" }} />
        <AnimeGridSkeleton count={6} />
      </div>
    );
  }

  if (error || !anime) {
    return (
      <div className="container-x" style={{ paddingTop: 40 }}>
        <EmptyState
          emoji="😢"
          title="Anime tidak ditemukan"
          description={error || "Gagal memuat detail anime."}
          ctaLabel="Coba Lagi"
          onCtaClick={() => {
            toast.info("Memuat ulang...");
            reload();
          }}
        />
      </div>
    );
  }

  const relations = (anime.relations ?? []).map((r) => ({ id: r.id, title: r.title, image: r.image }));
  const recommendations = (anime.recommendations ?? []).map((r) => ({ id: r.id, title: r.title, image: r.image }));

  return (
    <div style={{ paddingTop: 0 }}>
      {/* Backdrop banner */}
      <div style={{ position: "relative", height: 240, overflow: "hidden" }} aria-hidden="true">
        {anime.image ? (
          <img
            src={anime.image}
            alt=""
            referrerPolicy="no-referrer"
            style={{ width: "100%", height: "100%", objectFit: "cover", filter: "blur(14px) brightness(0.4)", transform: "scale(1.15)" }}
          />
        ) : null}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 30%, var(--bg))" }} />
      </div>

      <div className="container-x" style={{ marginTop: -120, position: "relative", paddingBottom: 40 }}>
        <div style={{ display: "flex", gap: 24, flexDirection: "column" }} className="detail-header">
          {/* Poster */}
          <div style={{ flexShrink: 0, width: 180, alignSelf: "flex-start" }} className="detail-poster">
            <div className="anime-poster" style={{ boxShadow: "var(--shadow-lg)" }}>
              {anime.image ? (
                <img src={anime.image} alt={anime.title} referrerPolicy="no-referrer" />
              ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)" }}>Tanpa Gambar</div>
              )}
            </div>
            {episodes.length > 0 ? (
              <Link href={`/watch/${anime.id}/1`} className="btn btn-primary" style={{ width: "100%", marginTop: 12 }}>
                ▶ Tonton Episode 1
              </Link>
            ) : null}
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(22px, 4vw, 32px)", fontWeight: 800, margin: "0 0 10px", lineHeight: 1.2 }}>
              {anime.title}
            </h1>
            {anime.synonyms && anime.synonyms.length > 0 ? (
              <p style={{ color: "var(--text-muted)", fontSize: 13, margin: "0 0 12px" }}>Alias: {anime.synonyms.join(", ")}</p>
            ) : null}

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
              {anime.year ? <span className="badge">📅 {anime.year}</span> : null}
              {anime.rating ? <span className="badge" style={{ background: "rgba(255,201,60,0.15)", color: "var(--warning)", borderColor: "rgba(255,201,60,0.35)" }}>★ {anime.rating.toFixed(1)}</span> : null}
              {anime.format ? <span className="badge">{anime.format}</span> : null}
              {anime.status ? <span className="badge">{anime.status}</span> : null}
              {anime.episodes ? <span className="badge">{anime.episodes} EPS</span> : null}
              {anime.duration ? <span className="badge">{anime.duration} menit/ep</span> : null}
              {anime.studios && anime.studios.length > 0 ? <span className="badge">🎬 {anime.studios.join(", ")}</span> : null}
            </div>

            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
              {(anime.genres ?? []).map((g) => (
                <span key={g} style={{ fontSize: 11, padding: "4px 10px", borderRadius: "var(--radius-full)", background: "rgba(255,61,110,0.12)", color: "var(--accent)", border: "1px solid rgba(255,61,110,0.3)" }}>
                  {g}
                </span>
              ))}
            </div>

            {anime.description ? (
              <p style={{ color: "var(--text-soft)", fontSize: 14, lineHeight: 1.6, margin: 0, whiteSpace: "pre-line" }}>
                {anime.description.replace(/<[^>]*>/g, "")}
              </p>
            ) : (
              <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Sinopsis tidak tersedia.</p>
            )}
          </div>
        </div>

        {/* Episodes */}
        <section style={{ marginTop: 40 }} aria-label="Daftar episode">
          <h2 className="section-title">
            Episode {episodes.length > 0 ? `(${episodes.length})` : ""}
            {historyLoading ? <span className="skeleton" style={{ width: 80, height: 14, marginLeft: 12 }} aria-hidden="true" /> : null}
          </h2>
          {episodes.length === 0 ? (
            <EmptyState emoji="📺" title="Belum ada episode" description="Anime ini belum memiliki daftar episode yang tersedia." />
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(88px, 1fr))", gap: 8 }}>
              {episodes.map((ep) => {
                const watched = watchedEps.has(ep.number);
                return (
                  <Link
                    key={ep.number}
                    href={`/watch/${anime.id}/${ep.number}`}
                    title={`Episode ${ep.number}`}
                    aria-label={`Episode ${ep.number}${watched ? " (sudah ditonton)" : ""}`}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 4,
                      padding: "12px 6px",
                      borderRadius: "var(--radius-sm)",
                      border: `1px solid ${watched ? "var(--success)" : "var(--border)"}`,
                      background: watched ? "rgba(46,204,113,0.08)" : "var(--bg-card)",
                      fontSize: 13,
                      fontWeight: 700,
                      transition: "all var(--transition)",
                    }}
                    className="ep-button"
                  >
                    <span>{ep.number}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, color: watched ? "var(--success)" : "var(--text-muted)" }}>
                      {watched ? "✓ Selesai" : "Baru"}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* Relations & Recommendations */}
        {relations.length > 0 ? (
          <div style={{ marginTop: 40 }}>
            <AnimeRow title="🔗 Terkait" items={relations} />
          </div>
        ) : null}
        {recommendations.length > 0 ? (
          <div style={{ marginTop: 16 }}>
            <AnimeRow title="💡 Rekomendasi" items={recommendations} />
          </div>
        ) : null}
      </div>

      <style>{`
        @media (min-width: 768px) {
          .detail-header { flex-direction: row !important; }
        }
        .ep-button:hover { border-color: var(--accent); transform: translateY(-2px); }
      `}</style>
    </div>
  );
}
