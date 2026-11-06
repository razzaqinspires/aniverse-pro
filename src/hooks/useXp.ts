"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { MutableRefObject } from "react";
import type { XpHeartbeatResult, XpStats } from "@/lib/types";
import { ApiError, apiFetch } from "./useAnime";
import { dispatchKeysRefresh } from "./useKeys";
import { fireLevelUp } from "@/lib/confetti";

export function useXp() {
  const [stats, setStats] = useState<XpStats | null>(null);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<number | null>(null);
  const cappedNotifiedRef = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const s = await apiFetch<XpStats>("/api/xp/stats");
      setStats(s);
    } catch {
      // XP stats are non-critical; fail silently.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const stopHeartbeat = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  /**
   * Start a 5s XP heartbeat. `playingRef` tells the server whether video is
   * actually playing (paused/tab-hidden time should not earn XP).
   */
  const startHeartbeat = useCallback(
    (playingRef: MutableRefObject<boolean>) => {
      stopHeartbeat();
      intervalRef.current = window.setInterval(async () => {
        try {
          const r = await apiFetch<XpHeartbeatResult>("/api/xp/heartbeat", {
            method: "POST",
            body: JSON.stringify({
              seconds: 5,
              hidden: document.hidden,
              playing: playingRef.current,
            }),
          });
          // Refresh full stats so progress ring / badges stay accurate.
          refresh();

          if (r.leveledUp) {
            fireLevelUp();
            toast.success(`Level Up! Sekarang Level ${r.level}`, {
              description: r.newBadges.length ? `Badge baru: ${r.newBadges.join(", ")}` : undefined,
            });
          } else if (r.newBadges.length > 0) {
            toast.success(`Badge baru: ${r.newBadges.join(", ")}`);
          }
          if (r.rewardKeysGranted > 0) {
            toast.success(`+${r.rewardKeysGranted} kunci bonus dari level!`);
            dispatchKeysRefresh();
          }
          if (r.capped && !cappedNotifiedRef.current) {
            cappedNotifiedRef.current = true;
            toast.info("Cap XP harian tercapai", { description: "XP hari ini sudah maksimal. Lanjut besok!" });
          }
        } catch (err) {
          if (err instanceof ApiError && err.status === 401) {
            stopHeartbeat();
          }
        }
      }, 5_000);
    },
    [refresh, stopHeartbeat],
  );

  useEffect(() => stopHeartbeat, [stopHeartbeat]);

  return { stats, loading, refresh, startHeartbeat, stopHeartbeat };
}
