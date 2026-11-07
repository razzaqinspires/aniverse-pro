// Small client-side format helpers shared by v2 features (notifications,
// comments, continue-watching). Kept outside src/lib (backend-owned).

/** Format seconds as "Xm Ys" (e.g. "3m 25s"). */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0m 0s";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

/** Indonesian relative time: "x menit/jam/hari yang lalu" from an epoch-ms ts. */
export function relativeTime(ts: number): string {
  if (!Number.isFinite(ts) || ts <= 0) return "";
  const diff = Date.now() - ts;
  if (diff < 0) return "baru saja";
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "baru saja";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} menit yang lalu`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} jam yang lalu`;
  const day = Math.floor(hour / 24);
  if (day < 30) return `${day} hari yang lalu`;
  try {
    return new Date(ts).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "";
  }
}

/** Initials from a name (up to 2 letters, uppercase). */
export function initialsOf(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "?").toUpperCase() + (parts[1]?.[0] ?? "").toUpperCase();
}
