"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { ApiError, apiFetch } from "@/hooks/useAnime";
import AnimeCard from "@/components/AnimeCard";
import AnimeGridSkeleton from "@/components/AnimeGridSkeleton";
import EmptyState from "@/components/EmptyState";

type WatchlistStatus = "plan_to_watch" | "watching" | "completed";
interface WatchlistItem {
  animeId: number;
  title: string;
  image: string;
  status: WatchlistStatus;
  updatedAt: number;
}
const TABS: { key: "all" | WatchlistStatus; label: string }[] = [
  { key: "all", label: "Semua" },
  { key: "watching", label: "Sedang Ditonton" },
  { key: "completed", label: "Selesai" },
  { key: "plan_to_watch", label: "Rencana Tonton" },
];
const STATUS_LABEL: Record<WatchlistStatus, string> = {
  watching: "Sedang Ditonton",
  completed: "Selesai",
  plan_to_watch: "Rencana Tonton",
};

export default function WatchlistPage() {
  const router = useRouter();
  const { status } = useSession();
  const [items, setItems] = useState<WatchlistItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"all" | WatchlistStatus>("all");
  const [removing, setRemoving] = useState<Set<number>>(new Set());

  const load = useCallback(() => {
    let alive = true;
    setError(null);
    apiFetch<{ items: WatchlistItem[] }>("/api/watchlist?status=all")
      .then((d) => { if (alive) setItems(d.items ?? []); })
      .catch((err: unknown) => {
        if (!alive) return;
        if (err instanceof ApiError && err.status === 401) {
          router.replace("/login");
        } else {
          setError(err instanceof Error ? err.message : "Gagal memuat watchlist");
        }
      });
    return () => { alive = false; };
  }, [router]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
      return;
    }
    if (status !== "authenticated") return;
    return load();
  }, [status, router, load]);

  const handleRemove = useCallback(
    async (animeId: number, title: string) => {
      setRemoving((prev) => new Set(prev).add(animeId));
      try {
        await apiFetch(`/api/watchlist?animeId=${animeId}`, { method: "DELETE" });
        setItems((prev) => (prev ?? []).filter((it) => it.animeId !== animeId));
        toast.success("Dihapus dari watchlist", { description: title });
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          router.replace("/login");
        } else {
          toast.error(err instanceof Error ? err.message : "Gagal menghapus");
        }
      } finally {
        setRemoving((prev) => {
          const next = new Set(prev);
          next.delete(animeId);
          return next;
        });
      }
    },
    [router],
  );

  const sorted = useMemo(
    () => [...(items ?? [])].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)),
    [items],
  );
  const filtered = useMemo(
    () => (tab === "all" ? sorted : sorted.filter((it) => it.status === tab)),
    [sorted, tab],
  );

  if (status === "loading" || status === "unauthenticated") {
    return (
      <div className="container-x" style={{ paddingTop: 120, display: "flex", justifyContent: "center" }}>
        <div className="spinner" role="status" aria-label="Memuat" />
      </div>
    );
  }

  return (
    <div className="container-x" style={{ paddingTop: 32, paddingBottom: 40 }}>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 26, margin: "0 0 16px" }}>Watchlist</h1>

      {/* Filter tabs */}
      <div role="tablist" aria-label="Filter watchlist" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.key)}
              className={active ? "btn btn-primary" : "btn btn-ghost"}
              style={{ padding: "8px 16px", fontSize: 13 }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {!items && !error ? (
        <AnimeGridSkeleton count={8} />
      ) : error ? (
        <EmptyState emoji="⚠️" title="Gagal memuat watchlist" description={error} ctaLabel="Coba Lagi" onCtaClick={() => { toast.info("Memuat ulang..."); load(); }} />
      ) : sorted.length === 0 ? (
        <EmptyState
          emoji="📺"
          title="Watchlist masih kosong"
          description="Tambahkan anime favoritmu ke watchlist agar mudah ditemukan kapan saja."
          ctaLabel="Jelajahi Anime"
          ctaHref="/"
        />
      ) : filtered.length === 0 ? (
        <EmptyState emoji="🎬" title="Tidak ada anime di kategori ini" description="Coba pilih tab lain atau tambahkan anime baru." ctaLabel="Jelajahi Anime" ctaHref="/" />
      ) : (
        <div className="anime-grid">
          {filtered.map((it) => (
            <div key={it.animeId} className="watchlist-card" style={{ position: "relative" }}>
              <AnimeCard item={{ id: it.animeId, title: it.title, image: it.image }} />
              <div style={{ marginTop: 6, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                <span className="badge" style={{ fontSize: 10 }}>{STATUS_LABEL[it.status] ?? it.status}</span>
              </div>
              <button
                type="button"
                aria-label={`Hapus ${it.title} dari watchlist`}
                title="Hapus dari watchlist"
                disabled={removing.has(it.animeId)}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleRemove(it.animeId, it.title);
                }}
                className="watchlist-remove"
                style={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  border: "none",
                  background: "rgba(0,0,0,0.65)",
                  color: "#fff",
                  fontSize: 16,
                  fontWeight: 700,
                  lineHeight: 1,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: 0,
                  transition: "opacity var(--transition), transform var(--transition)",
                  zIndex: 2,
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .watchlist-card:hover .watchlist-remove { opacity: 1; }
        .watchlist-remove:hover { background: var(--danger) !important; transform: scale(1.1); }
      `}</style>
    </div>
  );
}
