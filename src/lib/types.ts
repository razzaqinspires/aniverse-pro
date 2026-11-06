// Shared domain types — single source of truth for API contracts.

export interface AnimeSummary {
  id: number;
  title: string;
  image: string;
  description?: string;
  year?: number;
  genres: string[];
  format?: string;
  episodes?: number;
  rating?: number;
  status?: string;
}

export interface AnimeDetail extends AnimeSummary {
  synonyms?: string[];
  duration?: number;
  studios?: string[];
  trailer?: { id: string; site: string } | null;
  relations?: { id: number; title: string; image: string; relationType: string }[];
  recommendations?: { id: number; title: string; image: string }[];
  episodesList?: { number: number; title?: string }[];
}

export interface VideoSource {
  url: string;
  type: "mp4" | "hls";
  quality?: string;
}

export interface Subtitle {
  lang: string;
  url: string;
}

export interface WatchResult {
  server: string;
  serverName: string;
  sources: VideoSource[];
  subtitles: Subtitle[];
  isDemo: boolean;
}

export interface KeyBalance {
  userId: string;
  keys: number;
}

export interface SpendResult {
  ok: boolean;
  keys: number;
  reason?: string;
}

export interface AdSession {
  watchId: string;
  durationSec: number;
  rewardKeys: number;
}

export interface AdHeartbeatResult {
  ok: boolean;
  progress: number;
  reset: boolean;
  resetReason?: string;
}

export interface AdCompleteResult {
  ok: boolean;
  granted: number;
  keys: number;
  reason?: string;
}

export interface XpStats {
  xp: number;
  level: number;
  xpToday: number;
  dailyCap: number;
  xpToNext: number;
  progressPct: number; // 0..100 within current level
  badges: string[];
}

export interface XpHeartbeatResult {
  ok: boolean;
  xp: number;
  level: number;
  xpToday: number;
  dailyCap: number;
  leveledUp: boolean;
  newBadges: string[];
  rewardKeysGranted: number;
  capped: boolean;
}

export interface HistoryItem {
  id: number;
  animeId: number;
  ep: number;
  title: string;
  image: string;
  progress: number; // seconds
  updatedAt: number;
}

export interface ServerHealth {
  id: string;
  name: string;
  ok: boolean;
  latencyMs?: number;
  isDemo: boolean;
}

export interface SessionUser {
  id: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
  isDemo: boolean;
}
