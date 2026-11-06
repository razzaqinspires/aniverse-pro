"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useBrowse, useSearch, type BrowseSort } from "@/hooks/useAnime";
import AnimeCard from "@/components/AnimeCard";
import AnimeRow from "@/components/AnimeRow";
import AnimeGridSkeleton from "@/components/AnimeGridSkeleton";
import EmptyState from "@/components/EmptyState";

const ROWS: { sort: BrowseSort; title: string }[] = [
  { sort: "TRENDING_DESC", title: "🔥 Trending Sekarang" },
  { sort: "POPULARITY_DESC", title: "⭐ Paling Populer" },
  { sort: "SCORE_DESC", title: "🏆 Rating Tertinggi" },
  { sort: "START_DATE_DESC", title: "🆕 Segera Tayang / Terbaru" },
];

function Hero({ animeId, title, image, description }: { animeId: number; title: string; image?: string; description?: string }) {
  return (
    <section
      className="fade-up"
      aria-label="Anime unggulan"
      style={{
        position: "relative",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
        marginBottom: 40,
        minHeight: 320,
        display: "flex",
        alignItems: "flex-end",
        background: "var(--bg-card)",
      }}
    >
      {image ? (
        <>
          <img
            src={image}
            alt=""
            aria-hidden="true"
            referrerPolicy="no-referrer"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "blur(2px) brightness(0.45)", transform: "scale(1.05)" }}
          />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, var(--bg) 5%, transparent 60%)" }} />
        </>
      ) : null}
      <div className="container-x" style={{ position: "relative", paddingTop: 48, paddingBottom: 32, width: "100%" }}>
        <span className="badge" style={{ marginBottom: 12 }}>✨ Pilihan Editor</span>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(24px, 5vw, 44px)", fontWeight: 800, margin: "0 0 8px", maxWidth: 640, lineHeight: 1.15 }}>
          {title}
        </h1>
        {description ? (
          <p style={{ color: "var(--text-soft)", fontSize: 14, maxWidth: 520, margin: "0 0 20px", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {description.replace(/<[^>]*>/g, "")}
          </p>
        ) : null}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link href={`/anime/${animeId}`} className="btn btn-primary" style={{ fontSize: 15, padding: "12px 28px" }}>
            ▶ Mulai Nonton
          </Link>
          <Link href={`/anime/${animeId}`} className="btn btn-ghost" style={{ fontSize: 15, padding: "12px 28px" }}>
            Detail
          </Link>
        </div>
      </div>
    </section>
  );
}

function SearchResults({ q }: { q: string }) {
  const { data, loading, error } = useSearch(q);
  const items = data?.results ?? [];

  if (loading) return <AnimeGridSkeleton count={18} />;
  if (error) return <EmptyState emoji="⚠️" title="Gagal mencari" description={error} ctaLabel="Kembali ke Beranda" ctaHref="/" />;
  if (items.length === 0) return <EmptyState emoji="🔍" title={`Tidak ditemukan untuk "${q}"`} description="Coba kata kunci lain, misalnya judul bahasa Jepang atau Inggris." ctaLabel="Lihat Trending" ctaHref="/" />;

  return (
    <div>
      <h2 className="section-title">Hasil pencarian: {q} ({items.length})</h2>
      <div className="anime-grid">
        {items.map((a) => (
          <AnimeCard key={a.id} item={{ id: a.id, title: a.title, image: a.image, year: a.year, rating: a.rating }} />
        ))}
      </div>
    </div>
  );
}

function BrowseRows() {
  const trending = useBrowse("TRENDING_DESC");
  const popular = useBrowse("POPULARITY_DESC");
  const score = useBrowse("SCORE_DESC");
  const upcoming = useBrowse("START_DATE_DESC");
  const states = [trending, popular, score, upcoming];

  const featured = trending.data?.results?.[0];

  return (
    <div>
      {featured ? (
        <Hero animeId={featured.id} title={featured.title} image={featured.image} description={featured.description} />
      ) : (
        <div className="skeleton" style={{ height: 320, marginBottom: 40, borderRadius: "var(--radius-lg)" }} aria-hidden="true" />
      )}
      {ROWS.map((row, i) => (
        <AnimeRow
          key={row.sort}
          title={row.title}
          loading={states[i].loading}
          error={states[i].error}
          items={(states[i].data?.results ?? []).map((a) => ({ id: a.id, title: a.title, image: a.image, year: a.year, rating: a.rating }))}
        />
      ))}
    </div>
  );
}

function HomeInner() {
  const params = useSearchParams();
  const q = params.get("q")?.trim() ?? "";
  return (
    <div className="container-x" style={{ paddingTop: 24, paddingBottom: 24 }}>
      {q ? <SearchResults q={q} /> : <BrowseRows />}
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="container-x" style={{ paddingTop: 24 }}>
          <AnimeGridSkeleton count={12} />
        </div>
      }
    >
      <HomeInner />
    </Suspense>
  );
}
