"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ApiError, apiFetch, useDetail } from "@/hooks/useAnime";
import type { HistoryItem } from "@/lib/types";
import AnimeRow from "@/components/AnimeRow";
import AnimeGridSkeleton from "@/components/AnimeGridSkeleton";
import EmptyState from "@/components/EmptyState";

export default function AnimeDetailPage() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params?.id ?? "0", 10);
  const router = useRouter();
  const { data: anime, loading, error, reload } = useDetail(Number.isFinite(id) && id > 0 ? id : null);
  const [watchedEps, setWatchedEps] = useState<Set<number>>(new Set());
  const [historyLoading, setHistoryLoading] = useState(true);
  // Watchlist toggle state.
  const [inWatchlist, setInWatchlist] = useState(false);
  const [watchlistBusy, setWatchlistBusy] = useState(false);
  // Rating widget state.
  const [ratingData, setRatingData] = useState<{ avg: number; count: number; userRating: { rating: number; review: string } | null } | null>(null);
  const [selectedRating, setSelectedRating] = useState(0);
  const [review, setReview] = useState("");
  const [ratingBusy, setRatingBusy] = useState(false);

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

  // Load watchlist membership + ratings (best-effort; 401 = not logged in).
  useEffect(() => {
    let alive = true;
    apiFetch<{ items: { animeId: number; status: string }[] }>("/api/watchlist?status=all")
      .then((d) => {
        if (!alive) return;
        setInWatchlist((d.items ?? []).some((it) => it.animeId === id));
      })
      .catch(() => { /* not logged in or endpoint unavailable */ });
    apiFetch<{ avg: number; count: number; userRating: { rating: number; review: string } | null }>(`/api/ratings?animeId=${id}`)
      .then((d) => {
        if (!alive) return;
        setRatingData({ avg: d.avg ?? 0, count: d.count ?? 0, userRating: d.userRating ?? null });
        if (d.userRating) {
          setSelectedRating(Number(d.userRating.rating) || 0);
          setReview(d.userRating.review ?? "");
        }
      })
      .catch(() => { /* ratings optional */ });
    return () => { alive = false; };
  }, [id]);

  const toggleWatchlist = useCallback(async () => {
    if (!anime || watchlistBusy) return;
    setWatchlistBusy(true);
    try {
      if (inWatchlist) {
        await apiFetch(`/api/watchlist?animeId=${id}`, { method: "DELETE" });
        setInWatchlist(false);
        toast.success("Dihapus dari watchlist", { description: anime.title });
      } else {
        await apiFetch("/api/watchlist", {
          method: "POST",
          body: JSON.stringify({ animeId: id, status: "plan_to_watch", title: anime.title, image: anime.image ?? "" }),
        });
        setInWatchlist(true);
        toast.success("Ditambahkan ke watchlist", { description: anime.title });
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.replace("/login");
      } else {
        toast.error(err instanceof Error ? err.message : "Gagal memperbarui watchlist");
      }
    } finally {
      setWatchlistBusy(false);
    }
  }, [anime, id, inWatchlist, watchlistBusy, router]);

  const submitRating = useCallback(async () => {
    if (selectedRating < 1 || ratingBusy) return;
    setRatingBusy(true);
    const body: { animeId: number; rating: number; review?: string } = { animeId: id, rating: selectedRating };
    const reviewTrimmed = review.trim();
    if (reviewTrimmed) body.review = reviewTrimmed.slice(0, 500);
    try {
      const res = await apiFetch<{ avg: number; count: number }>("/api/ratings", { method: "POST", body: JSON.stringify(body) });
      setRatingData({ avg: res.avg ?? 0, count: res.count ?? 0, userRating: { rating: selectedRating, review: reviewTrimmed } });
      toast.success("Rating tersimpan", { description: `Kamu memberi ${selectedRating} bintang.` });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.replace("/login");
      } else {
        toast.error(err instanceof Error ? err.message : "Gagal menyimpan rating");
      }
    } finally {
      setRatingBusy(false);
    }
  }, [selectedRating, review, ratingBusy, id, router]);

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
            <button
              type="button"
              onClick={toggleWatchlist}
              disabled={watchlistBusy}
              aria-pressed={inWatchlist}
              className={inWatchlist ? "btn btn-ghost" : "btn btn-outline"}
              style={{ width: "100%", marginTop: 8, color: inWatchlist ? "var(--success)" : undefined, borderColor: inWatchlist ? "var(--success)" : undefined }}
            >
              {inWatchlist ? "✓ Di Watchlist" : "+ Watchlist"}
            </button>
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

        {/* Rating & review widget */}
        <section className="card" style={{ marginTop: 40, padding: 20 }} aria-label="Rating dan ulasan">
          <h2 className="section-title" style={{ marginBottom: 12 }}>⭐ Rating &amp; Ulasan</h2>
          {ratingData ? (
            <div style={{ marginBottom: 14, fontSize: 14, color: "var(--text-soft)" }}>
              Rating Aniverse: <strong style={{ color: "var(--warning)" }}>★ {ratingData.avg.toFixed(1)}</strong> / {ratingData.count} pengguna
              {ratingData.userRating ? <span style={{ marginLeft: 12, color: "var(--accent-2)" }}>Rating kamu: ★ {ratingData.userRating.rating}</span> : null}
            </div>
          ) : (
            <div className="skeleton" style={{ height: 18, width: 240, marginBottom: 14 }} aria-hidden="true" />
          )}
          <div role="radiogroup" aria-label="Beri rating 1 sampai 5 bintang" style={{ display: "flex", gap: 4, marginBottom: 12 }}>
            {[1, 2, 3, 4, 5].map((star) => {
              const active = star <= selectedRating;
              return (
                <button
                  key={star}
                  type="button"
                  role="radio"
                  aria-checked={star === selectedRating}
                  aria-label={`${star} bintang`}
                  onClick={() => setSelectedRating(star)}
                  style={{
                    background: "transparent",
                    border: "none",
                    fontSize: 30,
                    lineHeight: 1,
                    padding: "2px 4px",
                    color: active ? "var(--warning)" : "var(--border-strong)",
                    transition: "transform var(--transition)",
                    cursor: "pointer",
                  }}
                  className="rating-star"
                >
                  ★
                </button>
              );
            })}
          </div>
          <div style={{ position: "relative" }}>
            <textarea
              value={review}
              onChange={(e) => setReview(e.target.value.slice(0, 500))}
              placeholder="Tulis ulasanmu (opsional, maksimal 500 karakter)..."
              maxLength={500}
              rows={3}
              aria-label="Tulis ulasan"
              className="input"
              style={{ borderRadius: "var(--radius-md)", resize: "vertical", minHeight: 72, paddingRight: 60, fontFamily: "inherit" }}
            />
            <span style={{ position: "absolute", bottom: 10, right: 14, fontSize: 11, color: "var(--text-muted)" }}>{review.length}/500</span>
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <button type="button" className="btn btn-primary" onClick={submitRating} disabled={selectedRating < 1 || ratingBusy}>
              {ratingBusy ? "Menyimpan..." : "Kirim Rating"}
            </button>
            {selectedRating < 1 ? <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Pilih minimal 1 bintang untuk mengirim.</span> : null}
          </div>
        </section>

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
        .rating-star:hover { transform: scale(1.2); }
      `}</style>
    </div>
  );
}
