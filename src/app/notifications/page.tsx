"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { ApiError, apiFetch } from "@/hooks/useAnime";
import { relativeTime } from "@/utils/format";
import EmptyState from "@/components/EmptyState";

interface NotificationItem {
  animeId: number;
  title: string;
  image: string;
  episode: number;
  airingAt: number;
}

export default function NotificationsPage() {
  const router = useRouter();
  const { status } = useSession();
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
      return;
    }
    if (status !== "authenticated") return;
    let alive = true;
    apiFetch<{ items: NotificationItem[]; unread: number }>("/api/notifications")
      .then((d) => { if (alive) setItems(d.items ?? []); })
      .catch((err: unknown) => {
        if (!alive) return;
        if (err instanceof ApiError && err.status === 401) {
          router.replace("/login");
        } else {
          setError(err instanceof Error ? err.message : "Gagal memuat notifikasi");
        }
      });
    // Mark as seen after rendering (best-effort, clears navbar badge).
    const id = window.setTimeout(() => {
      apiFetch("/api/notifications", {
        method: "POST",
        body: JSON.stringify({ action: "seen" }),
      }).catch(() => { /* ignore */ });
    }, 500);
    return () => { alive = false; window.clearTimeout(id); };
  }, [status, router]);

  if (status === "loading" || status === "unauthenticated") {
    return (
      <div className="container-x" style={{ paddingTop: 120, display: "flex", justifyContent: "center" }}>
        <div className="spinner" role="status" aria-label="Memuat" />
      </div>
    );
  }

  const sorted = [...(items ?? [])].sort((a, b) => (b.airingAt ?? 0) - (a.airingAt ?? 0));

  return (
    <div className="container-x" style={{ paddingTop: 32, paddingBottom: 40, maxWidth: 820 }}>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 26, margin: "0 0 20px" }}>Notifikasi</h1>

      {!items && !error ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 84, borderRadius: "var(--radius-md)" }} aria-hidden="true" />
          ))}
        </div>
      ) : error ? (
        <EmptyState emoji="⚠️" title="Gagal memuat notifikasi" description={error} ctaLabel="Coba Lagi" onCtaClick={() => { toast.info("Memuat ulang..."); window.location.reload(); }} />
      ) : sorted.length === 0 ? (
        <EmptyState
          emoji="🔔"
          title="Belum ada notifikasi"
          description="Tambahkan anime ke Watchlist untuk mendapat info episode baru."
          ctaLabel="Jelajahi Anime"
          ctaHref="/"
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {sorted.map((it, idx) => (
            <Link
              key={`${it.animeId}-${it.episode}-${idx}`}
              href={`/watch/${it.animeId}/${it.episode}`}
              className="card"
              style={{ display: "flex", gap: 14, padding: 12, alignItems: "center" }}
            >
              {it.image ? (
                <img
                  src={it.image}
                  alt=""
                  aria-hidden="true"
                  referrerPolicy="no-referrer"
                  style={{ width: 48, height: 72, objectFit: "cover", borderRadius: "var(--radius-sm)", flexShrink: 0 }}
                />
              ) : (
                <div style={{ width: 48, height: 72, borderRadius: "var(--radius-sm)", background: "var(--bg-hover)", flexShrink: 0 }} aria-hidden="true" />
              )}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  Episode {it.episode} dari <span className="grad-text">{it.title}</span> sudah tayang
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{relativeTime(it.airingAt)}</div>
              </div>
              <span className="badge" style={{ flexShrink: 0 }}>▶ Tonton</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
