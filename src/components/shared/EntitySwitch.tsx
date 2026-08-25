import Link from "next/link";
import type { Role } from "@/lib/pipeline-engine/constants";
import { canUseModule, type ModuleAccessBearer } from "@/lib/auth/roles";
import { landingFor } from "@/lib/auth/landing";
import { tFor } from "@/lib/i18n/core";
import { getLocale } from "@/lib/i18n/server";
import { shell } from "@/lib/i18n/dict/auth";

/* MODULE switcher (spec §2.1; founder directives, ADR-054): the two company
   CRMs plus the two cross-company MODULES — Accounting and Data Vault — as
   peer segments. Company segments render only for accounts holding that
   company's roles (single-entity users never see the other side, the original
   founder rule); the module segments render ONLY for an admin who still HOLDS
   that module (ADR-066 — `canUseModule`, the same predicate the two server
   guards call), so every non-admin sees exactly what they saw before and a
   blocked admin is not offered a door that would refuse him. Access itself
   stays server-side (proxy + guards); this is navigation only. */

const BS_ROLES: Role[] = [
  "bsystems_admin",
  "bsystems_sales",
  "bsystems_agent",
  "bsystems_partner",
  "bsystems_data_entry",
];

export function bsLandingFor(roles: Role[]): string {
  return landingFor(roles.filter((r) => BS_ROLES.includes(r)));
}

export type ModuleId = "byteforce" | "bsystems" | "accounting" | "vault";

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
  if (roles.includes("byteforce_staff")) {
    segments.push({ id: "byteforce", href: "/byteforce", label: "BYTEFORCE" });
  }
  if (roles.some((r) => BS_ROLES.includes(r))) {
    segments.push({ id: "bsystems", href: bsLandingFor(roles), label: "B-SYSTEMS" });
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
      aria-label={t(shell.switchCompany)}
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
