import Link from "next/link";
import type { Role } from "@/lib/pipeline-engine/constants";
import { canUseModule, type ModuleAccessBearer } from "@/lib/auth/roles";
import { landingFor } from "@/lib/auth/landing";
import { tFor } from "@/lib/i18n/core";
import { getLocale } from "@/lib/i18n/server";
import { shell } from "@/lib/i18n/dict/auth";

/* MODULE switcher (spec §2.1; founder directives, ADR-054): the CRM plus the
   two cross-company MODULES — Accounting and Data Vault — as peer segments.
   The module segments render ONLY for an admin who still HOLDS that module
   (ADR-066 — `canUseModule`, the same predicate the two server guards call),
   so every non-admin sees exactly what they saw before and a blocked admin is
   not offered a door that would refuse him. Access itself stays server-side
   (proxy + guards); this is navigation only.

   ADR-067 — THE TWO CRM SEGMENTS BECAME ONE. `BYTEFORCE` and `B-SYSTEMS` were
   peers here because they were two applications; after the merge they are two
   views of ONE application, so this strip would have been asking "which
   module" and "which company" in the same row of identical-looking cells —
   the two-competing-switchers failure the founder specifically asked us to
   avoid. The company now has its own labelled control inside the page
   (CompanySwitch); this bar answers one question and nothing else.

   It is also strictly cheaper on a phone: ADR-060's bar goes from four equal
   1fr cells to three, so every cell gets WIDER and the 320px ellipsis case
   gets easier, not harder — and the desktop header pill sheds a segment
   instead of gaining one, which is the opposite direction from the +44px
   overflow band ADR-060 had to close. */

const BS_ROLES: Role[] = [
  "bsystems_admin",
  "bsystems_sales",
  "bsystems_agent",
  "bsystems_partner",
  "bsystems_data_entry",
];

export type ModuleId = "crm" | "accounting" | "vault";

/* ADR-060 — the switcher renders in two shapes. "header" is the desktop pill
   (hidden from the header ≤820px via .switcher-entity — it is a rigid strip
   that used to push the whole page sideways; the CSS comment in
   design-system.css keeps the measurements). "bar" is the phone's module bar:
   a full-width equal-cell strip the shells render directly UNDER the header,
   visible only ≤820px, whose 1fr cells can never overflow any viewport. One
   component, so the segments, hrefs and aria-current can never diverge. */
export async function EntitySwitch({
  user,
  current,
  variant = "header",
}: {
  /* ADR-066 — the whole BEARER, not just the roles: the module segments now
     depend on two per-user flags as well. Required, never optional: a caller
     that forgets it fails to compile, which is the only way a switcher can
     never drift back into offering a module the server would refuse. */
  user: ModuleAccessBearer;
  current: ModuleId;
  variant?: "header" | "bar";
}) {
  const roles = user.roles;
  const t = tFor(await getLocale());
  const segments: Array<{ id: ModuleId; href: string; label: string }> = [];
  /* ONE CRM segment, pointing at wherever this account lives in the merged
     shell — `landingFor` already answers that for every role, and it is the
     same answer sign-in uses, so the bar and the sign-in can never disagree. */
  /* ADR-074 — `mindoo_staff` too. `landingFor` already sends it to /mindoo,
     so this segment points a Mindoo account at Mindoo's own app and a
     B-Systems account at the merged shell, with no branch here that could put
     one in front of the other. */
  if (
    roles.some((r) => BS_ROLES.includes(r)) ||
    roles.includes("byteforce_staff") ||
    roles.includes("mindoo_staff")
  ) {
    segments.push({ id: "crm", href: landingFor(roles), label: t(shell.switchCrm) });
  }
  if (canUseModule(user, "accounting")) {
    segments.push({ id: "accounting", href: "/accounting", label: t(shell.switchAccounting) });
  }
  if (canUseModule(user, "vault")) {
    segments.push({ id: "vault", href: "/vault", label: t(shell.switchVault) });
  }
  /* one destination is no switch at all — single-entity users get NO new
     furniture in either variant, and an admin left with a single destination
     after ADR-066 took his modules away behaves exactly the same way */
  if (segments.length < 2) return null;
  return (
    <div
      className={variant === "bar" ? "switcher switcher--bar" : "switcher switcher-entity"}
      role="group"
      aria-label={t(shell.switchModule)}
    >
      {segments.map((seg) => (
        <Link
          key={seg.id}
          href={seg.href}
          className="switcher-seg"
          aria-current={current === seg.id ? "true" : undefined}
        >
          {/* the label rides in its own span: below ~340px a 1fr bar cell is
              narrower than the longest labels, and text-overflow never applies
              to a grid container (the seg centers with display:grid) — the
              bar's ellipsis rule in design-system.css lands on this span */}
          <span className="switcher-label">{seg.label}</span>
        </Link>
      ))}
    </div>
  );
}
