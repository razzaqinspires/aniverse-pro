"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useKeys } from "@/hooks/useKeys";
import { useXp } from "@/hooks/useXp";

function initialsOf(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "?").toUpperCase() + (parts[1]?.[0] ?? "").toUpperCase();
}

export default function ProfilePage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { keys } = useKeys();
  const { stats } = useXp();
  const user = session?.user;

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

  const statsCards = [
    { label: "Kunci Tersisa", value: String(keys ?? "—"), icon: "🔑" },
    { label: "Level", value: String(stats?.level ?? 1), icon: "⭐" },
    { label: "Total XP", value: String(stats?.xp ?? 0), icon: "⚡" },
    { label: "XP Hari Ini", value: `${stats?.xpToday ?? 0} / ${stats?.dailyCap ?? 0}`, icon: "📅" },
  ];

  return (
    <div className="container-x" style={{ paddingTop: 32, paddingBottom: 40, maxWidth: 860 }}>
      <div className="card fade-up" style={{ padding: 24, display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
        {user?.image ? (
          <img src={user.image} alt="" width={72} height={72} referrerPolicy="no-referrer" style={{ borderRadius: "50%", border: "3px solid var(--accent-2)" }} />
        ) : (
          <div style={{ width: 72, height: 72, borderRadius: "50%", background: "var(--accent-gradient)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 26 }}>
            {initialsOf(user?.name)}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 200 }}>
          <h1 style={{ margin: "0 0 4px", fontSize: 22, fontFamily: "var(--font-display)" }}>{user?.name || "Pengguna"}</h1>
          <p style={{ margin: "0 0 8px", color: "var(--text-muted)", fontSize: 13 }}>{user?.email || "Tanpa email"}</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {user?.isDemo ? <span className="badge">Akun Demo</span> : <span className="badge" style={{ background: "rgba(46,204,113,0.12)", color: "var(--success)", borderColor: "rgba(46,204,113,0.3)" }}>Akun Terverifikasi</span>}
            <span className="badge">ID: {user?.id?.slice(0, 8) ?? "—"}</span>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginTop: 20 }} className="profile-stats">
        {statsCards.map((c) => (
          <div key={c.label} className="card" style={{ padding: 16, textAlign: "center" }}>
            <div style={{ fontSize: 24, marginBottom: 4 }} aria-hidden="true">{c.icon}</div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{c.value}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{c.label}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: 20, marginTop: 20 }}>
        <h2 style={{ margin: "0 0 12px", fontSize: 16 }}>Pintasan</h2>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link href="/dashboard" className="btn btn-ghost">📊 Dashboard XP</Link>
          <Link href="/history" className="btn btn-ghost">🕘 Riwayat Tonton</Link>
          <Link href="/settings" className="btn btn-ghost">⚙️ Pengaturan</Link>
          <Link href="/" className="btn btn-primary">🎬 Jelajahi Anime</Link>
        </div>
      </div>

      <style>{`
        @media (min-width: 640px) { .profile-stats { grid-template-columns: repeat(4, 1fr) !important; } }
      `}</style>
    </div>
  );
}
