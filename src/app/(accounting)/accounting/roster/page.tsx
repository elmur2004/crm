import { requireBsAdminPage } from "@/lib/auth/page-guards";
import { getLocale } from "@/lib/i18n/server";
import { tFor } from "@/lib/i18n/core";
import { acct } from "@/lib/i18n/dict/accounting";
import { formatEGP } from "@/lib/money";
import { loadBooks } from "@/lib/accounting/books";
import { memberAt } from "@/lib/accounting/engine";
import { cairoMonth } from "@/lib/accounting/now";
import { ACCT_DEPT_LABELS, type AcctDept } from "@/lib/accounting/constants";
import { acctView } from "@/lib/accounting/params";
import { monthLabel } from "@/lib/accounting/format";
import { AcctChip, AcctHead, AcctTile } from "@/components/accounting/AcctHead";
import { AddPersonButton, RosterActions } from "@/components/accounting/forms";

/* ADR-052 — the payroll roster: the standing team whose active salaries the
   engine posts to Expenses every month. Edits are effective-dated. */

export async function generateMetadata() {
  const locale = await getLocale();
  return { title: tFor(locale)(acct.metaTitle) };
}

export default async function AcctRosterPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string; month?: string }>;
}) {
  await requireBsAdminPage();
  const locale = await getLocale();
  const t = tFor(locale);
  const view = acctView(await searchParams);
  const books = await loadBooks(view.company);
  const now = cairoMonth();
  const withNow = books.roster.map((r) => ({ r, now: memberAt(r, now) }));
  const activeNow = withNow.filter((x) => x.now.active);
  const committed = activeNow.reduce((s, x) => s + x.now.salary, 0);
  const deptLabel = (d: string) =>
    d in ACCT_DEPT_LABELS ? t(ACCT_DEPT_LABELS[d as AcctDept]) : d;

  return (
    <div className="space-y-5">
      <AcctHead
        view={view}
        locale={locale}
        eyebrow={acct.rosterEyebrow}
        title={acct.rosterTitle}
        sub={acct.rosterSub}
        showMonth={false}
      />
      <div className="page-actions">
        <AddPersonButton company={view.company} month={view.month} />
      </div>
      <div className="tile-grid">
        <AcctTile
          label={t(acct.committedSalary)}
          value={formatEGP(committed)}
          sub={`${activeNow.length} ${t(acct.activeStaff)}`}
        />
      </div>
      <section className="card card--flush0">
        {books.roster.length === 0 ? (
          <p className="empty m-4">{t(acct.noTeam)}</p>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>{t(acct.name)}</th>
                  <th>{t(acct.role)}</th>
                  <th>{t(acct.department)}</th>
                  <th>{t(acct.accountNo)}</th>
                  <th>{t(acct.monthlySalary)}</th>
                  <th>{t(acct.starts)}</th>
                  <th>{t(acct.status)}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {withNow.map(({ r, now: cur }) => (
                  <tr key={r.id} data-inactive={cur.active ? undefined : true}>
                    <td className="td-title">{r.name}</td>
                    <td>{r.role || "—"}</td>
                    <td>
                      {r.serviceLine ? (
                        <span className="chip-outline">{deptLabel(r.serviceLine)}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="td-mono u-ltr">{r.account || "—"}</td>
                    <td className="td-title">{cur.active ? formatEGP(cur.salary) : "—"}</td>
                    <td>{r.since ? monthLabel(r.since, locale) : "—"}</td>
                    <td>
                      {cur.active ? (
                        <AcctChip kind="good">{t(acct.active)}</AcctChip>
                      ) : (
                        <AcctChip kind="off">{t(acct.inactive)}</AcctChip>
                      )}
                    </td>
                    <td>
                      <RosterActions
                        member={{
                          id: r.id,
                          name: r.name,
                          role: r.role,
                          serviceLine: r.serviceLine,
                          account: r.account,
                          salary: cur.salary,
                          active: cur.active,
                        }}
                        company={view.company}
                        month={view.month}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
