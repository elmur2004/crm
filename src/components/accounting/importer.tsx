"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { tFor } from "@/lib/i18n/core";
import { useLocale } from "@/components/shared/LocaleProvider";
import { formatEGP } from "@/lib/money";
import { useSearchParams } from "next/navigation";
import { acct, acctCompanies } from "@/lib/i18n/dict/accounting";
import { acctView } from "@/lib/accounting/params";
import type { Brand } from "@/lib/pipeline-engine/constants";

/* ADR-052, founder decision 4 — the one-time import screen. Upload the old
   app's own JSON export; the server replaces that company's books and returns
   the engine's derived totals, shown here for manual reconciliation against
   the old dashboard.

   The glass pass draws the flow as the three steps it is, on one rail
   (.mod-steps, modules.css): choose the file → import → reconcile. The step in
   hand is ringed, a finished one is ticked, and the reconciliation rises in
   group by group when it arrives. The same one input and one button (founder:
   "I just need to import this file") — the rail is drawing, not new controls. */

interface CompanySummary {
  company: string;
  counts: Record<string, number>;
  verify: {
    month: string;
    treasuryNow: number;
    monthNet: number;
    incomeCollected: number;
    expensesPaid: number;
    onHold: number;
    accountsReceivable: number;
    accountsPayable: number;
    committedSalary: number;
  };
}

export function ImportPanel({ companies }: { companies: Brand[] }) {
  const t = tFor(useLocale());
  const router = useRouter();
  const params = useSearchParams();
  const view = acctView(
    {
      company: params.get("company") ?? undefined,
      month: params.get("month") ?? undefined,
    },
    companies,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CompanySummary[] | null>(null);
  const [hasFile, setHasFile] = useState(false);
  /* where the flow stands — drives the rail only */
  const fileStep = hasFile || busy || result ? "done" : "current";
  const runStep = result ? "done" : hasFile || busy ? "current" : "todo";
  const checkStep = result ? "done" : "todo";

  return (
    <section className="card card-pad max-w-2xl">
      <form
        className="mod-steps space-y-5"
        onSubmit={async (e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          setBusy(true);
          setError(null);
          setResult(null);
          const res = await fetch("/api/accounting/import", { method: "POST", body: fd });
          setBusy(false);
          const data = (await res.json().catch(() => null)) as
            | ({ companies?: CompanySummary[] } & { error?: string })
            | null;
          if (!res.ok || !data?.companies) {
            setError(data?.error ?? t(acct.somethingWentWrong));
            return;
          }
          setResult(data.companies);
          router.refresh();
        }}
      >
        <input type="hidden" name="company" value={view.company} />
        {/* founder: "I just need to import this file" — one input, one button.
            The all-companies file names its own companies; a single-company
            file lands in the company currently selected in the header. */}
        <div className="mod-step" data-state={fileStep}>
          <label className="field">
            <span className="field-label">{t(acct.importFile)}</span>
            <input
              name="file"
              type="file"
              accept="application/json,.json"
              required
              className="field-input"
              onChange={(e) => setHasFile(Boolean(e.currentTarget.files?.length))}
            />
          </label>
        </div>
        <div className="mod-step space-y-3" data-state={runStep}>
          <div className="flex items-center gap-3 flex-wrap">
            <button type="submit" className="btn-primary" disabled={busy}>
              {t(busy ? acct.importWorking : acct.importRun)}
            </button>
            <span className="u-muted">{t(acct.importReplaceWarning)}</span>
          </div>
          {error ? <p className="alert-error">{error}</p> : null}
        </div>

        <div className="mod-step" data-state={checkStep}>
          {result ? (
            <div className="space-y-4 mod-result">
              <p className="u-h3">{t(acct.importDone)}</p>
              {result.map((c) => (
                <div key={c.company} className="record-group space-y-3">
                  <p className="record-title">{t(acctCompanies[c.company] ?? { en: c.company, ar: c.company })}</p>
                  <div>
                    <p className="u-mono">{t(acct.importedRows)}</p>
                    <div className="record-grid">
                      {(
                        [
                          ["income", acct.importRowIncome],
                          ["expenses", acct.importRowExpenses],
                          ["roster", acct.importRowRoster],
                          ["payrollMarks", acct.importRowPayrollMarks],
                          ["treasury", acct.importRowTreasury],
                          ["loans", acct.importRowLoans],
                          ["loanPayments", acct.importRowLoanPayments],
                          ["mediaEntries", acct.importRowMedia],
                          ["targets", acct.importRowTargets],
                        ] as const
                      ).map(([key, label]) => (
                        <span key={key}>
                          <span className="fields-label block">{t(label)}</span>
                          <span className="fields-value">{c.counts[key] ?? 0}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="u-mono">{t(acct.importVerifyHeading)}</p>
                    <div className="record-grid">
                      {(
                        [
                          [acct.treasuryBalance, c.verify.treasuryNow],
                          [acct.monthNetProfit, c.verify.monthNet],
                          [acct.incomeCollected, c.verify.incomeCollected],
                          [acct.expensesPaid, c.verify.expensesPaid],
                          [acct.toBePaid, c.verify.onHold],
                          [acct.accountsReceivable, c.verify.accountsReceivable],
                          [acct.accountsPayable, c.verify.accountsPayable],
                          [acct.committedSalary, c.verify.committedSalary],
                        ] as const
                      ).map(([label, value], i) => (
                        <span key={i}>
                          <span className="fields-label block">{t(label)}</span>
                          <span className="fields-value">{formatEGP(value)}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* what the third step will be: the derived totals to check */
            <p className="mod-step-title">{t(acct.importVerifyHeading)}</p>
          )}
        </div>
      </form>
    </section>
  );
}
