// GET /api/keys/balance → AUTH. { ok:true, keys }
import { NextRequest } from "next/server";
import { getKeys } from "@/lib/keys";
import { requireSession, apiOk } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const auth = await requireSession(req);
  if ("error" in auth) return auth.error;
  return apiOk({ keys: getKeys(auth.userId) });
}
