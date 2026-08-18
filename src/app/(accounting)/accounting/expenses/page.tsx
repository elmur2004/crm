import { requireBsAdminPage } from "@/lib/auth/page-guards";
import { getLocale } from "@/lib/i18n/server";
import { tFor } from "@/lib/i18n/core";
import { acct } from "@/lib/i18n/dict/accounting";
import { formatEGP } from "@/lib/money";
import { loadBooks } from "@/lib/accounting/books";
import {
  expenseAmount,
  monthExpenses,
  paidExpenseIn,
  pendingExpenseIn,
  type AcctExpenseRow,
} from "@/lib/accounting/engine";
import { ACCT_DEPT_LABELS, ACCT_EXPENSE_TYPE_LABELS, type AcctDept, type AcctExpenseType } from "@/lib/accounting/constants";
import { acctView } from "@/lib/accounting/params";
import { AcctChip, AcctHead, AcctTile } from "@/components/accounting/AcctHead";
import {
  AddExpenseButton,
  ExpenseActions,
  type RosterOption,
} from "@/components/accounting/forms";

/* ADR-052 — expenses with the approval gate. Salary rows are DERIVED from the
   roster at render time (never stored); a linked manual payroll row replaces
   its person's auto row; approval is what makes a row touch cash. */

export async function generateMetadata() {
  const locale = await getLocale();
  return { title: tFor(locale)(acct.metaTitle) };
}

export default async function AcctExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string; month?: string }>;
}) {
  await requireBsAdminPage();
  const locale = await getLocale();
  const t = tFor(locale);
  const view = acctView(await searchParams);
  const books = await loadBooks(view.company);

  const rows = monthExpenses(books, view.month);
  const payrollRows = rows.filter((e) => e.type === "payroll");
  const otherRows = rows.filter((e) => e.type !== "payroll");
  const roster: RosterOption[] = books.roster.map((r) => ({ id: r.id, name: r.name }));
  const deptLabel = (d: string) =>
    d in ACCT_DEPT_LABELS ? t(ACCT_DEPT_LABELS[d as AcctDept]) : d;
  const typeLabel = (x: string) =>
    x in ACCT_EXPENSE_TYPE_LABELS ? t(ACCT_EXPENSE_TYPE_LABELS[x as AcctExpenseType]) : x;
  const sum = (list: AcctExpenseRow[]) => list.reduce((s, e) => s + expenseAmount(e), 0);

  const section = (title: string, list: AcctExpenseRow[], emptyText: string) => (
    <section className="card card--flush0">
      <div className="card-head">
        <h2 className="u-h3">{title}</h2>
        <span className="u-muted">−{formatEGP(sum(list))}</span>
      </div>
      {list.length === 0 ? (
        <p className="empty m-4">{emptyText}</p>
      ) : (
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>{t(acct.type)}</th>
                <th>{t(acct.name)}</th>
                <th>{t(acct.department)}</th>
                <th>{t(acct.note)}</th>
                <th>{t(acct.amount)}</th>
                <th>{t(acct.status)}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((e) => (
                <tr key={e.id}>
                  <td>{typeLabel(e.type)}</td>
                  <td className="td-title">
                    {e.name || "—"}{" "}
                    {e.auto ? <span className="badge badge--rep">{t(acct.fromRoster)}</span> : null}
                  </td>
                  <td>
                    {e.serviceLine ? (
                      <span className="chip-outline">{deptLabel(e.serviceLine)}</span>
                    ) : (
                      <span className="u-muted">{t(acct.overhead)}</span>
                    )}
                  </td>
                  <td className="td-mono">{e.note || "—"}</td>
                  <td className={`td-title ${e.paid ? "text-brand-danger" : ""}`}>
                    −{formatEGP(expenseAmount(e))}
                  </td>
                  <td>
                    {e.paid ? (
                      <AcctChip kind="good">{t(acct.paid)}</AcctChip>
                    ) : (
                      <AcctChip kind="wait">{t(acct.onHold)}</AcctChip>
                    )}
                  </td>
                  <td>
                    <ExpenseActions
                      row={{
                        id: e.id,
                        month: e.month,
                        type: e.type,
                        name: e.name,
                        serviceLine: e.serviceLine,
                        amount: e.amount,
                        note: e.note,
                        paid: e.paid,
                        rosterId: e.rosterId,
                        auto: !!e.auto,
                      }}
                      company={view.company}
                      month={view.month}
                      roster={roster}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );

  return (
    <div className="space-y-5">
      <AcctHead
        view={view}
        locale={locale}
        eyebrow={acct.expensesEyebrow}
        title={acct.expensesTitle}
        sub={acct.expensesSub}
      />
      <div className="page-actions">
        <AddExpenseButton company={view.company} month={view.month} roster={roster} />
      </div>
      <div className="tile-grid">
        <AcctTile label={t(acct.paidThisMonth)} value={formatEGP(paidExpenseIn(books, view.month))} tone="danger" />
        <AcctTile label={t(acct.onHoldToBePaid)} value={formatEGP(pendingExpenseIn(books, view.month))} />
      </div>
      {section(t(acct.payrollSection), payrollRows, t(acct.noPayroll))}
      {section(t(acct.otherExpensesSection), otherRows, t(acct.noOtherExpenses))}
    </div>
  );
}
