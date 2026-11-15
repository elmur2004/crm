import { z } from "zod";
import { db } from "@/lib/db";
import type { Prisma } from "../../../generated/prisma/client";
import { ApiError } from "@/lib/api-error";
import { isCompanyAdmin, type RoleHolder } from "@/lib/auth/lead-scope";
import { BRANDS, type Brand, type Role } from "@/lib/pipeline-engine/constants";
import { configForBrand } from "@/lib/pipeline-engine/configs/for-brand";
import { formatMsg } from "@/lib/i18n/core";
import { undoLabels } from "@/lib/i18n/dict/undo";
import { writeLogMany, type Actor } from "./activity";
import { assignedNotice, resolveAssignee, type Assignee } from "./leads";
import { leadSearchWhere } from "./lead-search";
import { notifyUser } from "./notifications";
import { recordUndo, type BulkAssignSnapshot } from "./undo";
import { BSYSTEMS_OWNER_ROLES } from "./users";

/* ============================================================================
   MASS ASSIGN — the Users app hands many leads to one person at once (ADR-105).

   Founder, 2026-11-15: "add a way to mass assign leads to someone — I can
   choose them in the users section and select mass assign and select from the
   crms both crms".

   So the person comes first: on the admin's "All users" table, every account
   that can own leads carries "Assign leads", which opens a list of leads from
   BOTH CRMs (as far as that person can own them), ticked in bulk and handed
   over in one press.

   It is the single hand-over, many times, in ONE transaction — never a second
   set of rules:
     · who may receive    `resolveAssignee`, per company, exactly as the Assign
                          button, "Take it" and the follow-up hand-over;
     · who may give       the COMPANY admin of every lead in the batch (the
                          assign routes' wall), read from the live roles;
     · what it writes     the two ownership columns, one `assigned` history row
                          per lead, archived leads refused;
     · who is told        the new owner, ONCE — the single hand-over's own
                          notice for one lead, one summary for many, instead of
                          a bell row per lead;
     · undo               ONE step for the whole batch (`lead_assign_bulk`),
                          all or nothing (undo.ts).
   ========================================================================== */

/** One press hands over at most this many — one screenful of the list, and a
    transaction that stays short. */
export const MASS_ASSIGN_MAX = 500;

export const massAssignSchema = z.object({
  leadIds: z
    .array(z.string().min(1).max(64))
    .min(1, "Choose at least one lead")
    .max(MASS_ASSIGN_MAX, `Choose at most ${MASS_ASSIGN_MAX} leads at a time`),
});

/** The companies whose leads THIS account can be given from the Users app: the
    Assign roster's rule (assign-roster.ts — live, approved agents, partners and
    internal sales for B-Systems; live, approved staff for ByteForce), narrowed
    to the companies the VIEWER administers. Empty = no "Assign leads" for him.
    A courtesy for the screen; the write re-checks everything (`massAssignLeads`). */
export function massAssignCompaniesFor(
  target: { active: boolean; registrationStatus: string; roles: readonly string[] },
  viewer: RoleHolder,
): Brand[] {
  if (!target.active || target.registrationStatus !== "approved") return [];
  const out: Brand[] = [];
  if (
    isCompanyAdmin(viewer, "bsystems") &&
    target.roles.some((r) => (BSYSTEMS_OWNER_ROLES as readonly string[]).includes(r))
  ) {
    out.push("bsystems");
  }
  if (isCompanyAdmin(viewer, "byteforce") && target.roles.includes("byteforce_staff")) {
    out.push("byteforce");
  }
  return out;
}

/* ------------------------------------------------------------- the list */

/** Whose leads the list shows. `free` — nobody's yet, or the admin's own (an
    admin-added B-Systems lead sits in his bucket, owned by him) — is the
    default: the pile he hands out. A user id narrows to that person's leads,
    which is how a leaver's whole list moves to someone else. */
export const OWNER_FILTERS = ["free", "unassigned", "mine", "any"] as const;
/** The Stage filter's named options: every stage of these companies'
    pipelines, read from the ENGINE (§5.1 — never a hand-kept list), in board
    order, each once. `open` and `any` come before them. */
export function stageOptionsFor(companies: readonly Brand[]): string[] {
  const out: string[] = [];
  for (const c of companies) {
    for (const s of configForBrand(c).stages) if (!out.includes(s)) out.push(s);
  }
  return out;
}

export interface CandidateFilters {
  company: Brand | "both";
  owner: string;
  stage: string;
  q: string;
}

export function parseCandidateFilters(
  params: { company?: string; owner?: string; stage?: string; q?: string },
  companies: readonly Brand[],
): CandidateFilters {
  const company =
    params.company && (companies as readonly string[]).includes(params.company)
      ? (params.company as Brand)
      : companies.length === 1
        ? companies[0]!
        : "both";
  const owner =
    params.owner && ((OWNER_FILTERS as readonly string[]).includes(params.owner) || /^[\w-]{1,64}$/.test(params.owner))
      ? params.owner
      : "free";
  const stage =
    params.stage && (params.stage === "any" || stageOptionsFor(companies).includes(params.stage))
      ? params.stage
      : "open";
  return { company, owner, stage, q: (params.q ?? "").trim().slice(0, 200) };
}

