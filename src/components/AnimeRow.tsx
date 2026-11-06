"use client";

import AnimeCard, { type AnimeCardItem } from "./AnimeCard";
import AnimeGridSkeleton from "./AnimeGridSkeleton";

interface AnimeRowProps {
  title: string;
  items: AnimeCardItem[];
  loading?: boolean;
  error?: string | null;
  hrefAll?: string;
}

/** Horizontal scrolling row of anime cards with a section title. */
export default function AnimeRow({ title, items, loading, error, hrefAll }: AnimeRowProps) {
  return (
    <section style={{ marginBottom: 32 }} aria-label={title}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h2 className="section-title" style={{ marginBottom: 0 }}>{title}</h2>
        {hrefAll ? (
          <a href={hrefAll} style={{ fontSize: 13, color: "var(--accent-2)", fontWeight: 600 }}>
            Lihat Semua →
          </a>
        ) : null}
      </div>

      {loading ? (
        <div className="row-scroll">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} style={{ flex: "0 0 140px" }}>
              <div className="skeleton" style={{ aspectRatio: "2/3", width: "100%" }} />
              <div className="skeleton" style={{ height: 12, marginTop: 8, width: "80%" }} />
            </div>
          ))}
        </div>
      ) : error ? (
        <div style={{ color: "var(--danger)", fontSize: 14, padding: "12px 0" }}>Gagal memuat: {error}</div>
      ) : items.length === 0 ? (
        <div style={{ color: "var(--text-muted)", fontSize: 14, padding: "12px 0" }}>Belum ada data.</div>
      ) : (
        <div className="row-scroll">
          {items.map((it) => (
            <div key={`${it.id}-${it.ep ?? "x"}`} style={{ flex: "0 0 140px" }}>
              <AnimeCard item={it} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export { AnimeGridSkeleton };
