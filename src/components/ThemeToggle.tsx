"use client";

import { useTheme } from "@/hooks/useTheme";

/** Dark/Light toggle button with sun/moon SVG icons. */
export default function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      className="hud-chip"
      aria-label={isDark ? "Beralih ke mode terang" : "Beralih ke mode gelap"}
      title={isDark ? "Mode Terang" : "Mode Gelap"}
      style={{
        width: 38,
        height: 38,
        borderRadius: "var(--radius-full)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        border: "1px solid var(--border)",
        background: "rgba(255,255,255,0.05)",
        color: "var(--text)",
        cursor: "pointer",
      }}
    >
      {isDark ? (
        // Sun icon
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      ) : (
        // Moon icon
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}
