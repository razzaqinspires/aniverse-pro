// Simple in-memory sliding-window rate limiter per (ip + userId).
// Optional Redis via env REDIS_URL is documented in .env.example but in-memory is the default
// (single-instance deploy). Swap implementation here without changing call sites.

import { config } from "./config";

interface Bucket {
  hits: number[];
}
const store = new Map<string, Bucket>();

const WINDOW_MS = 60_000;

export function rateLimit(key: string, limit = config.rateLimitPerMinute): { ok: boolean; remaining: number; retryAfterSec?: number } {
  const now = Date.now();
  const bucket = store.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((t) => now - t < WINDOW_MS);
  if (bucket.hits.length >= limit) {
    store.set(key, bucket);
    const oldest = bucket.hits[0];
    return { ok: false, remaining: 0, retryAfterSec: Math.ceil((WINDOW_MS - (now - oldest)) / 1000) };
  }
  bucket.hits.push(now);
  store.set(key, bucket);
  return { ok: true, remaining: limit - bucket.hits.length };
}

export function clientKey(ip: string, userId?: string | null): string {
  return `${ip}|${userId ?? "anon"}`;
}

// Periodic cleanup to avoid unbounded memory growth
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of store) {
    b.hits = b.hits.filter((t) => now - t < WINDOW_MS);
    if (b.hits.length === 0) store.delete(k);
  }
}, 5 * 60_000).unref?.();
