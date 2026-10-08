import { db } from "@/lib/db";
import type { Prisma } from "../../../generated/prisma/client";
import { INTERNAL_STAGES, type Role } from "@/lib/pipeline-engine/constants";
import { leadSearchWhere, leadTypeWhere } from "@/lib/services/lead-search";
import { bsLeadsWhere, ownLeadsWhere } from "@/lib/services/bsystems-admin";
import { crmEngineRole } from "@/lib/api/bsystems";
import { companiesFor, parseCompany, type CrmCompany } from "./company";

/* ============================================================================
   ADR-085 — ONE SEARCH BOX, BOTH COMPANIES.

   Founder, verbatim: "I want the search to be valid across both crm so if I
   searched for something and it's not in bsystesm's crm but it's in byteforce's
   it will automatically switch to byteforce crm and it will show me the lead."

   So: search the company you are in. Find nothing. If the OTHER company you
   hold has it, land there with the same search still applied, and say so.

   FIVE PROPERTIES.

   1. IT CANNOT WIDEN ACCESS BY ONE ROW. The hop is only ever offered between
      companies `companiesFor(roles)` already reports, and the probe runs the
      TARGET BOARD'S OWN PREDICATE — `bsLeadsWhere` / `ownLeadsWhere` /
      the ByteForce board's `byteforceBoardWhere`, imported, never restated. An
      agent's hop can therefore only find the agent's own card, and a
      `bsystems_sales` hop only the internal bucket. The alternative — a
      brand-only `count` — would have told a partner that SOMEBODY ELSE'S lead
      matched, which is a disclosure even though it names nothing: it answers
      "does this number exist in the other company" for a person who may not
      ask that.

   2. IT ONLY FIRES ON AN EMPTY RESULT. A search that found something is a
      search that worked; moving the founder off a screen that is answering him
      would be the opposite of help.

   3. IT HOPS AT MOST ONCE, AND THAT IS A LOOP GUARD, NOT A POLICY. Without it
      two companies that both return nothing would redirect to each other for
      ever — B-Systems finds nothing, sends you to ByteForce, which finds
      nothing, sends you back. `switched` on the URL is the evidence that a hop
      already happened, and its presence forbids another. It is also what the
      arrival notice reads, so one parameter does both jobs and they cannot
      disagree.

   4. IT NEVER HOPS A LOCKED ACCOUNT. A ByteForce-only user holds one company
      (ADR-067, the founder's own answer), `companiesFor` returns one, and there
      is nowhere to go. No probe runs at all.

   5. THE SEARCH SURVIVES THE HOP. The redirect carries the whole query string
      and only swaps `company`, so `q` and `type` arrive intact and the board
      shows the matching card — "and it will show me the lead".
   ========================================================================== */

/** The ByteForce board's predicate, named here rather than inline in the board
    for the reason ADR-085 §1 gives: the probe has to ask the board's own
    question. Kept beside the hop because this is the only other caller — the
    B-Systems twins live in `bsystems-admin.ts` with their queries. */
export function byteforceBoardWhere(opts: {
  search?: string;
  type?: string;
}): Prisma.LeadWhereInput {
  return {
    brand: "byteforce",
    archived: false,
    stage: { in: [...INTERNAL_STAGES] },
    ...leadSearchWhere(opts.search),
    ...leadTypeWhere(opts.type),
  };
}

/** The query-string key that records a hop. Read by the loop guard AND by the
    arrival notice, so "did we switch" has exactly one answer. */
export const SWITCHED_PARAM = "switched";

/** WHERE a hop could go, before anything is counted — the pure half, so the
    whole decision is testable without a database.

    Returns the company to probe, or null when no hop is possible: nothing was
    searched, the current screen already found something, this account holds one
    company, or a hop has already happened. */
export function hopCandidate(opts: {
  search: string;
  /** how many rows the CURRENT company's board found */
  resultCount: number;
  roles: Role[];
  current: CrmCompany;
  /** the raw `?switched=` value off the wire */
  switched?: string | readonly string[] | null;
}): CrmCompany | null {
  if (opts.search.trim() === "") return null; // nothing was asked
  if (opts.resultCount > 0) return null; // §2 — the search worked
  if (parseCompany(opts.switched)) return null; // §3 — one hop only, ever
  const held = companiesFor(opts.roles);
  return held.find((c) => c !== opts.current) ?? null; // §4 — null when locked
}

/** Does the TARGET company's board have a match for this person? Runs that
    board's own predicate — §1. `count` and not `findMany`: the hop needs to
    know whether to go, and nothing about the rows.

    The B-Systems side resolves the account's engine role exactly as its page
    does (`crmEngineRole`), so the three shapes the board really has — admin,
    sales, own-cards — are the three shapes the probe has. A role that cannot
    open the B-Systems board at all counts ZERO rather than falling back to a
    wider query, which is the fail-closed half of §1. */
