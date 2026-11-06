// Confetti effects for level-ups, ad rewards and other celebrations.
// canvas-confetti touches `document` at module load, so it MUST be lazy-imported
// inside the fire functions (never at top level) to avoid crashing SSR.

const COLORS = ["#ff3d6e", "#00e0ff", "#ffc93c", "#2ecc71"];

type ConfettiFn = (opts: Record<string, unknown>) => void;

async function getConfetti(): Promise<ConfettiFn | null> {
  if (typeof window === "undefined") return null;
  try {
    const mod = await import("canvas-confetti");
    return mod.default as ConfettiFn;
  } catch {
    return null;
  }
}

/** Big celebratory burst used on level-up. */
export async function fireLevelUp(): Promise<void> {
  const confetti = await getConfetti();
  if (!confetti) return;
  confetti({ particleCount: 140, spread: 100, origin: { y: 0.6 }, colors: COLORS, disableForReducedMotion: true });
  const end = Date.now() + 1200;
  (function frame() {
    confetti({ particleCount: 4, angle: 60, spread: 60, origin: { x: 0, y: 0.7 }, colors: COLORS, disableForReducedMotion: true });
    confetti({ particleCount: 4, angle: 120, spread: 60, origin: { x: 1, y: 0.7 }, colors: COLORS, disableForReducedMotion: true });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}

/** Smaller burst for ad-complete / key rewards. */
export async function fireSuccess(): Promise<void> {
  const confetti = await getConfetti();
  if (!confetti) return;
  confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 }, colors: COLORS, disableForReducedMotion: true });
}
