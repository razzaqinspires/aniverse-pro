// GET /api/user/me → AUTH. { ok:true, user:{ id, email, name, image, isDemo, createdAt, keys, xp, level } }
import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { requireSession, apiOk } from "@/lib/api-helpers";

interface MeRow {
  id: string;
  email: string | null;
  name: string | null;
  image: string | null;
  is_demo: number;
  created_at: number;
  keys: number | null;
  xp_total: number | null;
  level: number | null;
}

export async function GET(req: NextRequest) {
  const auth = await requireSession(req);
  if ("error" in auth) return auth.error;

  const db = getDb();
  const row = db
    .prepare(
      `SELECT u.id, u.email, u.name, u.image, u.is_demo, u.created_at,
              k.keys, x.xp_total, x.level
       FROM users u
       LEFT JOIN keys_balance k ON k.user_id = u.id
       LEFT JOIN xp x ON x.user_id = u.id
       WHERE u.id = ?`
    )
    .get(auth.userId) as MeRow | undefined;

  if (!row) {
    return apiOk({
      user: {
        id: auth.userId,
        email: null,
        name: null,
        image: null,
        isDemo: auth.isDemo,
        createdAt: Date.now(),
        keys: 0,
        xp: 0,
        level: 1,
      },
    });
  }

  return apiOk({
    user: {
      id: row.id,
      email: row.email,
      name: row.name,
      image: row.image,
      isDemo: row.is_demo === 1,
      createdAt: row.created_at,
      keys: row.keys ?? 0,
      xp: row.xp_total ?? 0,
      level: row.level ?? 1,
    },
  });
}
