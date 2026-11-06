"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import type { HistoryItem } from "@/lib/types";
import { ApiError, apiFetch } from "@/hooks/useAnime";
import AnimeCard from "@/components/AnimeCard";
import AnimeGridSkeleton from "@/components/AnimeGridSkeleton";
import EmptyState from "@/components/EmptyState";

function formatProgress(seconds: number): string {
  if (!seconds || seconds <= 0) return "Belum ditonton";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")} ditonton`;
}

function formatDate(ts: number): string {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "";
  }
}

export default function HistoryPage() {
  const router = useRouter();
  const { status } = useSession();
  const [items, setItems] = useState<HistoryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
      return;
    }
    if (status !== "authenticated") return;
    let alive = true;
    apiFetch<{ items: HistoryItem[] }>("/api/history")
      .then((d) => { if (alive) setItems(d.items); })
      .catch((err: unknown) => {
        if (!alive) return;
        if (err instanceof ApiError && err.status === 401) {
          router.replace("/login");
        } else {
          setError(err instanceof Error ? err.message : "Gagal memuat riwayat");
        }
      });
    return () => { alive = false; };
  }, [status, router]);

  if (status === "loading" || status === "unauthenticated") {
    return (
      <div className="container-x" style={{ paddingTop: 120, display: "flex", justifyContent: "center" }}>
        <div className="spinner" role="status" aria-label="Memuat" />
      </div>
    );
  }

  return (
    <div className="container-x" style={{ paddingTop: 32, paddingBottom: 40 }}>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 26, margin: "0 0 20px" }}>Riwayat Tonton</h1>

      {!items && !error ? (
        <AnimeGridSkeleton count={8} />
      ) : error ? (
        <EmptyState emoji="⚠️" title="Gagal memuat riwayat" description={error} ctaLabel="Coba Lagi" onCtaClick={() => { toast.info("Memuat ulang..."); window.location.reload(); }} />
      ) : (items ?? []).length === 0 ? (
        <EmptyState
          emoji="🕘"
          title="Belum ada riwayat tonton"
          description="Anime yang kamu tonton akan muncul di sini agar mudah dilanjutkan."
          ctaLabel="Jelajahi Anime"
          ctaHref="/"
        />
      ) : (
        <div className="anime-grid">
          {(items ?? []).map((it) => (
            <div key={`${it.animeId}-${it.ep}-${it.id}`} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <AnimeCard item={{ id: it.animeId, title: it.title, image: it.image, ep: it.ep, progress: Math.min(100, (it.progress / (24 * 60)) * 100) }} />
              <div style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", justifyContent: "space-between" }}>
                <span>{formatProgress(it.progress)}</span>
                {it.updatedAt ? <span>{formatDate(it.updatedAt)}</span> : null}
              </div>
              <Link href={`/watch/${it.animeId}/${it.ep}`} className="btn btn-ghost" style={{ padding: "6px 12px", fontSize: 12, justifyContent: "center" }}>
                ▶ Lanjutkan EP {it.ep}
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
