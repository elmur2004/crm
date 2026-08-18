import { requireBsAdminPage } from "@/lib/auth/page-guards";
import { getLocale } from "@/lib/i18n/server";
import { tFor } from "@/lib/i18n/core";
import { acct } from "@/lib/i18n/dict/accounting";
import { formatEGP } from "@/lib/money";
import { loadBooks } from "@/lib/accounting/books";
import { addMonths, liveTreasury, netIn, treasuryThrough } from "@/lib/accounting/engine";
import { cairoMonth } from "@/lib/accounting/now";
import { acctView } from "@/lib/accounting/params";
import { monthLabel } from "@/lib/accounting/format";
import { AcctChip, AcctHead, AcctTile } from "@/components/accounting/AcctHead";
import { AddMoveButton, MoveActions, OpeningButton } from "@/components/accounting/forms";

/* ADR-052 — the cash box: opening + this month's net + deposits − withdrawals,
   carried forward month over month. */

export async function generateMetadata() {
  const locale = await getLocale();
  return { title: tFor(locale)(acct.metaTitle) };
}

export default async function AcctTreasuryPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string; month?: string }>;
}) {
  await requireBsAdminPage();
  const locale = await getLocale();
  const t = tFor(locale);
  const view = acctView(await searchParams);
  const books = await loadBooks(view.company);
  const opening = treasuryThrough(books, addMonths(view.month, -1));
  const net = netIn(books, view.month);
  const here = books.treasury.filter((m) => m.month === view.month);
  const deposits = here.filter((m) => m.kind === "deposit").reduce((s, m) => s + m.amount, 0);
  const withdrawals = here.filter((m) => m.kind === "withdraw").reduce((s, m) => s + m.amount, 0);
  const closing = opening + net + deposits - withdrawals;
  const balanceNow = liveTreasury(books, cairoMonth());

  const line = (label: string, value: number, signed = true) => (
    <div className="flex items-baseline justify-between py-1.5 border-b border-brand-hairline">
      <span className="u-muted">{label}</span>
      <span
        className={`font-medium ${signed ? (value >= 0 ? "text-brand-success" : "text-brand-danger") : ""}`}
      >
        {signed ? (value >= 0 ? "+" : "−") : ""}
        {formatEGP(Math.abs(value))}
      </span>
    </div>
  );

  return (
    <div className="space-y-5">
      <AcctHead
        view={view}
        locale={locale}
        eyebrow={acct.treasuryEyebrow}
        title={acct.treasuryTitle}
        sub={acct.treasurySub}
      />
      <div className="page-actions">
        <AddMoveButton company={view.company} month={view.month} />
      </div>
      <div className="tile-grid">
        <AcctTile
          label={t(acct.balanceNow)}
          value={formatEGP(balanceNow)}
          sub={t(acct.cashNowAnyMonth)}
          tone={balanceNow >= 0 ? "success" : "danger"}
        />
      </div>

      <section className="card card-pad">
        <div className="flex items-baseline justify-between py-1.5 border-b border-brand-hairline">
          <span className="u-muted">
            {t(acct.openingBalanceOf)} ({monthLabel(addMonths(view.month, -1), locale)})
          </span>
          <span className="font-medium">{formatEGP(opening)}</span>
        </div>
        {line(t(acct.monthNetLine), net)}
        {line(t(acct.depositsLine), deposits)}
        {line(t(acct.withdrawalsLine), -withdrawals)}
        <div className="flex items-baseline justify-between pt-3">
          <span className="u-h3">{t(acct.closingBalance)}</span>
          <span className={`u-h2 ${closing >= 0 ? "" : "text-brand-danger"}`}>{formatEGP(closing)}</span>
        </div>
      </section>

      <section className="card card-pad flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="tile-label">{t(acct.systemOpening)}</p>
          <p className="u-h2 mt-1">{formatEGP(books.openingBalance)}</p>
        </div>
        <OpeningButton company={view.company} current={books.openingBalance} />
      </section>

      <section className="card card--flush0">
        <div className="card-head">
          <h2 className="u-h3">{t(acct.movementsThisMonth)}</h2>
        </div>
        {here.length === 0 ? (
          <p className="empty m-4">{t(acct.noMovements)}</p>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>{t(acct.type)}</th>
                  <th>{t(acct.label)}</th>
                  <th>{t(acct.date)}</th>
                  <th>{t(acct.amount)}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {here.map((m) => (
                  <tr key={m.id}>
                    <td>
                      {m.kind === "deposit" ? (
                        <AcctChip kind="good">{t(acct.deposit)}</AcctChip>
                      ) : (
                        <AcctChip kind="off">{t(acct.withdraw)}</AcctChip>
                      )}
                    </td>
                    <td className="td-title">
                      {m.label || "—"}
                      {m.tag ? <span className="badge badge--entity ms-2">{m.tag}</span> : null}
                    </td>
                    <td className="td-mono u-ltr">{m.date}</td>
                    <td className={`td-title ${m.kind === "deposit" ? "text-brand-success" : "text-brand-danger"}`}>
                      {m.kind === "deposit" ? "+" : "−"}
                      {formatEGP(m.amount)}
                    </td>
                    <td>
                      <MoveActions
                        row={{ id: m.id, month: m.month, kind: m.kind, label: m.label, amount: m.amount, date: m.date }}
                        company={view.company}
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
