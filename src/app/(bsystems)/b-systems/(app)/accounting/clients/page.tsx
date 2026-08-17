import Link from "next/link";
import { requireBsAdminPage } from "@/lib/auth/page-guards";
import { getLocale } from "@/lib/i18n/server";
import { tFor } from "@/lib/i18n/core";
import { acct } from "@/lib/i18n/dict/accounting";
import { formatEGP } from "@/lib/money";
import { loadBooks } from "@/lib/accounting/books";
import { clientAccounts, clientTotals } from "@/lib/accounting/engine";
import { acctQuery, acctView } from "@/lib/accounting/params";
import { AcctChip, AcctHead, AcctTile } from "@/components/bsystems/accounting/AcctHead";

/* ADR-052 — the derived client A/R ledger (free-text names this phase; linking
   to CRM Client records is Phase 7). ?client=Name opens one statement. */

export async function generateMetadata() {
  const locale = await getLocale();
  return { title: tFor(locale)(acct.metaTitle) };
}

export default async function AcctClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string; month?: string; client?: string }>;
}) {
  await requireBsAdminPage();
  const locale = await getLocale();
  const t = tFor(locale);
  const params = await searchParams;
  const view = acctView(params);
  const books = await loadBooks(view.company);
  const accounts = clientAccounts(books);
  const selected = params.client && accounts[params.client] ? accounts[params.client]! : null;
  const lineLabel: Record<string, string> = {
    invoice: t(acct.invoiceCharge),
    payment: t(acct.paymentReceived),
    ad_in: t(acct.adBudgetReceived),
    ad_out: t(acct.adSpendForwarded),
  };

  if (selected) {
    return (
      <div className="space-y-5">
        <AcctHead
          view={view}
          tab="clients"
          locale={locale}
          eyebrow={acct.clientsEyebrow}
          title={{ en: selected.client, ar: selected.client }}
          showMonth={false}
        />
        <div className="page-actions">
          <Link className="btn-ghost" href={`/b-systems/accounting/clients${acctQuery(view)}`}>
            ‹ {t(acct.backToClients)}
          </Link>
        </div>
        <div className="tile-grid">
          <AcctTile label={t(acct.invoiced)} value={formatEGP(selected.invoiced)} />
          <AcctTile label={t(acct.collected)} value={formatEGP(selected.collected)} tone="success" />
          <AcctTile
            label={t(acct.balance)}
            value={formatEGP(Math.abs(selected.balance))}
            sub={
              selected.balance > 0
                ? t(acct.owesYou)
                : selected.balance < 0
                  ? t(acct.inCredit)
                  : t(acct.settled)
            }
          />
          {selected.held !== 0 ? (
            <AcctTile label={t(acct.adBudgetHeld)} value={formatEGP(selected.held)} />
          ) : null}
        </div>
        <section className="card card--flush0">
          <div className="card-head">
            <h2 className="u-h3">{t(acct.accountStatement)}</h2>
          </div>
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>{t(acct.date)}</th>
                  <th>{t(acct.type)}</th>
                  <th>{t(acct.note)}</th>
                  <th>{t(acct.debit)}</th>
                  <th>{t(acct.credit)}</th>
                  <th>{t(acct.runningBalance)}</th>
                </tr>
              </thead>
              <tbody>
                {selected.lines.map((l, idx) => (
                  <tr key={idx}>
                    <td className="td-mono u-ltr">{l.date}</td>
                    <td>{lineLabel[l.kind] ?? l.desc}</td>
                    <td className="td-mono">{l.note || "—"}</td>
                    <td>{l.debit ? formatEGP(l.debit) : l.held && l.held < 0 ? `${formatEGP(-l.held)} ⤳` : "—"}</td>
                    <td className={l.credit ? "text-brand-success" : ""}>
                      {l.credit ? formatEGP(l.credit) : l.held && l.held > 0 ? `${formatEGP(l.held)} ⤳` : "—"}
                    </td>
                    <td className="td-title">{formatEGP(Math.abs(l.running ?? 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="panel-hint">
            ⤳ {t(acct.adBudgetHeld)} ({t(acct.tabMedia)})
          </p>
        </section>
      </div>
    );
  }

  const list = Object.values(accounts).sort((a, b) => b.balance - a.balance);
  const totals = clientTotals(books);

  return (
    <div className="space-y-5">
      <AcctHead
        view={view}
        tab="clients"
        locale={locale}
        eyebrow={acct.clientsEyebrow}
        title={acct.clientsTitle}
        sub={acct.clientsSub}
        showMonth={false}
      />
      <div className="tile-grid">
        <AcctTile label={t(acct.totalOwedByClients)} value={formatEGP(totals.owed)} sub={t(acct.acrossAllClients)} />
        <AcctTile label={t(acct.totalClientCredit)} value={formatEGP(totals.credit)} sub={t(acct.acrossAllClients)} />
        <AcctTile label={t(acct.netClientBalance)} value={formatEGP(Math.abs(totals.net))} />
      </div>
      <section className="card card--flush0">
        {list.length === 0 ? (
          <p className="empty m-4">{t(acct.noClients)}</p>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>{t(acct.client)}</th>
                  <th>{t(acct.invoiced)}</th>
                  <th>{t(acct.collected)}</th>
                  <th>{t(acct.balance)}</th>
                  <th>{t(acct.status)}</th>
                  <th>{t(acct.adBudgetHeld)}</th>
                </tr>
              </thead>
              <tbody>
                {list.map((a) => (
                  <tr key={a.client}>
                    <td className="td-title">
                      <Link
                        className="text-brand-link underline underline-offset-2"
                        href={`/b-systems/accounting/clients${acctQuery(view)}&client=${encodeURIComponent(a.client)}`}
                      >
                        {a.client}
                      </Link>
                    </td>
                    <td>{formatEGP(a.invoiced)}</td>
                    <td className="text-brand-success">{formatEGP(a.collected)}</td>
                    <td className="td-title">{formatEGP(Math.abs(a.balance))}</td>
                    <td>
                      {a.balance > 0 ? (
                        <AcctChip kind="wait">{t(acct.owesYou)}</AcctChip>
                      ) : a.balance < 0 ? (
                        <AcctChip kind="off">{t(acct.inCredit)}</AcctChip>
                      ) : (
                        <AcctChip kind="good">{t(acct.settled)}</AcctChip>
                      )}
                    </td>
                    <td>{a.held ? formatEGP(a.held) : "—"}</td>
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
