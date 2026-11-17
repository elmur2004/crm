import { BRANDS, type Brand } from "@/lib/pipeline-engine/constants";

/* ============================================================================
   ADR-109 — WHOSE LEADS THE BOARD SHOWS: the company admin's person switch.

   Founder, verbatim (2026-11-17): "I need to add like a button on top of the
   CRMs, both CRMs, called main [Mine]. It's just visible for the admin because
   all other users just see their CRM by default. And the button I can change
   it either mine or either this person or this person, so I can basically
   filter by person the CRM, the entire CRM."

   So the company admin's board — and ONLY his — gets a switch at the top:
   Everyone (what he sees today, and the default), Mine, Unassigned, or any one
   person. It narrows every column at once.

   FOUR RULES, all enforced on the server:

   1. IT ONLY EVER NARROWS. The choice is composed with the viewer's own scope
      under an `AND`, never spread into it, so it cannot replace an
      `ownerUserId` the scope already set. And it is read for the company admin
      only: `boardPersonView` (./board-person-menu) asks `isCompanyAdmin`
      itself and returns nothing for anybody else, so a hand-written cookie
      shows a salesperson exactly his own cards. `resolveBoardPerson` says the
      same again, for any caller that reaches it another way.
   2. IT IS REMEMBERED, PER COMPANY. A cookie, not the address: he opens a
      lead and comes back with "Back to the CRM board", or comes back
      tomorrow, and the board still shows whom he chose. Each company keeps
      its own choice, because the two companies have different people.
   3. A NAME THAT IS NOT ON OFFER IS EVERYONE. A stored person who has left
      (no account on the roster and no lead on this board) falls back to
      Everyone, so the switch never shows one thing while the board shows
      another.
   4. A SEARCH HOP LANDS ON EVERYONE. ADR-085 moves a search with no result to
      the other company "and it will show me the lead". That board's own
      choice could hide the very card the hop found, so on ARRIVAL — `switched`
      on the address naming the OTHER company (`arrivedByHop`) — the board
      shows everyone's cards. The notice's way back marks `switched` with the
      board it returns to, which ADR-085 defines as "nothing to announce", so
      that is not an arrival — and there the marker is the loop guard, so it
      stays. The moment he picks someone on an ARRIVAL page, the switch drops
      `switched` from the address (BoardPersonSwitch), so his choice applies at
      once.

   Pure: no Prisma, no next/headers — the boards, the action and the unit tests
   import the same answers.
   ========================================================================== */

/** One cookie per company (rule 2). */
export const BOARD_PERSON_COOKIE: Record<Brand, string> = {
  bsystems: "board_person_bsystems",
  byteforce: "board_person_byteforce",
};

/** A year, like the language and theme cookies: it is a preference. */
export const BOARD_PERSON_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export type BoardPerson =
  | { kind: "all" }
  | { kind: "mine" }
  | { kind: "unassigned" }
  | { kind: "user"; userId: string };

const USER_PREFIX = "user:";
/* the same id shape the Users app's ?assign= accepts */
const ID_RE = /^[\w-]{1,64}$/;

/** The wire value (cookie and select) back to a choice. Anything unknown is
    Everyone — the default, and what the admin sees without a choice. */
export function parseBoardPerson(raw: string | null | undefined): BoardPerson {
  if (raw === "mine") return { kind: "mine" };
  if (raw === "unassigned") return { kind: "unassigned" };
  if (typeof raw === "string" && raw.startsWith(USER_PREFIX)) {
    const userId = raw.slice(USER_PREFIX.length);
    if (ID_RE.test(userId)) return { kind: "user", userId };
  }
  return { kind: "all" };
}

/** A choice as its wire value — the inverse of `parseBoardPerson`. */
export function boardPersonValue(person: BoardPerson): string {
  return person.kind === "user" ? `${USER_PREFIX}${person.userId}` : person.kind;
}

/** The narrowing a choice adds to a board's own predicate (rule 1: the caller
    puts it under an `AND`). Everyone adds nothing. */
export function boardPersonWhere(
  person: BoardPerson,
  viewerId: string,
): { ownerUserId?: string | null } {
  switch (person.kind) {
    case "mine":
      return { ownerUserId: viewerId };
    case "unassigned":
      return { ownerUserId: null };
    case "user":
      return { ownerUserId: person.userId };
    default:
      return {};
  }
}

/** ADR-085's hop marker on the address — the same key as search-hop.ts's
    `SWITCHED_PARAM` (the integration test pins the two together). Spelled
    here because the client switch must drop it, and search-hop.ts reads the
    database, which a client module cannot import. */
export const HOP_MARKER_PARAM = "switched";

/** Did this request arrive by a search hop (rule 4)? Only when `switched`
    names a company and it is not the one being shown: ADR-085's notice marks
    its way BACK with the board it returns to. */
export function arrivedByHop(switched: string | null | undefined, current: Brand): boolean {
  return (BRANDS as readonly string[]).includes(switched ?? "") && switched !== current;
}

/** The choice the board actually applies — rules 1, 3 and 4 in one place.
    `offered` is the set of person ids the switch lists (the viewer excluded:
    he is "Mine"). */
export function resolveBoardPerson(opts: {
  stored: BoardPerson;
  isAdmin: boolean;
  viewerId: string;
  offered: ReadonlySet<string>;
  /** ADR-085's `switched` marker is on the address */
  arrivedByHop: boolean;
}): BoardPerson {
  if (!opts.isAdmin) return { kind: "all" }; // rule 1 — his scope already says "own"
  if (opts.arrivedByHop) return { kind: "all" }; // rule 4
  const { stored } = opts;
  if (stored.kind !== "user") return stored;
  if (stored.userId === opts.viewerId) return { kind: "mine" };
  return opts.offered.has(stored.userId) ? stored : { kind: "all" }; // rule 3
}
