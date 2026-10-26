import { requireAccountingPage } from "@/lib/auth/page-guards";
import { getLocale } from "@/lib/i18n/server";
import { tFor } from "@/lib/i18n/core";
import { acct } from "@/lib/i18n/dict/accounting";
import { formatEGP } from "@/lib/money";
import { loadBooks } from "@/lib/accounting/books";
import { loanOutstanding, loanPaid, loanSettled, loanTotals, type AcctLoanRow } from "@/lib/accounting/engine";
import { acctView } from "@/lib/accounting/params";
import { moduleCompaniesFor } from "@/lib/module-companies";
import { AcctChip, AcctHead, AcctTile } from "@/components/accounting/AcctHead";
import { AddLoanButton, LoanActions } from "@/components/accounting/forms";
import { ModGroup, ModSwap } from "@/components/accounting/module-ui";
import { ModEmpty } from "@/components/accounting/module-art";

/* ADR-052 — loans & lending. Cash moves through treasury; profit never.
   Borrowed and lent are two ledgers that fold away from their heads (ModGroup). */

export async function generateMetadata() {
  const locale = await getLocale();
  return { title: tFor(locale)(acct.metaTitle) };
}

export default async function AcctLoansPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string; month?: string }>;
}) {
  const user = await requireAccountingPage();
  const locale = await getLocale();
  const t = tFor(locale);
  const view = acctView(await searchParams, moduleCompaniesFor(user.roles));
  const books = await loadBooks(view.company);
  const { owe, owed, net } = loanTotals(books);

  const group = (title: string, empty: string, loans: AcctLoanRow[]) => (
    <ModGroup title={title}>
      {loans.length === 0 ? (
        <ModEmpty kind="coins">{empty}</ModEmpty>
      ) : (
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>{t(acct.party)}</th>
                <th>{t(acct.started)}</th>
                <th>{t(acct.due)}</th>
                <th>{t(acct.principal)}</th>
                <th>{t(acct.repaid)}</th>
                <th>{t(acct.outstanding)}</th>
                <th>{t(acct.status)}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loans.map((l) => {
                const out = loanOutstanding(l);
                const settled = loanSettled(l);
                return (
                  <tr key={l.id}>
                    <td className="td-title">
                      {l.party}
                      {l.note ? <span className="block u-muted">{l.note}</span> : null}
                    </td>
                    <td className="td-mono u-ltr">{l.date}</td>
                    <td className="td-mono u-ltr">{l.dueDate || "—"}</td>
                    <td>{formatEGP(l.principal)}</td>
                    <td>{formatEGP(loanPaid(l))}</td>
                    <td className={`td-title ${settled ? "" : l.direction === "borrowed" ? "text-brand-danger" : ""}`}>
                      {formatEGP(out)}
                    </td>
                    <td>
                      {settled ? (
                        <AcctChip kind="good">{t(acct.settled)}</AcctChip>
                      ) : (
                        <AcctChip kind="wait">{t(acct.open)}</AcctChip>
                      )}
                    </td>
                    <td>
                      <LoanActions
                        loan={{ id: l.id, direction: l.direction, party: l.party, outstanding: out }}
                        company={view.company}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </ModGroup>
  );

  return (
    <div className="space-y-5 mod-page">
      <AcctHead
        view={view}
        locale={locale}
        eyebrow={acct.loansEyebrow}
        title={acct.loansTitle}
        sub={acct.loansSub}
        showMonth={false}
      />
      <div className="page-actions">
        <AddLoanButton company={view.company} month={view.month} />
      </div>
      <ModSwap swapKey={view.company} className="space-y-5">
        <div className="tile-grid">
          <AcctTile label={t(acct.weOwePayable)} amount={owe} sub={t(acct.outstandingBorrowed)} tone={owe > 0 ? "danger" : undefined} />
          <AcctTile label={t(acct.owedToUsReceivable)} amount={owed} sub={t(acct.outstandingLent)} />
          <AcctTile
            label={t(acct.netLoanPosition)}
            amount={Math.abs(net)}
            sub={net >= 0 ? t(acct.netReceivable) : t(acct.netPayable)}
          />
        </div>
        {group(t(acct.borrowedGroup), t(acct.noBorrowed), books.loans.filter((l) => l.direction === "borrowed"))}
        {group(t(acct.lentGroup), t(acct.noLent), books.loans.filter((l) => l.direction === "lent"))}
      </ModSwap>
    </div>
  );
}
