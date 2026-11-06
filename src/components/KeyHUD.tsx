"use client";

import Link from "next/link";
import { useKeys } from "@/hooks/useKeys";

/**
 * Heads-up display for the user's key balance.
 * Polls every 15s + refreshes on broadcast events. Toast on balance increase
 * is handled inside useKeys.
 */
export default function KeyHUD() {
  const { keys, loading } = useKeys();
  const display = loading ? "—" : keys ?? 0;
  // Mini "fuel" gauge: each key = 10% of the bar (capped at 100%).
  const pct = Math.min(100, (keys ?? 0) * 10);

  return (
    <Link
      href="/dashboard"
      className="hud-chip"
      aria-label={`Kunci tersedia: ${display}`}
      title="Kunci tontonan — dapatkan dengan menonton iklan"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 12px",
        borderRadius: "var(--radius-full)",
        border: "1px solid var(--border)",
        minWidth: 78,
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
      </svg>
      <span style={{ fontWeight: 700, fontSize: 14, minWidth: 14, textAlign: "center" }}>{display}</span>
      <span
        className="progress-track"
        aria-hidden="true"
        style={{ width: 32, height: 4, marginLeft: 2 }}
      >
        <span className="progress-fill" style={{ width: `${pct}%` }} />
      </span>
    </Link>
  );
}
