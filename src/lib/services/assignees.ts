import type { Brand } from "@/lib/pipeline-engine/constants";
import { formatMsg, tFor, type Locale, type Msg } from "@/lib/i18n/core";
import { roles as roleMsgs } from "@/lib/i18n/dict/crm";
import { handOver } from "@/lib/i18n/dict/owners";
import { listAssignableOwners, listByteforceOwners } from "./users";

/* ============================================================================
   Founder (2026-11-08) — "when I log a follow-up, I should be able to assign it
   to somebody so they have that follow-up in their follow-up column. Even if
   they are not assigned the lead from the first … I can like redirect the lead
   for them for follow-up."

   WHO the company admin may hand a follow-up to, per company, as ready-to-render
   options (the client select stays string-free):

     B-Systems  the assignable roster — active, approved agents, partners and
                internal sales (`listAssignableOwners`) — plus the admin himself;
     ByteForce  every active, approved ByteForce staff account
                (`listByteforceOwners`), the admin among them.

   These are exactly the sets `resolveAssignee` accepts, so the select can never
   offer a name the server then refuses. WHETHER to offer it at all is the
   caller's question (company admin only) — and the server refuses anyone else.
   ========================================================================== */

export interface AssigneeOption {
  id: string;
  /** pre-translated */
  label: string;
}

const ROLE_LABELS: Record<string, Msg> = roleMsgs;

export async function followUpAssignees(
  brand: Brand,
  self: { id: string; name: string },
  locale: Locale,
): Promise<AssigneeOption[]> {
  const t = tFor(locale);
  const mine = (id: string, name: string) =>
    id === self.id ? t(formatMsg(handOver.me, { name })) : name;
  if (brand === "byteforce") {
    return (await listByteforceOwners()).map((u) => ({ id: u.id, label: mine(u.id, u.name) }));
  }
  const roster = (await listAssignableOwners())
    .filter((o) => o.id !== self.id)
    .map((o) => {
      const role = o.roles.find((r) => ROLE_LABELS[r]);
      const roleLabel = role ? t(ROLE_LABELS[role]!) : "";
      return {
        id: o.id,
        label: `${o.name}${roleLabel ? ` — ${roleLabel}` : ""}${o.company ? ` · ${o.company}` : ""}`,
      };
    });
  return [{ id: self.id, label: mine(self.id, self.name) }, ...roster];
}
