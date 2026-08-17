import { ACCT_COMPANIES, type AcctCompany } from "./constants";
import { cairoMonth } from "./now";

/* Every accounting page carries ?company=&month= — company is a FILTER on one
   admin screen set (INTEGRATION-PLAN §3), month is the viewed bookkeeping
   month. Bad values fall back rather than 400 on a PAGE. */

export interface AcctView {
  company: AcctCompany;
  month: string; // "YYYY-MM"
}

export function acctView(params: { company?: string; month?: string }): AcctView {
  const company: AcctCompany = (ACCT_COMPANIES as readonly string[]).includes(params.company ?? "")
    ? (params.company as AcctCompany)
    : "byteforce";
  const month = /^\d{4}-\d{2}$/.test(params.month ?? "") ? params.month! : cairoMonth();
  return { company, month };
}

/** the query string that keeps the current view when navigating tabs */
export function acctQuery(view: AcctView): string {
  return `?company=${view.company}&month=${view.month}`;
}
