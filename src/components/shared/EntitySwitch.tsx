import Link from "next/link";
import type { Role } from "@/lib/pipeline-engine/constants";
import { tFor } from "@/lib/i18n/core";
import { getLocale } from "@/lib/i18n/server";
import { shell } from "@/lib/i18n/dict/auth";

/* Entity switcher (spec §2.1; founder rule): renders ONLY for accounts whose
   roles span BOTH companies — single-entity users never see the other side.
   Access itself stays server-side (proxy + guards); this is navigation only. */

const BS_ROLES: Role[] = ["bsystems_admin", "bsystems_sales", "bsystems_agent", "bsystems_partner"];

export function bsLandingFor(roles: Role[]): string {
  return roles.includes("bsystems_admin") ? "/b-systems" : "/b-systems/crm";
}

export async function EntitySwitch({ roles, current }: { roles: Role[]; current: "byteforce" | "bsystems" }) {
  const hasByteforce = roles.includes("byteforce_staff");
  const hasBsystems = roles.some((r) => BS_ROLES.includes(r));
  if (!hasByteforce || !hasBsystems) return null;
  const t = tFor(await getLocale());
  return (
    <div className="switcher" role="group" aria-label={t(shell.switchCompany)}>
      <Link
        href="/byteforce"
        className="switcher-seg"
        aria-current={current === "byteforce" ? "true" : undefined}
      >
        BYTEFORCE
      </Link>
      <Link
        href={bsLandingFor(roles)}
        className="switcher-seg"
        aria-current={current === "bsystems" ? "true" : undefined}
      >
        B-SYSTEMS
      </Link>
    </div>
  );
}
