"use client";

import { useCallback, useEffect, useState } from "react";

export type Theme = "dark" | "light";

const STORAGE_KEY = "aniverse-theme";
const COOKIE_KEY = "theme";

function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
}

function persistTheme(theme: Theme): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // storage unavailable — ignore
  }
  // Also set a cookie so the server layout can pre-render the correct theme.
  document.cookie = `${COOKIE_KEY}=${theme}; path=/; max-age=31536000; SameSite=Lax`;
}

export function readInitialTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // ignore
  }
  return "dark";
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("dark");

  // Hydrate from localStorage on mount (server default is dark).
  useEffect(() => {
    const t = readInitialTheme();
    setThemeState(t);
    applyTheme(t);
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    applyTheme(t);
    persistTheme(t);
  }, []);

  const toggle = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  return { theme, setTheme, toggle };
}
