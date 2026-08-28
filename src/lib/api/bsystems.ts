import type { CurrentUser } from "@/lib/auth/guards";
import type { OwnerType, Role } from "@/lib/pipeline-engine/constants";
import { ApiError } from "@/lib/api-error";

/* V2 role helpers for the B-Systems API surface. */

/* ADR-067 — the TOTAL twin of `bsRoleOf`, for the merged shell.

   `bsRoleOf` THROWS for an account with no B-Systems role, and that is right
   for the API namespace: handleRoute turns the throw into a 403. It was also
   unreachable from a page, because the B-Systems layout guard bounced a
   ByteForce-only account before any page ran.

   The merged shell admits `byteforce_staff`, so every one of those page call
   sites became reachable overnight — an uncaught throw in a server component
   is a 500, and in the LAYOUT it would 500 the whole app for a ByteForce-only
   teammate instead of showing him his own CRM. Pages ask this one and redirect
   on null; API routes keep the throwing one. */
export function bsRoleOrNull(user: CurrentUser): Role | null {
  try {
    return bsRoleOf(user);
  } catch {
    return null;
  }
}

export function bsRoleOf(user: CurrentUser): Role {
  if (user.roles.includes("bsystems_admin")) return "bsystems_admin";
  if (user.roles.includes("bsystems_sales")) return "bsystems_sales";
  if (user.roles.includes("bsystems_agent")) return "bsystems_agent";
  if (user.roles.includes("bsystems_partner")) return "bsystems_partner";
  if (user.roles.includes("bsystems_data_entry")) return "bsystems_data_entry";
  throw new ApiError(403, "No B-Systems access");
}

/** The owner bucket a creator's new lead lands in (V2 §2.2). */
export function bucketFor(role: Role): { ownerType: OwnerType; owned: boolean } {
  switch (role) {
    case "bsystems_admin":
      return { ownerType: "admin", owned: true };
    case "bsystems_agent":
      return { ownerType: "agent", owned: true };
    case "bsystems_partner":
      return { ownerType: "partner", owned: true };
    default:
      /* internal sales AND data entry (ADR-051). The founder is explicit that a
         data-entry user "will not be the owner of what they add. It will be
         with no owner until the admin decides" — which is precisely A-6's
         existing unassigned state (internal bucket, no rep, no owner), not a
         new one worth inventing. */
      return { ownerType: "internal", owned: false };
  }
}
