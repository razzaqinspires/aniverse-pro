// Shared API route helpers: client IP extraction, JSON error responses (no stack traces leaked),
// body size guard, and auth assertion.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { rateLimit, clientKey } from "./rate-limit";

export function getClientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

export function apiError(status: number, message: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status });
}

export function apiOk<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, ...data }, { status });
}

export async function requireSession(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { error: apiError(401, "Belum login. Silakan login terlebih dahulu.") };
  const userId = (session.user as any).id as string;
  const ip = getClientIp(req);
  const rl = rateLimit(clientKey(ip, userId));
  if (!rl.ok) {
    return { error: apiError(429, "Terlalu banyak permintaan. Coba lagi sebentar.", { retryAfterSec: rl.retryAfterSec }) };
  }
  return { session, userId, isDemo: Boolean((session.user as any).isDemo) };
}

export async function readJsonBody(req: NextRequest, maxBytes = 100 * 1024): Promise<any> {
  const cloned = req.clone();
  const buf = await cloned.arrayBuffer();
  if (buf.byteLength > maxBytes) throw new Error("BODY_TOO_LARGE");
  if (buf.byteLength === 0) return {};
  return JSON.parse(Buffer.from(buf).toString("utf-8"));
}
