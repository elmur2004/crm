import Link from "next/link";
import type { Role } from "@/lib/pipeline-engine/constants";
import { landingFor } from "@/lib/auth/landing";
import { tFor } from "@/lib/i18n/core";
import { getLocale } from "@/lib/i18n/server";
import { shell } from "@/lib/i18n/dict/auth";

/* MODULE switcher (spec §2.1; founder directives, ADR-054): the two company
   CRMs plus the two cross-company MODULES — Accounting and Data Vault — as
   peer segments. Company segments render only for accounts holding that
   company's roles (single-entity users never see the other side, the original
   founder rule); the module segments render ONLY for bsystems_admin, so every
   non-admin sees exactly what they saw before. Access itself stays server-side
   (proxy + guards); this is navigation only. */

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

export async function EntitySwitch({ roles, current }: { roles: Role[]; current: ModuleId }) {
  const t = tFor(await getLocale());
  const segments: Array<{ id: ModuleId; href: string; label: string }> = [];
  if (roles.includes("byteforce_staff")) {
    segments.push({ id: "byteforce", href: "/byteforce", label: "BYTEFORCE" });
  }
  if (roles.some((r) => BS_ROLES.includes(r))) {
    segments.push({ id: "bsystems", href: bsLandingFor(roles), label: "B-SYSTEMS" });
  }
  if (roles.includes("bsystems_admin")) {
    segments.push({ id: "accounting", href: "/accounting", label: t(shell.switchAccounting) });
    segments.push({ id: "vault", href: "/vault", label: t(shell.switchVault) });
  }
  /* one destination is no switch at all */
  if (segments.length < 2) return null;
  return (
    <div className="switcher" role="group" aria-label={t(shell.switchCompany)}>
      {segments.map((seg) => (
        <Link
          key={seg.id}
          href={seg.href}
          className="switcher-seg"
          aria-current={current === seg.id ? "true" : undefined}
        >
          {seg.label}
        </Link>
      ))}
    </div>
  );
}
