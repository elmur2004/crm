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
  /* ADR-073 — Mindoo lands on its own company home, the same address ByteForce
     uses with its own `?company=`. It sits BELOW the two existing companies so
     that an account holding several keeps landing exactly where it landed
     before Mindoo existed. */
  ["mindoo_staff", "/b-systems?company=mindoo"],
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
