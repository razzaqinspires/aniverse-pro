"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ApiError, apiFetch } from "./useAnime";

export const KEYS_REFRESH_EVENT = "aniverse:keys-refresh";

/** Broadcast a key-balance refresh to all KeyHUD subscribers. */
export function dispatchKeysRefresh(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(KEYS_REFRESH_EVENT));
}

export interface SpendOutcome {
  ok: boolean;
  needAd?: boolean;
  keys?: number;
}

export function useKeys() {
  const [keys, setKeys] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const prevKeysRef = useRef<number | null>(null);

  const refresh = useCallback(async (silent = false) => {
    try {
      const data = await apiFetch<{ keys: number }>("/api/keys/balance");
      setKeys(data.keys);
    } catch {
      if (!silent) toast.error("Gagal memuat saldo kunci");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + 15s poll + event-driven refresh.
  useEffect(() => {
    refresh(true);
    const interval = window.setInterval(() => refresh(true), 15_000);
    const onRefresh = () => refresh(true);
    window.addEventListener(KEYS_REFRESH_EVENT, onRefresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener(KEYS_REFRESH_EVENT, onRefresh);
    };
  }, [refresh]);

  // Toast when balance increases (e.g. ad reward / level-up grant).
  useEffect(() => {
    if (keys === null) {
      prevKeysRef.current = keys;
      return;
    }
    const prev = prevKeysRef.current;
    if (prev !== null && keys > prev) {
      toast.success(`+${keys - prev} kunci baru!`, { description: "Saldo kunci bertambah." });
    }
    prevKeysRef.current = keys;
  }, [keys]);

  const spend = useCallback(async (animeId: number, ep: number): Promise<SpendOutcome> => {
    try {
      const data = await apiFetch<{ keys: number }>("/api/keys/spend", {
        method: "POST",
        body: JSON.stringify({ animeId, ep }),
      });
      setKeys(data.keys);
      return { ok: true, keys: data.keys };
    } catch (err) {
      if (err instanceof ApiError && err.data?.needAd) {
        setKeys(0);
        return { ok: false, needAd: true };
      }
      toast.error(err instanceof Error ? err.message : "Gagal menggunakan kunci");
      return { ok: false };
    }
  }, []);

  return { keys, loading, refresh, spend, setKeys };
}
