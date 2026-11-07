// Compatibility shim — DB access now goes through the StorageAdapter layer (see src/lib/storage/).
// Kept so existing imports (`import { getOrCreateUser, nextMidnight } from "@/lib/db"`) keep working.

import { getStorage, activeStorageName } from "./storage";
import { nextMidnightFrom } from "./config";

export { nextMidnightFrom as nextMidnight, activeStorageName };

export async function getOrCreateUser(
  id: string,
  opts: { email?: string | null; name?: string | null; image?: string | null; isDemo: boolean }
): Promise<{ id: string; is_demo: number }> {
  return getStorage().getOrCreateUser(id, opts);
}
