"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { ApiError, apiFetch } from "@/hooks/useAnime";
import { relativeTime } from "@/utils/format";
import EmptyState from "@/components/EmptyState";

interface QueueItem {
  animeId: number;
  ep: number;
  title: string;
  image?: string;
  createdAt: number;
}

export default function DownloadsPage() {
  const router = useRouter();
  const { status } = useSession();
  const [items, setItems] = useState<QueueItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Set<string>>(new Set());

  const load = useCallback(() => {
    let alive = true;
    setError(null);
    apiFetch<{ items: QueueItem[] }>("/api/download-queue")
      .then((d) => { if (alive) setItems(d.items ?? []); })
      .catch((err: unknown) => {
        if (!alive) return;
        if (err instanceof ApiError && err.status === 401) {
          router.replace("/login");
        } else {
          setError(err instanceof Error ? err.message : "Gagal memuat antrian");
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
    async (animeId: number, ep: number, title: string) => {
      const key = `${animeId}-${ep}`;
      setRemoving((prev) => new Set(prev).add(key));
      try {
        await apiFetch(`/api/download-queue?animeId=${animeId}&ep=${ep}`, { method: "DELETE" });
        setItems((prev) => (prev ?? []).filter((it) => !(it.animeId === animeId && it.ep === ep)));
        toast.success("Dihapus dari antrian", { description: `${title} EP ${ep}` });
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          router.replace("/login");
        } else {
          toast.error(err instanceof Error ? err.message : "Gagal menghapus");
        }
      } finally {
        setRemoving((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    },
    [router],
  );

  if (status === "loading" || status === "unauthenticated") {
    return (
      <div className="container-x" style={{ paddingTop: 120, display: "flex", justifyContent: "center" }}>
        <div className="spinner" role="status" aria-label="Memuat" />
      </div>
    );
  }

  const sorted = [...(items ?? [])].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));

  return (
    <div className="container-x" style={{ paddingTop: 32, paddingBottom: 40, maxWidth: 820 }}>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 26, margin: "0 0 8px" }}>Queue Tonton Nanti</h1>
      <p style={{ color: "var(--text-muted)", fontSize: 13, margin: "0 0 20px" }}>
        Simpan episode untuk ditonton lain kali.
      </p>

      {/* Honest download-capability notice */}
      <div
        role="note"
        style={{
          marginBottom: 24,
          padding: "14px 18px",
          borderRadius: "var(--radius-md)",
          background: "rgba(0,224,255,0.08)",
          border: "1px solid rgba(0,224,255,0.3)",
          fontSize: 13,
          color: "var(--text-soft)",
          lineHeight: 1.6,
        }}
      >
        <strong style={{ color: "var(--info)" }}>Catatan:</strong> download asli hanya tersedia untuk Server Demo (mp4 publik).
        Stream HLS/m3u8 dari pihak ketiga tidak dapat di-download langsung dari browser karena CORS.
        Gunakan halaman ini sebagai antrian tonton nanti.
      </div>

      {!items && !error ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 84, borderRadius: "var(--radius-md)" }} aria-hidden="true" />
          ))}
        </div>
      ) : error ? (
        <EmptyState emoji="⚠️" title="Gagal memuat antrian" description={error} ctaLabel="Coba Lagi" onCtaClick={() => { toast.info("Memuat ulang..."); load(); }} />
      ) : sorted.length === 0 ? (
        <EmptyState emoji="⬇️" title="Antrian kosong." description="Tambahkan episode dari halaman tonton dengan tombol ⭐ Tonton Nanti." ctaLabel="Jelajahi Anime" ctaHref="/" />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {sorted.map((it, idx) => (
            <div
              key={`${it.animeId}-${it.ep}-${idx}`}
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
                  {it.title} <span style={{ color: "var(--text-muted)" }}>— EP {it.ep}</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>Ditambahkan {relativeTime(it.createdAt)}</div>
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0, alignItems: "center" }}>
                <Link href={`/watch/${it.animeId}/${it.ep}`} className="btn btn-primary" style={{ padding: "8px 14px", fontSize: 12 }}>
                  ▶ Tonton
                </Link>
                <button
                  type="button"
                  aria-label={`Hapus ${it.title} EP ${it.ep} dari antrian`}
                  title="Hapus dari antrian"
                  disabled={removing.has(`${it.animeId}-${it.ep}`)}
                  onClick={() => handleRemove(it.animeId, it.ep, it.title)}
                  className="btn btn-ghost"
                  style={{ padding: "8px 12px", fontSize: 14, minWidth: 38 }}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