/** Every lead this person could be handed, before any filter: live (not
    archived), in a company he can own, and not already his. */
function baseWhere(targetId: string, companies: readonly Brand[]): Prisma.LeadWhereInput {
  return {
    brand: { in: [...companies] },
    archived: false,
    OR: [{ ownerUserId: null }, { ownerUserId: { not: targetId } }],
  };
}

function ownerWhere(owner: string, viewerId: string): Prisma.LeadWhereInput {
  switch (owner) {
    case "free":
      return { OR: [{ ownerUserId: null }, { ownerUserId: viewerId }] };
    case "unassigned":
      return { ownerUserId: null };
    case "mine":
      return { ownerUserId: viewerId };
    case "any":
      return {};
    default:
      return { ownerUserId: owner };
  }
}

/** `open` hides each pipeline's OWN terminal stages (its won and lost), per
    company — handing out a closed deal is rare, and a "select all" should not
    sweep them up by default. A named stage narrows to the companies whose
    pipeline has it (a stage no other pipeline has simply matches none there). */
function stageWhere(stage: string, brands: readonly Brand[]): Prisma.LeadWhereInput {
  if (stage === "any") return {};
  if (stage === "open") {
    return {
      OR: brands.map((brand) => ({
        brand,
        stage: { notIn: [...configForBrand(brand).terminalStages] },
      })),
    };
  }
  return { stage };
}

export interface MassAssignCandidates {
  rows: Array<{
    id: string;
    brand: Brand;
    name: string;
    companyName: string | null;
    number: string;
    stage: string;
    ownerUserId: string | null;
    ownerName: string | null;
    createdAt: Date;
  }>;
  /** how many match — more than `rows` when the list is capped */
  total: number;
  /** the people who own any of this person's candidates now (the owner
      filter's named options), the viewer himself excluded — he is "yours" */
  owners: Array<{ id: string; name: string; count: number }>;
}

