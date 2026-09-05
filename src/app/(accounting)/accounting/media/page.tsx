import { redirect } from "next/navigation";
import { requireAccountingPage } from "@/lib/auth/page-guards";
import { getLocale } from "@/lib/i18n/server";
import { tFor } from "@/lib/i18n/core";
import { acct } from "@/lib/i18n/dict/accounting";
import { formatEGP } from "@/lib/money";
import { loadBooks } from "@/lib/accounting/books";
import { mediaHidden } from "@/lib/accounting/constants";
import { acctQuery, acctView } from "@/lib/accounting/params";
import { moduleCompaniesFor } from "@/lib/module-companies";
import { hasAcctSection } from "@/lib/module-sections";
import { AcctHead } from "@/components/accounting/AcctHead";
import { MediaButtons } from "@/components/accounting/forms";

/* ADR-052 — media pass-through. HIDDEN ENTIRELY for company=bsystems (founder
   decision 5): the tab is not rendered and this URL bounces to the dashboard. */

export async function generateMetadata() {
  const locale = await getLocale();
  return { title: tFor(locale)(acct.metaTitle) };
}

export default async function AcctMediaPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string; month?: string }>;
}) {
  const user = await requireAccountingPage();
  const locale = await getLocale();
  const t = tFor(locale);
  const view = acctView(await searchParams, moduleCompaniesFor(user.roles));
  /* ADR-076 — a section this company does not have is REFUSED, not merely
     hidden from the nav. The founder named Mindoo's sections; leaving the page
     reachable by typing its address would make that a tidier menu rather than a
     decision about what the company has. Redirect to the module root, which
     every company keeps — never a 404, because the section exists, it is simply
     not this company's. */
  if (!hasAcctSection(view.company, "/accounting/media")) redirect(`/accounting${acctQuery(view)}`);
  if (mediaHidden(view.company)) redirect(`/accounting${acctQuery(view)}`);
  const books = await loadBooks(view.company);

  const ledger = books.mediaLedger.filter((m) => m.month === view.month);
  const byClient = new Map<string, { received: number; fee: number; sent: number }>();
  for (const m of ledger) {
    const g = byClient.get(m.client) ?? { received: 0, fee: 0, sent: 0 };
    if (m.type === "received") {
      g.received += m.amount;
      g.fee += m.feeAmount ?? 0;
    } else {
      g.sent += m.amount;
    }
    byClient.set(m.client, g);
  }

  return (
    <div className="space-y-5">
      <AcctHead
        view={view}
        locale={locale}
        eyebrow={acct.mediaEyebrow}
        title={acct.mediaTitle}
        sub={acct.mediaSub}
      />
      <div className="page-actions">
        <MediaButtons company={view.company} month={view.month} />
      </div>
      <section className="card card--flush0">
        <div className="card-head">
          <h2 className="u-h3">{t(acct.perClientLedger)}</h2>
        </div>
        {byClient.size === 0 ? (
          <p className="empty m-4">{t(acct.noMedia)}</p>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>{t(acct.client)}</th>
                  <th>{t(acct.received)}</th>
                  <th>{t(acct.agencyFeeIncome)}</th>
                  <th>{t(acct.sentToBuyer)}</th>
                  <th>{t(acct.stillHeld)}</th>
                </tr>
              </thead>
              <tbody>
                {[...byClient.entries()].map(([client, g]) => {
                  const held = g.received - g.fee - g.sent;
                  return (
                    <tr key={client}>
                      <td className="td-title">{client}</td>
                      <td>{formatEGP(g.received)}</td>
                      <td className="text-brand-success">{formatEGP(g.fee)}</td>
                      <td>{formatEGP(g.sent)}</td>
                      <td className={`td-title ${held < 0 ? "text-brand-danger" : ""}`}>{formatEGP(held)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
