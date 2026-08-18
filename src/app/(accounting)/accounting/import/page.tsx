import { requireBsAdminPage } from "@/lib/auth/page-guards";
import { getLocale } from "@/lib/i18n/server";
import { tFor } from "@/lib/i18n/core";
import { acct } from "@/lib/i18n/dict/accounting";
import { acctView } from "@/lib/accounting/params";
import { AcctHead } from "@/components/accounting/AcctHead";
import { ImportPanel } from "@/components/accounting/importer";
import { ExportPanel } from "@/components/accounting/exporter";

/* ADR-052, founder decision 4 — import the old app's own JSON export, get the
   derived totals back for reconciliation. ADR-054 directive B: the module's
   EXPORT lives beside it — the same SPA-shaped files, both directions. */

export async function generateMetadata() {
  const locale = await getLocale();
  return { title: tFor(locale)(acct.metaTitle) };
}

export default async function AcctImportPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string; month?: string }>;
}) {
  await requireBsAdminPage();
  const locale = await getLocale();
  const view = acctView(await searchParams);

  return (
    <div className="space-y-5">
      <AcctHead
        view={view}
        locale={locale}
        eyebrow={acct.importEyebrow}
        title={acct.importTitle}
        sub={acct.importSub}
        showMonth={false}
      />
      <ExportPanel />
      <ImportPanel />
    </div>
  );
}
