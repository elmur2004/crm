import { requireCompanySection } from "@/lib/auth/page-guards";
import { BS_PIPELINE_ROLES } from "@/lib/crm/company";
import { BSYSTEMS_SURFACE } from "@/lib/crm/surface";
import { bsRoleOrNull } from "@/lib/api/bsystems";
import { BsWonLeadsBody } from "@/components/bsystems/pages/BsWonLeadsBody";
import { tFor } from "@/lib/i18n/core";
import { getLocale } from "@/lib/i18n/server";
import { wonLeads } from "@/lib/i18n/dict/admin";

export async function generateMetadata() {
  const locale = await getLocale();
  return { title: tFor(locale)(wonLeads.metaList) };
}

/* ADR-067 — a B-Systems-ONLY section: refused under company=byteforce, and
   refused BEFORE the role narrowing, so a ByteForce-only teammate is redirected
   rather than falling into a role lookup and turning into a 500. Its win writes
   a Client, not a Won Deal, so this page would have nothing to show it.

   ADR-074 — Mindoo DOES win this way and has this screen, at its own address.
   The body is shared; the guard is not. */

export default async function WonLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string }>;
}) {
  const { user } = await requireCompanySection(
    "bsystems",
    (await searchParams).company,
    BS_PIPELINE_ROLES,
  );
  return <BsWonLeadsBody ctx={BSYSTEMS_SURFACE} role={bsRoleOrNull(user)} userId={user.id} />;
}
