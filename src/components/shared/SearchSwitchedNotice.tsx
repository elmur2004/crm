import Link from "next/link";
import { getLocale } from "@/lib/i18n/server";
import { tFor, formatMsg } from "@/lib/i18n/core";
import { leadsFilters } from "@/lib/i18n/dict/crm";
import { acctCompanies } from "@/lib/i18n/dict/accounting";
import { oneValue, parseCompany, type CrmCompany } from "@/lib/crm/company";
import { SWITCHED_PARAM } from "@/lib/crm/search-hop";

/* ============================================================================
   ADR-085 — THE SENTENCE THAT MAKES AN AUTOMATIC SWITCH HONEST.

   Founder: "if I searched for something and it's not in bsystesm's crm but it's
   in byteforce's it will automatically switch to byteforce crm and it will show
   me the lead."

   He asked for it to happen by itself, so it does — and then it SAYS SO. A
   silent switch is the one way this feature could go wrong in a way that
   matters: the company switch, the board's columns and every card on screen
   change at once, and with no sentence that reads as the app losing his place
   rather than as it answering him.

   THE `switched` PARAMETER DOES TWO JOBS, and that is deliberate (one
   parameter, so the loop guard and the notice can never disagree about whether
   a hop happened):

     switched = the OTHER company  → a hop just happened; show this notice.
     switched = the CURRENT company → he pressed "Back" below. The guard still
                                      holds (no second hop, whatever he
                                      searched), and there is nothing to
                                      announce, so this renders nothing. Without
                                      that case the Back link would land on a
                                      board that finds nothing and bounce him
                                      straight here again.

   THE BACK LINK KEEPS HIS SEARCH. An automatic move has to be undoable in one
   click, and undoing it must not throw away what he typed. */

export async function SearchSwitchedNotice({
  current,
  params,
  path,
}: {
  current: CrmCompany;
  /* every value `string | string[]`, because that is what Next really hands a
     server page for a repeated parameter. Each is read through `oneValue` /
     `parseCompany`, so a repetition reads as absent rather than as "a,b". */
  params: {
    q?: string | string[];
    type?: string | string[];
    [SWITCHED_PARAM]?: string | string[];
  };
  /** the address to go back to — the page's own, so the notice never guesses */
  path: string;
}) {
  const from = parseCompany(params[SWITCHED_PARAM]);
  /* no hop, junk on the wire, or he already came back — say nothing */
  if (!from || from === current) return null;
  const q = (oneValue(params.q) ?? "").trim();
  if (q === "") return null; // a notice about a search needs the search

  const locale = await getLocale();
  const t = tFor(locale);

  const back = new URLSearchParams();
  back.set("q", q);
  const type = oneValue(params.type);
  if (type) back.set("type", type);
  back.set("company", from);
  /* the guard, kept ON and pointed at the company he is landing on — see the
     two jobs above. This is what stops Back from re-hopping. */
  back.set(SWITCHED_PARAM, from);

  return (
    <div className="alert-switched" role="status">
      <span>
        {/* the company names go in as Msg, not as already-rendered text, so the
            Arabic sentence carries the Arabic label rather than whatever the
            English branch happened to pick */}
        {t(
          formatMsg(leadsFilters.switchedNotice, {
            from: acctCompanies[from],
            to: acctCompanies[current],
            q,
          }),
        )}
      </span>
      <Link href={`${path}?${back.toString()}`}>
        {t(formatMsg(leadsFilters.switchedBack, { from: acctCompanies[from] }))}
      </Link>
    </div>
  );
}
