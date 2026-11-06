"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AnimeDetail, AnimeSummary } from "@/lib/types";

// ---------------------------------------------------------------------------
// Shared typed fetch helper. All /api routes return { ok: boolean, ... }.
// On !ok (or non-2xx) we throw an ApiError carrying the parsed body so callers
// can inspect fields like `needAd` / `error`.
// ---------------------------------------------------------------------------
export class ApiError extends Error {
  status: number;
  data: Record<string, unknown>;
  constructor(status: number, data: Record<string, unknown>) {
    super((data?.error as string) || `Request gagal (${status})`);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

export async function apiFetch<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  let data: Record<string, unknown> = {};
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    data = {};
  }
  if (!res.ok || data.ok === false) {
    throw new ApiError(res.status, data);
  }
  return data as unknown as T;
}

/** Retry with exponential backoff (400ms, 800ms, 1600ms...). */
export async function fetchWithRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  baseDelayMs = 400,
): Promise<T> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      // Don't retry client errors (4xx except 429) — they won't improve.
      if (err instanceof ApiError && err.status >= 400 && err.status < 500 && err.status !== 429) {
        throw err;
      }
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** attempt));
      }
    }
  }
  throw lastError;
}

export interface PageInfo {
  currentPage: number;
  hasNextPage: boolean;
  totalPerPage?: number;
}

export interface BrowseResult {
  results: AnimeSummary[];
  pageInfo: PageInfo;
}

export type BrowseSort = "TRENDING_DESC" | "POPULARITY_DESC" | "SCORE_DESC" | "START_DATE_DESC";

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------
interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

function useAsync<T>(fetcher: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    setLoading(true);
    setError(null);
    fetchWithRetry(fetcher)
      .then((d) => {
        if (!alive.current) return;
        setData(d);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!alive.current) return;
        setError(err instanceof Error ? err.message : "Gagal memuat data");
        setLoading(false);
      });
    return () => {
      alive.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, error, reload };
}

export function useBrowse(sort: BrowseSort, page = 1): AsyncState<BrowseResult> {
  const fetcher = useCallback(
    () => apiFetch<BrowseResult>(`/api/anime/browse?sort=${sort}&page=${page}`),
    [sort, page],
  );
  return useAsync(fetcher, [sort, page]);
}

export function useSearch(q: string, page = 1): AsyncState<BrowseResult> {
  const fetcher = useCallback(() => {
    if (!q.trim()) return Promise.resolve({ results: [], pageInfo: { currentPage: 1, hasNextPage: false } });
    return apiFetch<BrowseResult>(`/api/anime/search?q=${encodeURIComponent(q.trim())}&page=${page}`);
  }, [q, page]);
  return useAsync(fetcher, [q, page]);
}

export function useDetail(id: number | null): AsyncState<AnimeDetail> {
  const fetcher = useCallback(() => {
    if (id == null) return Promise.reject(new ApiError(400, { error: "ID tidak valid" }));
    return apiFetch<{ anime: AnimeDetail }>(`/api/anime/detail?id=${id}`).then((d) => d.anime);
  }, [id]);
  return useAsync(fetcher, [id]);
}
