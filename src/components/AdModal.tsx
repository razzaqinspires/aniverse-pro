"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import type { AdCompleteResult, AdHeartbeatResult, AdSession } from "@/lib/types";
import { ApiError, apiFetch } from "@/hooks/useAnime";
import { dispatchKeysRefresh } from "@/hooks/useKeys";
import { fireSuccess } from "@/lib/confetti";

interface AdModalProps {
  /** Called when the ad completes and keys were granted. Parent should close + retry. */
  onSuccess: () => void;
}

type Phase = "starting" | "watching" | "completing" | "done" | "error";

/**
 * Fullscreen rewarded-ad modal with anti-bypass enforcement:
 *  - progress only advances while the tab is visible AND the window has focus;
 *  - hiding the tab / losing focus resets progress to 0 (with a toast);
 *  - server-side heartbeat every 2s can also force a reset.
 * No dismiss button — the only way out is completing the ad.
 */
export default function AdModal({ onSuccess }: AdModalProps) {
  const [phase, setPhase] = useState<Phase>("starting");
  const [session, setSession] = useState<AdSession | null>(null);
  const [progress, setProgress] = useState(0); // seconds watched
  const [errorMsg, setErrorMsg] = useState("");

  const watchIdRef = useRef<string | null>(null);
  const startedRef = useRef(false);
  const progressRef = useRef(0);
  const completingRef = useRef(false);

  const resetProgress = useCallback((reason: string) => {
    progressRef.current = 0;
    setProgress(0);
    toast.warning(reason, { description: "Progress iklan dikembalikan ke 0." });
  }, []);

  // Start the ad session once on mount.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    let cancelled = false;
    apiFetch<AdSession>("/api/keys/ad-start", { method: "POST", body: "{}" })
      .then((s) => {
        if (cancelled) return;
        watchIdRef.current = s.watchId;
        setSession(s);
        setPhase("watching");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setErrorMsg(err instanceof Error ? err.message : "Gagal memulai iklan");
        setPhase("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Anti-bypass listeners: tab hidden / window blur → reset to 0.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        resetProgress("Tab tidak aktif — iklan direset");
      }
    };
    const onBlur = () => resetProgress("Jendela tidak aktif — iklan direset");
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
    };
  }, [resetProgress]);

  // 1s tick: advance only while visible + focused.
  useEffect(() => {
    if (phase !== "watching" || !session) return;
    const tick = window.setInterval(() => {
      const visible = document.visibilityState === "visible";
      const focused = document.hasFocus();
      if (!visible || !focused) return; // paused; reset is handled by listeners
      const next = Math.min(session.durationSec, progressRef.current + 1);
      progressRef.current = next;
      setProgress(next);
      if (next >= session.durationSec) {
        completeAd();
      }
    }, 1000);
    return () => window.clearInterval(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, session]);

  // 2s server heartbeat.
  useEffect(() => {
    if (phase !== "watching" || !session) return;
    const beat = window.setInterval(async () => {
      const watchId = watchIdRef.current;
      if (!watchId) return;
      try {
        const r = await apiFetch<AdHeartbeatResult>("/api/keys/ad-heartbeat", {
          method: "POST",
          body: JSON.stringify({ watchId, progress: progressRef.current, hidden: document.hidden }),
        });
        if (r.reset) {
          progressRef.current = 0;
          setProgress(0);
          toast.warning(r.resetReason || "Server mereset progress iklan", { description: "Progress iklan dikembalikan ke 0." });
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          toast.error("Sesi berakhir. Silakan login ulang.");
        }
      }
    }, 2000);
    return () => window.clearInterval(beat);
  }, [phase, session]);

  const completeAd = useCallback(async () => {
    if (completingRef.current) return;
    completingRef.current = true;
    const watchId = watchIdRef.current;
    if (!watchId) {
      completingRef.current = false;
      return;
    }
    setPhase("completing");
    try {
      const r = await apiFetch<AdCompleteResult>("/api/keys/ad-complete", {
        method: "POST",
        body: JSON.stringify({ watchId }),
      });
      if (r.ok) {
        fireSuccess();
        toast.success(`+${r.granted} kunci!`, { description: "Kunci telah ditambahkan ke akunmu." });
        dispatchKeysRefresh();
        setPhase("done");
        // Brief delay so the user sees the success state.
        window.setTimeout(() => onSuccess(), 900);
      } else {
        throw new ApiError(400, { error: "Iklan tidak valid" });
      }
    } catch (err) {
      completingRef.current = false;
      setErrorMsg(err instanceof Error ? err.message : "Gagal menyelesaikan iklan");
      setPhase("error");
    }
  }, [onSuccess]);

  const retry = () => {
    startedRef.current = false;
    completingRef.current = false;
    progressRef.current = 0;
    setProgress(0);
    setErrorMsg("");
    setPhase("starting");
    // Re-trigger the start effect by toggling a key — simplest: reload modal state.
    window.setTimeout(() => {
      startedRef.current = false;
      apiFetch<AdSession>("/api/keys/ad-start", { method: "POST", body: "{}" })
        .then((s) => {
          watchIdRef.current = s.watchId;
          setSession(s);
          setPhase("watching");
        })
        .catch((err: unknown) => {
          setErrorMsg(err instanceof Error ? err.message : "Gagal memulai iklan");
          setPhase("error");
        });
    }, 50);
  };

  const duration = session?.durationSec ?? 30;
  const pct = Math.min(100, (progress / duration) * 100);
  const remaining = Math.max(0, duration - progress);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-label="Tonton iklan untuk mendapatkan kunci"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(5,5,12,0.92)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <motion.div
        initial={{ scale: 0.92, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", damping: 22, stiffness: 260 }}
        className="card"
        style={{ width: "100%", maxWidth: 460, padding: 28, textAlign: "center", position: "relative", overflow: "hidden" }}
      >
        {/* Fake ad creative slot */}
        <div
          aria-hidden="true"
          style={{
            height: 140,
            borderRadius: "var(--radius-md)",
            background: "linear-gradient(135deg, #ff3d6e 0%, #7b2ff7 50%, #00e0ff 100%)",
            backgroundSize: "200% 200%",
            animation: "adShimmer 3s ease infinite",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontWeight: 800,
            fontSize: 22,
            marginBottom: 20,
            letterSpacing: 2,
          }}
        >
          IKLAN
        </div>
        <style>{`@keyframes adShimmer { 0%,100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }`}</style>

        <h2 style={{ margin: "0 0 6px", fontSize: 20 }}>Tonton iklan untuk dapat kunci</h2>
        <p style={{ margin: "0 0 20px", color: "var(--text-soft)", fontSize: 14 }}>
          {phase === "starting" && "Memulai iklan..."}
          {phase === "watching" && `Jangan pindah tab — progress akan direset. Sisa ${remaining} detik.`}
          {phase === "completing" && "Memproses hadiah..."}
          {phase === "done" && "Berhasil! Kunci telah ditambahkan."}
          {phase === "error" && "Terjadi kesalahan."}
        </p>

        {phase !== "error" ? (
          <>
            <div className="progress-track" style={{ height: 12, marginBottom: 10 }} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
              <div className="progress-fill" style={{ width: `${pct}%` }} />
            </div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
              {Math.round(pct)}% • +{session?.rewardKeys ?? 3} kunci
            </div>
            <div className="badge" style={{ fontSize: 12 }}>
              {phase === "watching" ? "Tab ini harus tetap aktif & terfokus" : phase === "done" ? "Selesai" : "Memproses..."}
            </div>
          </>
        ) : (
          <div>
            <p style={{ color: "var(--danger)", fontSize: 14, marginBottom: 16 }}>{errorMsg}</p>
            <button type="button" className="btn btn-primary" onClick={retry}>Coba Lagi</button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
