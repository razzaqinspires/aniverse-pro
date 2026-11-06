// Central runtime config — every tunable lives here, sourced from env with safe defaults.

export const config = {
  databasePath: process.env.DATABASE_PATH || "./data/aniverse.db",
  nextauthSecret: process.env.NEXTAUTH_SECRET || "dev-only-secret-change-me-in-production",
  nextauthUrl: process.env.NEXTAUTH_URL || "http://localhost:3000",
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || "",

  startingKeys: parseInt(process.env.STARTING_KEYS || "3", 10),
  adDurationSec: parseInt(process.env.AD_DURATION || "30", 10),
  adRewardKeys: parseInt(process.env.AD_REWARD_KEYS || "3", 10),

  xpPerSecond: parseInt(process.env.XP_PER_SECOND || "1", 10),
  xpDailyCap: parseInt(process.env.XP_DAILY_CAP || "7200", 10), // 2 jam @ 1xp/detik
  xpHeartbeatIntervalSec: 5,

  // Comma-separated or JSON list of upstream video provider base URLs, tried in order.
  // Empty / unset => only the built-in Demo server is used (always works, royalty-free sample).
  animeProviders: parseProviders(process.env.ANIME_PROVIDERS || ""),

  rateLimitPerMinute: parseInt(process.env.RATE_LIMIT_PER_MIN || "30", 10),
  bodySizeLimit: "1mb",
} as const;

function parseProviders(raw: string): string[] {
  if (!raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((x) => typeof x === "string");
  } catch {
    // fall through to comma split
  }
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isGoogleConfigured(): boolean {
  return Boolean(config.googleClientId && config.googleClientSecret);
}
