import { cookies } from "next/headers";
import { db } from "@/lib/db";
import type { Prisma } from "../../../generated/prisma/client";
import type { Brand, Role } from "@/lib/pipeline-engine/constants";
import { formatMsg, tFor, type Locale, type Msg } from "@/lib/i18n/core";
import { boardPerson as m, roles as roleMsgs } from "@/lib/i18n/dict/crm";
import { isCompanyAdmin } from "@/lib/auth/lead-scope";
import { listAssignableOwners, listByteforceOwners } from "@/lib/services/users";
import { parseCompany } from "./company";
import {
  arrivedByHop,
  BOARD_PERSON_COOKIE,
  boardPersonValue,
  boardPersonWhere,
  parseBoardPerson,
  resolveBoardPerson,
  type BoardPerson,
} from "./board-person";

/* ADR-109 — the server half of the admin's person switch: the remembered
   choice, the people it offers (with how many leads each has on this board),
   and the choice the board applies. The rules themselves are pure and live in
   ./board-person; this file gathers what they need — and it is the WALL:
   `boardPersonView` answers nothing to anybody who is not the company admin,
   so no caller can show a salesperson the roster or the company's counts by
   forgetting to ask first. */

export interface BoardPersonOption {
  /** the wire value (`boardPersonValue`) */
  value: string;
  /** what the select shows: "Ahmed (12)" */
  label: string;
}

export interface BoardPersonView {
  /** the choice the board applies — after ./board-person's rules */
  person: BoardPerson;
  /** its wire value, for the select */
  value: string;
  /** Everyone, Mine, Unassigned */
  fixed: BoardPersonOption[];
  /** everybody else, by name */
  people: BoardPersonOption[];
  /** the chosen person's plain name, for a sentence ("None of Ahmed's leads…") */
  personName: string | null;
}

const ROLE_LABELS: Record<string, Msg> = roleMsgs;

/** The remembered choice for this company — parsed, never trusted. */
export async function readBoardPerson(company: Brand): Promise<BoardPerson> {
  return parseBoardPerson((await cookies()).get(BOARD_PERSON_COOKIE[company])?.value);
}

/** Who can be handed this company's leads today: ByteForce staff, or
    B-Systems' agents, partners and internal sales — with the role and partner
    company beside a B-Systems name, as the follow-up hand-over shows it. (The
    hand-over also accepts another B-Systems admin; he is not listed here
    unless he holds a lead on the board, below — an admin with no leads would
    only ever show an empty board.) */
async function rosterFor(
  company: Brand,
  locale: Locale,
): Promise<Array<{ id: string; name: string; detail: string }>> {
  const t = tFor(locale);
  if (company === "byteforce") {
    return (await listByteforceOwners()).map((u) => ({ id: u.id, name: u.name, detail: "" }));
  }
  return (await listAssignableOwners()).map((o) => {
    const role = o.roles.find((r) => ROLE_LABELS[r]);
    const roleLabel = role ? t(ROLE_LABELS[role]!) : "";
    return {
      id: o.id,
      name: o.name,
      detail: `${roleLabel ? ` — ${roleLabel}` : ""}${o.company ? ` · ${o.company}` : ""}`,
    };
  });
}

/** Everything the board needs to draw the switch and to narrow its rows — or
    NULL for anybody who is not this company's admin (rule 1).

    `boardWhere` is the board's WHOLE-COMPANY predicate, with no search and no
    type: the counts say how many leads each person has on this board, and a
    person stays on offer while somebody is searching. The people are the
    roster plus anybody who still owns a lead here (an account that has since
    been removed keeps its leads until they are handed on, and the admin must
    be able to find them; it is marked "removed"). The viewer is not among
    them: he is "Mine". */
export async function boardPersonView(opts: {
  company: Brand;
  viewer: { id: string; roles: readonly Role[] };
  boardWhere: Prisma.LeadWhereInput;
  /** the raw `?switched=` value off the wire (ADR-085) */
  switched: string | readonly string[] | undefined;
  locale: Locale;
}): Promise<BoardPersonView | null> {
  if (!isCompanyAdmin(opts.viewer, opts.company)) return null;
  const viewerId = opts.viewer.id;
  const t = tFor(opts.locale);
  const [stored, roster, grouped] = await Promise.all([
    readBoardPerson(opts.company),
    rosterFor(opts.company, opts.locale),
    db.lead.groupBy({ by: ["ownerUserId"], where: opts.boardWhere, _count: { _all: true } }),
  ]);

  const countOf = new Map<string | null, number>(grouped.map((g) => [g.ownerUserId, g._count._all]));
  const total = grouped.reduce((sum, g) => sum + g._count._all, 0);

  const people = new Map<string, { name: string; detail: string }>();
  for (const r of roster) {
    if (r.id !== viewerId) people.set(r.id, { name: r.name, detail: r.detail });
  }
  const missing = grouped
    .map((g) => g.ownerUserId)
    .filter((id): id is string => id !== null && id !== viewerId && !people.has(id));
  if (missing.length > 0) {
    const users = await db.user.findMany({
      where: { id: { in: missing } },
      select: { id: true, name: true, active: true },
    });
    for (const u of users) {
      people.set(u.id, { name: u.name, detail: u.active ? "" : ` — ${t(m.removed)}` });
    }
  }

  const withCount = (name: string, count: number) =>
    t(formatMsg(m.withCount, { name, count: String(count) }));

  const person = resolveBoardPerson({
    stored,
    isAdmin: true, // asked above
    viewerId,
    offered: new Set(people.keys()),
    arrivedByHop: arrivedByHop(parseCompany(opts.switched), opts.company),
  });

  return {
    person,
    value: boardPersonValue(person),
    fixed: [
      { value: "all", label: withCount(t(m.everyone), total) },
      { value: "mine", label: withCount(t(m.mine), countOf.get(viewerId) ?? 0) },
      { value: "unassigned", label: withCount(t(m.unassigned), countOf.get(null) ?? 0) },
    ],
    people: [...people.entries()]
      .sort(([, a], [, b]) => a.name.localeCompare(b.name))
      .map(([id, p]) => ({
        value: boardPersonValue({ kind: "user", userId: id }),
        label: withCount(`${p.name}${p.detail}`, countOf.get(id) ?? 0),
      })),
    personName: person.kind === "user" ? (people.get(person.userId)?.name ?? null) : null,
  };
}

/** The narrowing the board adds for this view (none on Everyone, or for a
    viewer who has no view). */
export function boardPersonNarrowing(
  view: BoardPersonView | null,
  viewerId: string,
): { ownerUserId?: string | null } | undefined {
  if (!view || view.person.kind === "all") return undefined;
  return boardPersonWhere(view.person, viewerId);
}

/** The sentence for a search that came back empty BECAUSE of the switch — or
    null when the switch is on Everyone, or when everyone's leads would not
    have matched either (then the board's own "No leads match" is the truth,
    and "Show everyone's leads" would only show the same nothing).
    `matchesForEveryone` is the caller's count of the same search without the
    switch; it is only asked for when the board came back empty. */
export function boardPersonNoMatches(
  view: BoardPersonView,
  matchesForEveryone: number,
  locale: Locale,
): string | null {
  if (matchesForEveryone === 0) return null;
  const t = tFor(locale);
  switch (view.person.kind) {
    case "mine":
      return t(m.noMatchesMine);
    case "unassigned":
      return t(m.noMatchesUnassigned);
    case "user":
      return t(formatMsg(m.noMatchesPerson, { name: view.personName ?? "" }));
    default:
      return null;
  }
}
