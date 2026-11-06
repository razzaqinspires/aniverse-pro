"use client";

import Link from "next/link";
import { useXp } from "@/hooks/useXp";

/**
 * Circular XP ring showing current level and progress to the next level.
 * Uses the .lvl-ring design-system class with the --p CSS variable.
 */
export default function XpRing() {
  const { stats, loading } = useXp();
  const pct = Math.max(0, Math.min(100, stats?.progressPct ?? 0));
  const level = stats?.level ?? 1;

  return (
    <Link
      href="/dashboard"
      aria-label={`Level ${level} — ${pct.toFixed(0)}% menuju level berikutnya`}
      title={`Level ${level} • XP: ${stats?.xp ?? 0}`}
      style={{ display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none" }}
    >
      <span
        className="lvl-ring"
        style={
          {
            width: 34,
            height: 34,
            borderRadius: "50%",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            "--p": pct,
          } as React.CSSProperties
        }
      >
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: "var(--bg-card)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            fontWeight: 800,
            color: "var(--accent-2)",
          }}
        >
          {loading ? "—" : level}
        </span>
      </span>
      <span style={{ display: "none", fontSize: 12, color: "var(--text-soft)" }} className="xp-ring-label">
        Lv {level}
      </span>
    </Link>
  );
}
