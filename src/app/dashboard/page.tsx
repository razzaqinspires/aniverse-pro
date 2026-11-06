"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useXp } from "@/hooks/useXp";
import { useKeys } from "@/hooks/useKeys";
import Skeleton from "@/components/Skeleton";

const BADGE_ICONS: Record<string, string> = {
  "first-watch": "🎬",
  "marathon": "🏃",
  "night-owl": "🦉",
  "early-bird": "🐦",
  "social": "🤝",
  "ad-watcher": "📺",
  "speed-runner": "⚡",
  "completionist": "🏅",
};

function badgeIcon(name: string): string {
  return BADGE_ICONS[name] ?? "🏆";
}

export default function DashboardPage() {
  const router = useRouter();
  const { status } = useSession();
  const { stats, loading } = useXp();
  const { keys } = useKeys();

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  if (status === "loading" || status === "unauthenticated") {
    return (
      <div className="container-x" style={{ paddingTop: 120, display: "flex", justifyContent: "center" }}>
        <div className="spinner" role="status" aria-label="Memuat" />
      </div>
    );
  }

  const pct = Math.max(0, Math.min(100, stats?.progressPct ?? 0));
  const dailyPct = stats?.dailyCap ? Math.min(100, ((stats?.xpToday ?? 0) / stats.dailyCap) * 100) : 0;
  const badges = stats?.badges ?? [];

  return (
    <div className="container-x" style={{ paddingTop: 32, paddingBottom: 40, maxWidth: 900 }}>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 26, margin: "0 0 20px" }}>Dashboard XP</h1>

      {/* Level hero */}
      <div className="card fade-up" style={{ padding: 28, display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
        <div
          className="lvl-ring"
          style={{ width: 120, height: 120, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, "--p": pct } as React.CSSProperties}
          role="progressbar"
          aria-valuenow={Math.round(pct)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Progress ke level berikutnya ${Math.round(pct)}%`}
        >
          <div style={{ width: 108, height: 108, borderRadius: "50%", background: "var(--bg-card)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>LEVEL</span>
            <span style={{ fontSize: 36, fontWeight: 900, color: "var(--accent-2)", lineHeight: 1 }}>{loading ? "—" : stats?.level ?? 1}</span>
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 220 }}>
          <h2 style={{ margin: "0 0 4px", fontSize: 20 }}>
            {loading ? "Memuat..." : `Level ${stats?.level ?? 1}`}
          </h2>
          <p style={{ margin: "0 0 12px", color: "var(--text-soft)", fontSize: 14 }}>
            {stats ? `${stats.xpToNext ?? 0} XP lagi menuju Level ${(stats.level ?? 1) + 1}.` : "—"}
          </p>
          <div style={{ marginBottom: 6, display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-muted)" }}>
            <span>Progress</span>
            <span>{pct.toFixed(0)}%</span>
          </div>
          <div className="progress-track" style={{ height: 10 }}>
            <div className="progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <div style={{ marginTop: 14, display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13 }}>
            <span>⚡ Total XP: <strong>{stats?.xp ?? 0}</strong></span>
            <span>🔑 Kunci: <strong>{keys ?? "—"}</strong></span>
          </div>
        </div>
      </div>

      {/* Daily cap */}
      <div className="card" style={{ padding: 20, marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h3 style={{ margin: 0, fontSize: 15 }}>XP Hari Ini</h3>
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{stats?.xpToday ?? 0} / {stats?.dailyCap ?? 0} XP</span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${dailyPct}%`, background: dailyPct >= 100 ? "var(--success)" : undefined }} />
        </div>
        <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
          {dailyPct >= 100 ? "Cap harian tercapai! XP akan direset besok." : "Terus tonton untuk mengumpulkan XP hari ini."}
        </p>
      </div>

      {/* Badges */}
      <div className="card" style={{ padding: 20, marginTop: 16 }}>
        <h3 style={{ margin: "0 0 12px", fontSize: 15 }}>Badge ({badges.length})</h3>
        {loading ? (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} width={110} height={44} style={{ borderRadius: "var(--radius-md)" }} />
            ))}
          </div>
        ) : badges.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: 13, margin: 0 }}>
            Belum ada badge. Mulai tonton anime untuk mendapatkan badge pertama! 🎬
          </p>
        ) : (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {badges.map((b) => (
              <div key={b} className="badge" style={{ fontSize: 13, padding: "8px 14px", background: "rgba(255,61,110,0.1)", borderColor: "rgba(255,61,110,0.3)", color: "var(--text)" }}>
                <span aria-hidden="true">{badgeIcon(b)}</span> {b.replace(/-/g, " ")}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginTop: 20, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Link href="/" className="btn btn-primary">🎬 Tonton Sekarang</Link>
        <Link href="/history" className="btn btn-ghost">🕘 Riwayat Tonton</Link>
      </div>
    </div>
  );
}
