"use client";

import Link from "next/link";

export interface AnimeCardItem {
  id: number;
  title: string;
  image: string;
  year?: number;
  rating?: number;
  /** Optional episode badge (used by history resume cards). */
  ep?: number;
  progress?: number;
}

interface AnimeCardProps {
  item: AnimeCardItem;
}

export default function AnimeCard({ item }: AnimeCardProps) {
  const href = item.ep ? `/watch/${item.id}/${item.ep}` : `/anime/${item.id}`;
  return (
    <Link href={href} className="anime-card-link" style={{ display: "block" }}>
      <div className="anime-poster">
        {item.image ? (
          <img
            src={item.image}
            alt={item.title}
            loading="lazy"
            referrerPolicy="no-referrer"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 12 }}>
            Tanpa Gambar
          </div>
        )}
        <div style={{ position: "absolute", top: 8, left: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
          {item.year ? <span className="badge" style={{ background: "rgba(0,0,0,0.6)", borderColor: "transparent", color: "#fff" }}>{item.year}</span> : null}
          {item.rating ? (
            <span className="badge" style={{ background: "rgba(255,201,60,0.2)", color: "var(--warning)", borderColor: "rgba(255,201,60,0.4)" }}>
              ★ {item.rating.toFixed(1)}
            </span>
          ) : null}
          {item.ep ? <span className="badge">EP {item.ep}</span> : null}
        </div>
        {typeof item.progress === "number" && item.progress > 0 ? (
          <div className="progress-track" style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 4, borderRadius: 0 }}>
            <div className="progress-fill" style={{ width: `${Math.min(100, item.progress)}%` }} />
          </div>
        ) : null}
      </div>
      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {item.title}
        </div>
      </div>
    </Link>
  );
}
