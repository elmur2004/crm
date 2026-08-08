import { redirect } from "next/navigation";
import { requireRole, type CurrentUser } from "./guards";
import type { Role } from "@/lib/pipeline-engine/constants";

/* Page-level guard: like requireRole but redirects to the app's login instead of
   throwing (middleware already gates coarsely; this is the in-page fallback). */

export async function requirePageRole(loginPath: string, ...roles: Role[]): Promise<CurrentUser> {
  try {
    return await requireRole(...roles);
  } catch {
    redirect(loginPath);
  }
}
