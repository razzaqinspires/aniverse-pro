// GET /api/user/me → AUTH. { ok:true, user:{ id, email, name, image, isDemo, createdAt, keys, xp, level, storage } }
import { NextRequest } from "next/server";
import { getStorage, buildUserProfile, activeStorageName } from "@/lib/storage";
import { requireSession, apiOk } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const auth = await requireSession(req);
  if ("error" in auth) return auth.error;
  const profile = await buildUserProfile(getStorage(), auth.userId, auth.isDemo);
  return apiOk({ user: { ...profile, storage: activeStorageName() } });
}
