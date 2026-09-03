import type { Brand } from "@/lib/pipeline-engine/constants";
import { resolveModuleCompany } from "@/lib/module-companies";
import { type AcctCompany } from "./constants";
import { cairoMonth } from "./now";

/* Every accounting page carries ?company=&month= — company is a FILTER on one
   admin screen set (INTEGRATION-PLAN §3), month is the viewed bookkeeping
   month. Bad values fall back rather than 400 on a PAGE.

   ADR-074 — the fallback is now the ACCOUNT'S OWN first company rather than the
   literal "byteforce". The literal was correct while every account that could
   open this module held ByteForce; Mindoo's staff holds only Mindoo, and a
   hardcoded default would have opened its Accounting on another company's books
   — under that company's brand, because the shell re-stamps [data-brand] from
   this value. `allowed` is a REQUIRED argument for that reason: a default would
   put the literal straight back the first time somebody forgot it. */

export interface AcctView {
  company: AcctCompany;
  month: string; // "YYYY-MM"
  /** the companies this account may switch between — the tabs the controls
      render, and the only values this view can ever take */
  companies: AcctCompany[];
}

export function acctView(
  params: { company?: string; month?: string },
  allowed: readonly Brand[],
): AcctView {
  const companies = allowed as AcctCompany[];
  /* the module's role guard has already refused an account with no company at
     all; fail CLOSED on the impossible case rather than reveal a default one */
  const company = (resolveModuleCompany(allowed, params.company) ?? companies[0]) as AcctCompany;
  const month = /^\d{4}-\d{2}$/.test(params.month ?? "") ? params.month! : cairoMonth();
  return { company, month, companies };
}

/** the query string that keeps the current view when navigating tabs */
export function acctQuery(view: AcctView): string {
  return `?company=${view.company}&month=${view.month}`;
}
