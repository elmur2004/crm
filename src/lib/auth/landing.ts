import type { Role } from "@/lib/pipeline-engine/constants";

/* Where a signed-in user belongs (ADR-028: one sign-in, many apps). Lifted out
   of actions.ts so the PAGE guards can use it too — a signed-in user who wanders
   into a section they lack should land on their OWN home, not on a sign-in form
   they do not need (which is how it read for the data-entry role, ADR-051). */

export const LANDING_PRIORITY: Array<[Role, string]> = [
  ["bsystems_admin", "/b-systems"],
  /* ADR-067 — the merged shell. ByteForce work lives at the B-Systems address
     now, with the company spelled out; /byteforce redirects here (proxy.ts). */
  ["byteforce_staff", "/b-systems?company=byteforce"],
  /* ADR-074 — Mindoo lands in MINDOO'S OWN APP. ADR-073 sent it to the merged
     shell with `?company=mindoo`; the founder then asked for the two to be
     separated entirely, so the address is /mindoo and there is no company on
     it. It sits BELOW the two existing companies so that an account holding
     several keeps landing exactly where it landed before Mindoo existed —
     which also means an account that somehow held both a B-Systems role and
     `mindoo_staff` never gets silently moved. */
  ["mindoo_staff", "/mindoo"],
  ["bsystems_sales", "/b-systems/crm"],
  ["bsystems_agent", "/b-systems/crm"],
  ["bsystems_partner", "/b-systems/crm"],
  /* founder (ADR-051): the data-entry role has exactly ONE page — the two Add
     actions and the list of what they have entered. */
  ["bsystems_data_entry", "/b-systems/entry"],
];

export function landingFor(roles: Role[]): string {
  for (const [role, target] of LANDING_PRIORITY) {
    if (roles.includes(role)) return target;
  }
  return "/login?error=1";
}