export async function listMassAssignCandidates(
  viewerId: string,
  targetId: string,
  companies: readonly Brand[],
  filters: CandidateFilters,
): Promise<MassAssignCandidates> {
  if (companies.length === 0) return { rows: [], total: 0, owners: [] };
  const base = baseWhere(targetId, companies);
  const brands = filters.company === "both" ? companies : [filters.company];
  const where: Prisma.LeadWhereInput = {
    AND: [
      base,
      { brand: { in: [...brands] } },
      ownerWhere(filters.owner, viewerId),
      stageWhere(filters.stage, brands),
      leadSearchWhere(filters.q),
    ],
  };
  const [rows, total, grouped] = await Promise.all([
    db.lead.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      take: MASS_ASSIGN_MAX,
      select: {
        id: true,
        brand: true,
        name: true,
        companyName: true,
        number: true,
        stage: true,
        ownerUserId: true,
        createdAt: true,
        owner: { select: { name: true } },
      },
    }),
    db.lead.count({ where }),
    db.lead.groupBy({ by: ["ownerUserId"], where: base, _count: { _all: true } }),
  ]);
  const counted = grouped.filter(
    (g): g is typeof g & { ownerUserId: string } => g.ownerUserId !== null && g.ownerUserId !== viewerId,
  );
  const names = await db.user.findMany({
    where: { id: { in: counted.map((g) => g.ownerUserId) } },
    select: { id: true, name: true },
  });
  const nameOf = new Map(names.map((u) => [u.id, u.name]));
  return {
    rows: rows.map((r) => ({
      id: r.id,
      brand: r.brand as Brand,
      name: r.name,
      companyName: r.companyName,
      number: r.number,
      stage: r.stage,
      ownerUserId: r.ownerUserId,
      ownerName: r.owner?.name ?? null,
      createdAt: r.createdAt,
    })),
    total,
    owners: counted
      .map((g) => ({ id: g.ownerUserId, name: nameOf.get(g.ownerUserId) ?? "—", count: g._count._all }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

/* ------------------------------------------------------------- the write */

export interface MassAssignResult {
  /** leads that changed hands */
  assigned: number;
  /** leads in the batch that were already exactly his (nothing written) */
  alreadyTheirs: number;
}

const GONE = "Some of these leads no longer exist — reload the list and choose again";
const RACED = "Some of these leads changed while you were choosing — reload the list and try again";

export async function massAssignLeads(
  viewer: { id: string; name: string; roles: readonly Role[] },
  targetUserId: string,
  leadIds: readonly string[],
): Promise<MassAssignResult> {
  const actor: Actor = { id: viewer.id, label: viewer.name };
  const ids = [...new Set(leadIds)];
  if (ids.length === 0) throw new ApiError(400, "Choose at least one lead");
  if (ids.length > MASS_ASSIGN_MAX) {
    throw new ApiError(400, `Choose at most ${MASS_ASSIGN_MAX} leads at a time`);
  }

  return db.$transaction(
    async (tx) => {
      /* the wall: only leads of a company this viewer ADMINISTERS are read at
         all, so a lead of another company answers exactly like one that does
         not exist (nothing to learn from the difference) */
      const adminOf = BRANDS.filter((brand) => isCompanyAdmin(viewer, brand));
      if (adminOf.length === 0) throw new ApiError(403, "Only the admin can hand leads to people");
      const leads = await tx.lead.findMany({
        where: { id: { in: ids }, brand: { in: [...adminOf] } },
        select: {
          id: true,
          brand: true,
          name: true,
          companyName: true,
          ownerUserId: true,
          ownerType: true,
          archived: true,
        },
      });
      if (leads.length !== ids.length) throw new ApiError(404, GONE);
      const brands = [...new Set(leads.map((l) => l.brand))] as Brand[];
      if (leads.some((l) => l.archived)) {
        throw new ApiError(400, "One of these leads is archived — unarchive it first");
      }

      /* the single hand-over's own refusals, once per company */
      const assignees = new Map<Brand, Assignee>();
      for (const brand of brands) assignees.set(brand, await resolveAssignee(brand, targetUserId, tx));
      const target = assignees.get(brands[0]!)!;

      const moves = leads
        .map((lead) => ({ lead, ownerType: assignees.get(lead.brand as Brand)!.ownerType(lead) }))
        .filter(({ lead, ownerType }) => !(lead.ownerUserId === target.id && lead.ownerType === ownerType));
      if (moves.length === 0) return { assigned: 0, alreadyTheirs: leads.length };

      /* ONE timestamp for the whole batch: it is the undo's fingerprint for
         every lead in it (undo.ts, undoBulkAssign) */
      const now = new Date();
      const byType = new Map<string, string[]>();
      for (const m of moves) byType.set(m.ownerType, [...(byType.get(m.ownerType) ?? []), m.lead.id]);
      for (const [ownerType, group] of byType) {
        const written = await tx.lead.updateMany({
          where: { id: { in: group }, archived: false },
          data: { ownerUserId: target.id, ownerType, updatedAt: now },
        });
        if (written.count !== group.length) throw new ApiError(409, RACED);
      }

      await writeLogMany(
        tx,
        moves.map((m) => ({
          entityType: "lead" as const,
          entityId: m.lead.id,
          actor,
          action: "update" as const,
          trigger: "assigned",
        })),
      );

      /* the new owner's bell — once. Taking leads YOURSELF pings nobody (the
         single hand-over's rule). */
      if (target.id !== actor.id) {
        if (moves.length === 1) {
          await notifyUser(tx, { userId: target.id, ...assignedNotice(moves[0]!.lead, actor, "assigned") });
        } else {
          const named = moves.slice(0, 3).map((m) => `"${m.lead.name}"`);
          const rest = moves.length - named.length;
          await notifyUser(tx, {
            userId: target.id,
            type: "assigned",
            title: `Assigned to you: ${moves.length} leads`,
            body:
              `${actor.label} made you the owner of ${moves.length} leads: ${named.join(", ")}` +
              (rest > 0 ? ` and ${rest} more.` : ".") +
              " They are on your board now.",
            leadId: null,
          });
        }
      }

      /* undo — one lead is the single hand-over's own entry, word for word;
         a batch is one entry for all of them */
      if (moves.length === 1) {
        const { lead } = moves[0]!;
        const label = formatMsg(undoLabels.assigned, { name: lead.name, owner: target.name });
        await recordUndo({
          tx,
          actor,
          kind: "lead_assign",
          entityType: "lead",
          entityId: lead.id,
          fingerprint: now,
          label: label.en,
          labelAr: label.ar,
          payload: { ownerUserId: lead.ownerUserId, ownerType: lead.ownerType },
        });
      } else {
        const label = formatMsg(undoLabels.assignedMany, {
          count: String(moves.length),
          owner: target.name,
        });
        const payload: BulkAssignSnapshot = {
          leads: moves.map(({ lead }) => ({
            id: lead.id,
            ownerUserId: lead.ownerUserId,
            ownerType: lead.ownerType,
          })),
        };
        await recordUndo({
          tx,
          actor,
          kind: "lead_assign_bulk",
          entityType: "lead",
          entityId: moves[0]!.lead.id,
          fingerprint: now,
          label: label.en,
          labelAr: label.ar,
          payload: payload as unknown as Prisma.InputJsonValue,
        });
      }

      return { assigned: moves.length, alreadyTheirs: leads.length - moves.length };
    },
    { timeout: 30_000, maxWait: 10_000 },
  );
}
