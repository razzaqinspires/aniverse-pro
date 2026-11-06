"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Plyr from "plyr";
import Hls from "hls.js";
import type { MutableRefObject } from "react";
import type { Subtitle, VideoSource } from "@/lib/types";

interface VideoPlayerProps {
  sources: VideoSource[];
  subtitles?: Subtitle[];
  serverName: string;
  /** Called when the stream is dead (player error or >10s buffering). */
  onError: () => void;
  /** Throttled progress callback (every ~5s) for history saving. */
  onProgress?: (seconds: number) => void;
  /** Parent reads this to know whether XP should be earned. */
  playingRef?: MutableRefObject<boolean>;
  autoPlay?: boolean;
}

function qualityLabel(src: VideoSource, index: number): string {
  if (src.quality) return src.quality;
  return src.type === "hls" ? "Auto (HLS)" : `Source ${index + 1}`;
}

export default function VideoPlayer({
  sources,
  subtitles = [],
  serverName,
  onError,
  onProgress,
  playingRef,
  autoPlay = true,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const plyrRef = useRef<Plyr | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const bufferingTimerRef = useRef<number | null>(null);
  const errorFiredRef = useRef(false);
  const lastSaveRef = useRef(0);
  const onErrorRef = useRef(onError);
  const onProgressRef = useRef(onProgress);
  const playingRefInner = useRef(false);
  const [activeQuality, setActiveQuality] = useState(0);

  onErrorRef.current = onError;
  onProgressRef.current = onProgress;

  const clearBufferingTimer = useCallback(() => {
    if (bufferingTimerRef.current !== null) {
      window.clearTimeout(bufferingTimerRef.current);
      bufferingTimerRef.current = null;
    }
  }, []);

  const reportDeadStream = useCallback(
    (reason: string) => {
      if (errorFiredRef.current) return;
      errorFiredRef.current = true;
      clearBufferingTimer();
      // eslint-disable-next-line no-console
      console.warn("[VideoPlayer] stream dianggap mati:", reason);
      onErrorRef.current();
    },
    [clearBufferingTimer],
  );

  const destroyHls = useCallback(() => {
    if (hlsRef.current) {
      try {
        hlsRef.current.destroy();
      } catch {
        // ignore
      }
      hlsRef.current = null;
    }
  }, []);

  const loadSource = useCallback(
    (index: number) => {
      const player = plyrRef.current;
      const video = videoRef.current;
      if (!player || !video) return;
      const source = sources[index];
      if (!source) return;

      errorFiredRef.current = false;
      clearBufferingTimer();
      destroyHls();

      const mime = source.type === "hls" ? "application/x-mpegURL" : "video/mp4";
      const tracks = subtitles.map((s, i) => ({
        kind: "captions" as const,
        label: s.lang,
        src: s.url,
        srclang: s.lang,
        default: i === 0,
      }));

      player.source = {
        type: "video",
        title: serverName,
        sources: [{ src: source.url, type: mime }],
        tracks,
      };

      if (source.type === "hls" && Hls.isSupported()) {
        const hls = new Hls({ enableWorker: true, lowLatencyMode: false });
        hlsRef.current = hls;
        hls.loadSource(source.url);
        hls.attachMedia(video);
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            reportDeadStream(`HLS fatal: ${data.type}`);
          }
        });
      }

      if (autoPlay) {
        video.play().catch(() => {
          // Autoplay blocked — user can press play.
        });
      }
    },
    [sources, subtitles, serverName, autoPlay, clearBufferingTimer, destroyHls, reportDeadStream],
  );

  // Create Plyr once + wire events + keyboard shortcuts.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const player = new Plyr(video, {
      controls: [
        "play-large",
        "play",
        "progress",
        "current-time",
        "duration",
        "mute",
        "volume",
        "captions",
        "settings",
        "pip",
        "airplay",
        "fullscreen",
      ],
      settings: ["captions", "speed"],
      speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 2] },
      keyboard: { focused: true, global: false },
      tooltips: { controls: true, seek: true },
      seekTime: 10,
      volume: 0.8,
    });
    plyrRef.current = player;

    const setPlaying = (v: boolean) => {
      playingRefInner.current = v;
      if (playingRef) playingRef.current = v;
    };

    const onPlay = () => {
      setPlaying(true);
      clearBufferingTimer();
    };
    const onPause = () => setPlaying(false);
    const onWaiting = () => {
      setPlaying(false);
      clearBufferingTimer();
      bufferingTimerRef.current = window.setTimeout(() => {
        reportDeadStream("buffering >10 detik");
      }, 10_000);
    };
    const onPlaying = () => {
      setPlaying(true);
      clearBufferingTimer();
    };
    const onPlayerError = () => reportDeadStream("player error event");
    const onTimeUpdate = () => {
      const now = Date.now();
      if (now - lastSaveRef.current >= 5_000) {
        lastSaveRef.current = now;
        onProgressRef.current?.(video.currentTime);
      }
    };

    player.on("play", onPlay);
    player.on("pause", onPause);
    player.on("waiting", onWaiting);
    player.on("playing", onPlaying);
    player.on("canplay", onPlaying);
    player.on("error", onPlayerError);
    player.on("timeupdate", onTimeUpdate);
    video.addEventListener("error", onPlayerError);

    // Global keyboard shortcuts (ignored while typing in form fields).
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable)) {
        return;
      }
      const p = plyrRef.current;
      if (!p) return;
      switch (e.key) {
        case " ":
          e.preventDefault();
          p.togglePlay();
          break;
        case "f":
        case "F":
          p.fullscreen.toggle();
          break;
        case "m":
        case "M":
          p.muted = !p.muted;
          break;
        case "ArrowLeft":
          e.preventDefault();
          p.currentTime = Math.max(0, p.currentTime - 10);
          break;
        case "ArrowRight":
          e.preventDefault();
          p.currentTime = Math.min((p.duration || 0), p.currentTime + 10);
          break;
        case "ArrowUp":
          e.preventDefault();
          p.volume = Math.min(1, p.volume + 0.1);
          break;
        case "ArrowDown":
          e.preventDefault();
          p.volume = Math.max(0, p.volume - 0.1);
          break;
        default:
          break;
      }
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      player.off("play", onPlay);
      player.off("pause", onPause);
      player.off("waiting", onWaiting);
      player.off("playing", onPlaying);
      player.off("canplay", onPlaying);
      player.off("error", onPlayerError);
      player.off("timeupdate", onTimeUpdate);
      video.removeEventListener("error", onPlayerError);
      document.removeEventListener("keydown", onKeyDown);
      clearBufferingTimer();
      destroyHls();
      try {
        player.destroy();
      } catch {
        // ignore
      }
      plyrRef.current = null;
      setPlaying(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load first source whenever the source list changes (e.g. server switch).
  useEffect(() => {
    setActiveQuality(0);
    // Plyr is created in the mount effect; wait a tick if needed.
    const id = window.setTimeout(() => loadSource(0), 0);
    return () => window.clearTimeout(id);
  }, [loadSource]);

  const pickQuality = (index: number) => {
    setActiveQuality(index);
    loadSource(index);
  };

  return (
    <div style={{ position: "relative" }}>
      <video ref={videoRef} playsInline style={{ width: "100%" }} aria-label={`Pemain video — server ${serverName}`} />

      {sources.length > 1 && (
        <div
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            zIndex: 3,
            display: "flex",
            gap: 4,
            background: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(6px)",
            padding: "4px 6px",
            borderRadius: "var(--radius-full)",
          }}
          role="group"
          aria-label="Pilih kualitas"
        >
          {sources.map((s, i) => (
            <button
              key={`${s.url}-${i}`}
              type="button"
              onClick={() => pickQuality(i)}
              aria-pressed={i === activeQuality}
              style={{
                border: "none",
                background: i === activeQuality ? "var(--accent-gradient)" : "transparent",
                color: "#fff",
                fontSize: 11,
                fontWeight: 700,
                padding: "4px 10px",
                borderRadius: "var(--radius-full)",
                cursor: "pointer",
              }}
            >
              {qualityLabel(s, i)}
            </button>
          ))}
        </div>
      )}

      <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-muted)" }}>
        Server: <strong style={{ color: "var(--text-soft)" }}>{serverName}</strong>
        {" • "}Pintasan: Spasi play/jeda, ←/→ maju-mundur 10 detik, ↑/↓ volume, F layar penuh, M bisu.
      </div>
    </div>
  );
}
