import { redirect } from "next/navigation";
import { requireCompanySection } from "@/lib/auth/page-guards";
import { BS_PIPELINE_ROLES } from "@/lib/crm/company";
import { BSYSTEMS_SURFACE } from "@/lib/crm/surface";
import { bsRoleOrNull } from "@/lib/api/bsystems";
import { BsWonDealBody } from "@/components/bsystems/pages/BsWonDealBody";
import { tFor } from "@/lib/i18n/core";
import { getLocale } from "@/lib/i18n/server";
import { wonLeads } from "@/lib/i18n/dict/admin";

export async function generateMetadata() {
  const locale = await getLocale();
  return { title: tFor(locale)(wonLeads.metaDetail) };
}

/* V2 §5 — the admin won-lead detail. ADR-067: B-Systems only, company refused
   before the role narrowing. ADR-074: Mindoo renders the same body at its own
   address, under its own guard. */

export default async function WonLeadDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ wonId: string }>;
  searchParams: Promise<{ company?: string }>;
}) {
  const { user } = await requireCompanySection(
    "bsystems",
    (await searchParams).company,
    BS_PIPELINE_ROLES,
  );
  if (bsRoleOrNull(user) !== "bsystems_admin") redirect("/b-systems/won-leads");
  const { wonId } = await params;
  return <BsWonDealBody ctx={BSYSTEMS_SURFACE} wonId={wonId} />;
}