export async function countMatchesIn(
  company: CrmCompany,
  user: { id: string; roles: Role[] },
  narrow: { search: string; type?: string },
): Promise<number> {
  if (company === "byteforce") {
    /* `companiesFor` has already proved `byteforce_staff`, and that board shows
       every ByteForce card — so its predicate IS the whole scope. */
    return db.lead.count({ where: byteforceBoardWhere(narrow) });
  }
  const role = crmEngineRole(company, user);
  if (role === "bsystems_admin") {
    return db.lead.count({ where: bsLeadsWhere(company, "any", narrow) });
  }
  if (role === "bsystems_sales") {
    return db.lead.count({ where: bsLeadsWhere(company, "internal", narrow) });
  }
  if (role === "bsystems_agent" || role === "bsystems_partner") {
    return db.lead.count({ where: ownLeadsWhere(company, user.id, narrow) });
  }
  /* data-entry, or no B-Systems pipeline role at all: the board is not theirs
     (ADR-051 carves data-entry out of every pipeline screen), so there is
     nothing for them to be sent to. */
  return 0;
}

/** The filters BOTH boards understand, and the only ones that cross.

    ADR-067's CompanySwitch states the rule this follows: "`owner`, `stage` and
    `sort` are B-Systems-shaped and mean nothing to the ByteForce bodies, so
    carrying them over would leave a board that looks filtered but is not —
    which reads as data loss, not as a nav bug." The hop is a switch, so it
    obeys the switch's rule. `q` is the search he typed and `type` is the lead
    type, and both boards narrow by both. */
const SHARED_FILTERS = ["q", "type"] as const;

/** The URL to send them to: the same address, the shared filters, the company
    swapped and the hop recorded. Built with `URLSearchParams` so a repeated or
    missing parameter cannot produce the `?company=a&company=b` shape ADR-067's
    `parseCompany` discards (BUG-019). */
export function hopUrl(opts: {
  path: string;
  params: Record<string, string | string[] | undefined>;
  to: CrmCompany;
  from: CrmCompany;
}): string {
  const search = new URLSearchParams();
  for (const key of SHARED_FILTERS) {
    const value = opts.params[key];
    /* a repeated parameter is junk to every other reader in this app, so it is
       junk here too — dropped rather than guessed at */
    if (typeof value === "string" && value !== "") search.set(key, value);
  }
  search.set("company", opts.to);
  search.set(SWITCHED_PARAM, opts.from); // where we came FROM, for the notice
  return `${opts.path}?${search.toString()}`;
}

/** THE WHOLE DECISION, for a board page to call before it renders: where to go,
    or null to stay put.

    THE CHEAP CHECKS COME FIRST, and that ordering is the performance design.
    The three free questions — did he search, has a hop already happened, does
    this account hold a second company — are answered before any query runs, so
    an ordinary board load (no search box, or a locked account) costs exactly
    nothing. Only a search by a two-company account reaches the counts, and then
    it is two `count`s on an indexed predicate, never a `findMany`.

    Deliberately ONE call: a page that had to remember the candidate check, then
    its own count, then the other company's count, then the URL, is a page the
    next screen copies three quarters of. */
export async function searchHop(opts: {
  search: string;
  user: { id: string; roles: Role[] };
  current: CrmCompany;
  path: string;
  params: Record<string, string | string[] | undefined>;
}): Promise<{ to: CrmCompany; url: string } | null> {
  /* `resultCount: 0` is a placeholder for the one question not yet asked — the
     other four are free, and three of them end the matter. */
  const candidate = hopCandidate({
    search: opts.search,
    resultCount: 0,
    roles: opts.user.roles,
    current: opts.current,
    switched: opts.params[SWITCHED_PARAM],
  });
  if (!candidate) return null;

  const type = typeof opts.params.type === "string" ? opts.params.type : undefined;
  const narrow = { search: opts.search, type };

  /* §2 — only an EMPTY result hops. Asked of the same predicate the board
     itself will run, so "the board found nothing" and "the probe thinks the
     board found nothing" cannot disagree. */
  if ((await countMatchesIn(opts.current, opts.user, narrow)) > 0) return null;

  const matches = await countMatchesIn(candidate, opts.user, narrow);
  if (matches === 0) return null; // nobody has it — stay, and say nothing

  return {
    to: candidate,
    url: hopUrl({ path: opts.path, params: opts.params, to: candidate, from: opts.current }),
  };
}
