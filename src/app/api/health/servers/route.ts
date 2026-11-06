// GET /api/health/servers → public (light IP rate-limit). { ok:true, servers: ServerHealth[] }
import { NextRequest } from "next/server";
import { serverHealth } from "@/lib/providers";
import { getClientIp, apiOk, apiError } from "@/lib/api-helpers";
import { rateLimit, clientKey } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = rateLimit(clientKey(ip), 60); // light: 60/min per IP
  if (!rl.ok) {
    return apiError(429, "Terlalu banyak permintaan. Coba lagi sebentar.", {
      retryAfterSec: rl.retryAfterSec,
    });
  }

  try {
    const servers = await serverHealth();
    return apiOk({ servers });
  } catch (err) {
    console.error("[api/health/servers]", err);
    return apiError(502, "Gagal memeriksa status server");
  }
}
