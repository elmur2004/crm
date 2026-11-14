import { formatMsg, tFor, type Locale, type Msg } from "@/lib/i18n/core";
import { regRoleBadges } from "@/lib/i18n/dict/admin";
import { roles as roleMsgs } from "@/lib/i18n/dict/crm";
import { handOver } from "@/lib/i18n/dict/owners";
import type { Brand } from "@/lib/pipeline-engine/constants";
import { listAssignableOwners, listByteforceOwners } from "./users";

/* ============================================================================
   WHO A LEAD CAN BE HANDED TO — the Assign dialog's list, labelled, ONE place.

   Founder (2026-11-14): "the admin has a click or option for each lead to
   assign it or to change the assignee of that lead". The Assign control sits on
   the lead page, every row of the To-Do, and every row of both Leads lists
   (ADR-104), and each of them used to build this list by hand. One function, so
   the dialog offers the same people wherever it opens:

     B-Systems   live, approved agents, partners and internal sales (users.ts
                 `listAssignableOwners`). Admins are deliberately absent — the
                 admin bucket is where an UNASSIGNED lead sits; "Take it" is how
                 the admin keeps one.
     ByteForce   every live staff account (`listByteforceOwners`). The admin is
                 one of them, so `includeSelf` says whether HE is offered too,
                 labelled "(me)" — the lead page and the lists offer him (that
                 is his "take it" there); the To-Do leaves him out, because its
                 rows carry a separate Take it button.

   `includeSelf` therefore means something under ByteForce ONLY: B-Systems'
   roster never has an admin in it, so there is no self to include.

   The labels are resolved HERE, on the server, so the client dialog stays
   string-free (the V5 bilingual rule). It grants nothing: the assign routes are
   company-admin walls (`requireCompanyAdmin`), and `resolveAssignee` re-checks
   every target inside the write. Only ever called for the company admin.
   ========================================================================== */

export interface RosterEntry {
  id: string;
  name: string;
  company: string | null;
  /** pre-translated — see above */
  roleLabel: string;
}

const BF_STAFF: Msg = regRoleBadges.byteforce_staff!;
const ROLE_LABELS: Record<string, Msg> = roleMsgs;

export async function assignRosterFor(
  company: Brand,
  viewer: { id: string; name: string },
  locale: Locale,
  opts: { includeSelf: boolean },
): Promise<RosterEntry[]> {
  const t = tFor(locale);
  if (company === "byteforce") {
    const staff = await listByteforceOwners();
    return staff
      .filter((u) => opts.includeSelf || u.id !== viewer.id)
      .map((u) => ({
        id: u.id,
        name: u.id === viewer.id ? t(formatMsg(handOver.me, { name: u.name })) : u.name,
        company: null,
        roleLabel: t(BF_STAFF),
      }));
  }
  return (await listAssignableOwners()).map((o) => ({
    id: o.id,
    name: o.name,
    company: o.company,
    roleLabel: t(ROLE_LABELS[o.roles.find((r) => ROLE_LABELS[r]) ?? ""] ?? roleMsgs.bsystems_agent),
  }));
}
