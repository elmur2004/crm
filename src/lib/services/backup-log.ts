import { formatCairo, formatCairoDate } from "@/lib/datetime";
import { interactionPhrase } from "@/lib/i18n/dict/daily-report";

/* ============================================================================
   ADR-084 — THE PER-LEAD LOG INSIDE THE BACKUP FILE.

   Founder, verbatim: "when I export the data as json I want the exact log for
   each single lead to be extracted." Asked which export and how deep, his two
   answers were "the full system backup" and "activities entries comments dates
   hours meetings each single action and when it happend".

   FOUR PROPERTIES, EACH ONE OF HIS WORDS.

   1. IT IS ADDED, NEVER RESHAPED. The backup file is the RESTORE artefact:
      `importBackup` wipes the database and re-inserts `tables` verbatim with
      ids preserved. So not one byte inside `tables` moves, is re-keyed or is
      nested — this log is a SECOND, DERIVED top-level section that the restore
      path never reads. The round-trip test asserts both directions (a new
      export restores; an export made before this section existed still
      restores), because "the file that rebuilds the company" is not a thing to
      be clever with.

   2. IT IS DERIVED IN MEMORY, AT ZERO QUERY COST. `exportBackup` has already
      read every table before this module runs, so the log is assembled from
      those arrays — no second pass over the database, no N+1 per lead. Every
      source is bucketed by lead id in ONE pass (`groupBy` below) rather than
      filtered per lead: the naive shape is leads × rows, which at 10k leads
      and 200k history rows is two billion comparisons for a file he downloads
      from a web request.

   3. EVERY ENTRY SAYS WHEN, TO THE HOUR. "dates hours". Each entry carries
      `at` — the stored UTC instant, ISO-8601, for anything that will read this
      file as data — AND `atCairo`, the same instant on the Cairo wall clock in
      the product's 12-hour convention (ADR-068), via `formatCairo` rather than
      a clock built here. A follow-up that was deliberately left date-only
      (ADR-063) reads date-only in its DUE reading and keeps its full stamp for
      when it was LOGGED, because those are two different questions.

   4. EVERY ENTRY SAYS WHO, OR SAYS IT DOES NOT KNOW. `by` is the stored actor
      label where the row has one and `null` where it does not — never inferred
      from a neighbouring row, never defaulted to the admin running the export.
      The field groups (§6.2: follow-ups, meetings, proposals, lost/postpone
      reasons, won figures) carry no actor column in this schema at all; their
      author is in the paired history entry at the same instant, and inventing
      one here would be fabricating attribution inside an audit artefact.

   ---------------------------------------------------------------------------
   WHAT A LEAD'S LOG CONTAINS — the complete reachable set, and his "each single
   action" is read as the whole of it rather than as the board's view of it.

     · ITS HISTORY (`ActivityLog`, entityType "lead"): every stage move,
       automatic transfer, same-stage record, create, edit, assignment, archive,
       didn't-answer press and its clear, WhatsApp open, undo and delete —
       phrased with `interactionPhrase`, the SAME vocabulary the daily report
       speaks (ADR-081), so the two screens and this file cannot drift into
       three descriptions of one event.
     · ITS DEAL'S HISTORY, resolved through the chain the schema gives:
       `won_deal` rows via WonDeal.leadId, `client` rows via Client.leadId, and
       `statement` rows via Statement → Milestone → WonDeal → Lead. The daily
       report deliberately EXCLUDES this post-win money admin because it is a
       report about a person's day; a LEAD's own log is the opposite question,
       and a milestone ticked or a statement paid is unarguably something that
       happened to this lead. Each entry names which record it is `about`, so
       the two kinds are never confused.
     · ITS CHAT (`LeadComment`) with the body text and the resolved @mentions.
     · ITS FIELD GROUPS: follow-ups (due instant, whether a time was chosen,
       method, what it is about), meetings (slot, mode, attendees — including
       the ADR-071 accounts whose time it blocks — technical support and
       outcome), proposals, lost reasons, postpone reasons and notes,
       negotiation notes, and the won figures.
     · ITS DEAL, ITS MILESTONE PLAN AND ITS STATEMENTS. A statement emits a
       SECOND entry at the instant it was paid, and a milestone one at the
       instant it was completed, because "when it happened" for a payment is the
       day the money arrived and not the day the row was raised.
     · ITS TICKED TO-DO TASKS (`TodoDone`), resolved through the follow-up or
       meeting the mark is keyed to (ADR-062 keys them to the record, never to a
       lead), with who ticked it.
     · ITS ATTACHED FILES, reachable via the deal and its statements — the
       contract and the payment proofs.

   DELIBERATELY OUTSIDE IT, named so the scope is a decision and not an
   oversight:

     · `UndoEntry` — operational state, not history. The undo itself writes an
       ActivityLog row (trigger `undo`), which IS here; the snapshot row is the
       machinery that made it possible and says nothing further about the lead.
     · `Notification` — a message to a PERSON, derived from an action that is
       already logged. Including it would print the same event twice, once as
       the thing that happened and once as somebody being told about it.
     · THE WHATSAPP MARK COLUMNS (`whatsappSentAt` / `ById` / `ByLabel`). Every
       press writes its own history row (ADR-069), so an entry built from the
       columns would duplicate the first of them. The mark rides the lead HEADER
       instead, where it belongs: it is current state, not an event.
     · `MeetingAttendee` as its own entry — it is folded into its meeting, which
       is the only place the roster means anything.
     · PROSPECT CARDS (`PartnerProspect`). His word was "lead", and the partner/
       agent funnel has its own stages and its own groups. Flagged for him in
       PROGRESS rather than decided here.
   ========================================================================== */

/** The log's own version, so a file can be read without guessing which build
    wrote it. Deliberately SEPARATE from BACKUP_VERSION, which gates whether a
    file can be RESTORED — see the note on that constant. */
export const LEAD_LOG_VERSION = 1;

/** Which record an entry is really about. A lead's log reaches past the lead
    itself into the deal that came out of it, and a reader must be able to tell. */
export type LogSubject = "lead" | "won_deal" | "client" | "statement" | "milestone";

export interface LeadLogEntry {
  /** the stored UTC instant, ISO-8601 — the machine-readable answer to "when" */
  at: string;
  /** the same instant on the Cairo wall clock, 12-hour (ADR-068) */
  atCairo: string;
  /** what KIND of thing this is — see WHAT A LEAD'S LOG CONTAINS above */
  kind: string;
  /** which record it happened to */
  about: LogSubject;
  /** one line of English, in the product's own words */
  what: string;
  /** the stored actor label, or null where this schema records none */
  by: string | null;
  byUserId: string | null;
  /** the id of the source row, so an entry can be traced back into `tables` */
  recordId: string;
  /** the row's own fields, as stored. Money is in PIASTERS and every such key
      says so in its name, because a human reading this file has no schema. */
  details: Record<string, unknown>;
}

export interface LeadLog {
  leadId: string;
  name: string;
  companyName: string | null;
  brand: string;
  stage: string;
  ownerType: string;
  archived: boolean;
  archivedAt: string | null;
  createdAt: string;
  createdAtCairo: string;
  /** current state, not an event (ADR-069) — null when nobody has messaged them */
  whatsappSentAt: string | null;
  whatsappSentBy: string | null;
  /** OLDEST FIRST, so the file reads as a story */
  entries: LeadLogEntry[];
}

/* ------------------------------------------------------------------ plumbing */

type Row = Record<string, unknown>;

function rowsOf(tables: Record<string, Row[]>, model: string): Row[] {
  return tables[model] ?? [];
}

const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
const bool = (v: unknown): boolean => v === true;
const num = (v: unknown): number | null => (typeof v === "number" ? v : null);

/** Whatever `findMany()` put in a DateTime column, as a Date — or null.
    `exportBackup` hands us live Prisma objects (real Dates); a payload that has
    been through JSON.stringify carries ISO strings. Both are read, so this
    module works on a file as well as on a fresh export. */
function asDate(v: unknown): Date | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === "string") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

const iso = (v: unknown): string | null => asDate(v)?.toISOString() ?? null;

/** ONE pass, never one filter per lead — see property 2. Rows whose key is
    absent or unresolvable are dropped: an ActivityLog row has no FK, so its
    `entityId` can name a lead that no longer exists, and that lead has no log
    to appear in. */
function groupBy(rows: Row[], key: (row: Row) => string | null | undefined): Map<string, Row[]> {
  const out = new Map<string, Row[]>();
  for (const row of rows) {
    const k = key(row);
    if (!k) continue;
    const list = out.get(k);
    if (list) list.push(row);
    else out.set(k, [row]);
  }
  return out;
}

/* ---------------------------------------------------------------- the builder */

/** Build the derived per-lead log from tables ALREADY IN MEMORY.

    Pure: it reads the arrays it is handed and touches no database, which is
    what lets the export add it for free and lets the suite build a log from a
    fixture without a round-trip. */
export function buildLeadLogs(tables: Record<string, Row[]>): LeadLog[] {
  const leads = rowsOf(tables, "lead");
  if (leads.length === 0) return [];

  /* --- who is who, for the labels this schema leaves as bare FKs --- */
  const userName = new Map<string, string>();
  for (const u of rowsOf(tables, "user")) {
    const id = str(u.id);
    if (id) userName.set(id, str(u.name) ?? id);
  }

  /* --- the deal chain: which records belong to which lead --- */
  const wonDealLead = new Map<string, string>(); // wonDealId -> leadId
  for (const d of rowsOf(tables, "wonDeal")) {
    const id = str(d.id);
    const leadId = str(d.leadId);
    if (id && leadId) wonDealLead.set(id, leadId);
  }
  const milestoneLead = new Map<string, string>(); // milestoneId -> leadId
  for (const m of rowsOf(tables, "milestone")) {
    const id = str(m.id);
    if (!id) continue;
    const leadId = wonDealLead.get(str(m.wonDealId) ?? "");
    if (leadId) milestoneLead.set(id, leadId);
  }
  const statementLead = new Map<string, string>(); // statementId -> leadId
  for (const s of rowsOf(tables, "statement")) {
    const id = str(s.id);
    if (!id) continue;
    const leadId = milestoneLead.get(str(s.milestoneId) ?? "");
    if (leadId) statementLead.set(id, leadId);
  }
  const clientLead = new Map<string, string>();
  for (const c of rowsOf(tables, "client")) {
    const id = str(c.id);
    const leadId = str(c.leadId);
    if (id && leadId) clientLead.set(id, leadId);
  }

  /* --- the To-Do marks, keyed to a RECORD (ADR-062) — resolve to the lead --- */
  const followUpLead = new Map<string, string>();
  for (const f of rowsOf(tables, "followUp")) {
    const id = str(f.id);
    const leadId = str(f.leadId);
    if (id && leadId) followUpLead.set(id, leadId);
  }
  const meetingLead = new Map<string, string>();
  for (const m of rowsOf(tables, "meeting")) {
    const id = str(m.id);
    const leadId = str(m.leadId);
    if (id && leadId) meetingLead.set(id, leadId);
  }

  /* --- whose time each meeting blocks (ADR-071) --- */
  const meetingAttendees = groupBy(rowsOf(tables, "meetingAttendee"), (r) => str(r.meetingId));

  /* --- every source, bucketed by lead in one pass --- */
  const history = groupBy(rowsOf(tables, "activityLog"), (r) => {
    const type = str(r.entityType);
    const id = str(r.entityId);
    if (!id) return null;
    if (type === "lead") return id;
    if (type === "won_deal") return wonDealLead.get(id) ?? null;
    if (type === "client") return clientLead.get(id) ?? null;
    if (type === "statement") return statementLead.get(id) ?? null;
    return null; // partner, portal_rep, partner_prospect, user — not a lead's log
  });
  const historySubject = (type: string | null): LogSubject =>
    type === "won_deal" || type === "client" || type === "statement" ? type : "lead";

  const comments = groupBy(rowsOf(tables, "leadComment"), (r) => str(r.leadId));
  const followUps = groupBy(rowsOf(tables, "followUp"), (r) => str(r.leadId));
  const meetings = groupBy(rowsOf(tables, "meeting"), (r) => str(r.leadId));
  const proposals = groupBy(rowsOf(tables, "proposal"), (r) => str(r.leadId));
  const lostInfos = groupBy(rowsOf(tables, "lostInfo"), (r) => str(r.leadId));
  const postponeInfos = groupBy(rowsOf(tables, "postponeInfo"), (r) => str(r.leadId));
  const negotiationNotes = groupBy(rowsOf(tables, "negotiationNote"), (r) => str(r.leadId));
  const wonInfos = groupBy(rowsOf(tables, "wonInfo"), (r) => str(r.leadId));
  const wonDeals = groupBy(rowsOf(tables, "wonDeal"), (r) => str(r.leadId));
  const milestones = groupBy(rowsOf(tables, "milestone"), (r) =>
    wonDealLead.get(str(r.wonDealId) ?? ""),
  );
  const statements = groupBy(rowsOf(tables, "statement"), (r) =>
    milestoneLead.get(str(r.milestoneId) ?? ""),
  );
  const todoDones = groupBy(
    rowsOf(tables, "todoDone"),
    (r) =>
      followUpLead.get(str(r.followUpId) ?? "") ??
      meetingLead.get(str(r.meetingId) ?? "") ??
      statementLead.get(str(r.statementId) ?? "") ??
      milestoneLead.get(str(r.milestoneId) ?? ""),
  );
  const attachments = groupBy(
    rowsOf(tables, "attachment"),
    (r) =>
      wonDealLead.get(str(r.wonDealId) ?? "") ?? statementLead.get(str(r.statementId) ?? ""),
  );

  return leads.map((lead) => {
    const leadId = str(lead.id) ?? "";
    const push: LeadLogEntry[] = [];

    const add = (
      at: unknown,
      kind: string,
      about: LogSubject,
      what: string,
      recordId: string,
      details: Record<string, unknown>,
      by: string | null = null,
      byUserId: string | null = null,
    ) => {
      const instant = asDate(at);
      if (!instant) return; // an event with no instant cannot answer "when"
      push.push({
        at: instant.toISOString(),
        atCairo: formatCairo(instant, "en"),
        kind,
        about,
        what,
        by,
        byUserId,
        recordId,
        details,
      });
    };

    /* 1 — the lead's and its deal's HISTORY, in the product's own words */
    for (const row of history.get(leadId) ?? []) {
      const about = historySubject(str(row.entityType));
      const what = interactionPhrase("en", {
        action: str(row.action) ?? "",
        trigger: str(row.trigger) ?? "",
        fromStage: str(row.fromStage),
        toStage: str(row.toStage),
      });
      add(
        row.createdAt,
        "history",
        about,
        what,
        str(row.id) ?? "",
        {
          action: str(row.action),
          trigger: str(row.trigger),
          fromStage: str(row.fromStage),
          toStage: str(row.toStage),
          entityType: str(row.entityType),
          entityId: str(row.entityId),
        },
        str(row.actorLabel),
        str(row.actorId),
      );
    }

    /* 2 — the chat */
    for (const row of comments.get(leadId) ?? []) {
      add(
        row.createdAt,
        "comment",
        "lead",
        "Commented",
        str(row.id) ?? "",
        { body: str(row.body), mentions: str(row.mentions) },
        str(row.authorLabel),
        str(row.authorUserId),
      );
    }

    /* 3 — the field groups. Logged at the instant the ROW was written; the
       record's own dated subject (a due date, a meeting slot) rides `details`
       with its own reading, because "when was this logged" and "when is it
       for" are two questions and the file answers both. */
    for (const row of followUps.get(leadId) ?? []) {
      const due = asDate(row.dueAt);
      const timeChosen = bool(row.dueTimeSet);
      add(row.createdAt, "follow_up", "lead", "Follow-up logged", str(row.id) ?? "", {
        context: str(row.context),
        method: str(row.method),
        followingUpAbout: str(row.followingUpWith),
        dueAt: due?.toISOString() ?? null,
        /* ADR-063 — a follow-up left date-only reads date-only. Printing 9 AM
           on it would hand it a clock nobody chose. */
        dueAtCairo: due ? (timeChosen ? formatCairo(due, "en") : formatCairoDate(due, "en")) : null,
        dueTimeChosen: timeChosen,
      });
    }

    for (const row of meetings.get(leadId) ?? []) {
      const slot = asDate(row.datetime);
      const roster = (meetingAttendees.get(str(row.id) ?? "") ?? []).map((a) => {
        const uid = str(a.userId) ?? "";
        return { userId: uid, name: userName.get(uid) ?? null };
      });
      add(row.createdAt, "meeting", "lead", "Meeting recorded", str(row.id) ?? "", {
        arranged: bool(row.arranged),
        datetime: slot?.toISOString() ?? null,
        datetimeCairo: slot ? formatCairo(slot, "en") : null,
        mode: str(row.mode),
        withAttendees: str(row.withAttendees),
        technicalSupport: str(row.technicalSupport),
        needsTechnical: row.needsTechnical ?? null,
        outcome: str(row.outcome),
        outcomeDestination: str(row.outcomeDestination),
        /* ADR-071 — the ACCOUNTS whose calendars this meeting occupies */
        alsoBlocks: roster,
      });
    }

    for (const row of proposals.get(leadId) ?? []) {
      const sentAt = asDate(row.sentAt);
      add(row.createdAt, "proposal", "lead", "Proposal recorded", str(row.id) ?? "", {
        service: str(row.service),
        estimatedValuePiasters: num(row.estimatedValue),
        sent: bool(row.sent),
        sentAt: sentAt?.toISOString() ?? null,
        sentAtCairo: sentAt ? formatCairo(sentAt, "en") : null,
      });
    }

    for (const row of lostInfos.get(leadId) ?? []) {
      add(row.createdAt, "lost", "lead", "Marked lost", str(row.id) ?? "", {
        reason: str(row.reason),
      });
    }

    for (const row of postponeInfos.get(leadId) ?? []) {
      add(row.createdAt, "postponed", "lead", "Postponed", str(row.id) ?? "", {
        reason: str(row.reason),
        note: str(row.note),
      });
    }

    for (const row of negotiationNotes.get(leadId) ?? []) {
      add(row.createdAt, "negotiation_note", "lead", "Negotiation note", str(row.id) ?? "", {
        note: str(row.note),
      });
    }

    for (const row of wonInfos.get(leadId) ?? []) {
      add(row.createdAt, "won", "lead", "Won figures recorded", str(row.id) ?? "", {
        estimatedValuePiasters: num(row.estimatedValue),
        collectedAmountPiasters: num(row.collectedAmount),
        technicalOwner: str(row.technicalOwner),
      });
    }

    /* 4 — the deal, and the money work that follows it.

       THE MILESTONE PLAN RIDES THE DEAL rather than becoming entries of its
       own, because `Milestone` HAS NO `createdAt` in this schema: the only
       instant it owns is `completedAt`. Anchoring a "milestone created" entry
       to the deal's instant would be asserting a time the database does not
       record — the one thing an audit artefact must not do — so the plan is
       stated where its instant genuinely belongs (the deal was created with
       it) and a COMPLETION, which has a real instant, is its own dated event. */
    for (const row of wonDeals.get(leadId) ?? []) {
      const contract = asDate(row.contractDate);
      const plan = (milestones.get(leadId) ?? [])
        .filter((m) => str(m.wonDealId) === str(row.id))
        .map((m) => ({
          milestoneId: str(m.id),
          index: num(m.index),
          label: str(m.label),
          valuePiasters: num(m.value),
          commissionValuePiasters: num(m.commissionValue),
          expectedStart: iso(m.expectedStart),
          expectedEnd: iso(m.expectedEnd),
          completed: bool(m.completed),
        }))
        .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
      add(row.createdAt, "won_deal", "won_deal", "Deal created", str(row.id) ?? "", {
        contractDate: contract?.toISOString() ?? null,
        contractDateCairo: contract ? formatCairoDate(contract, "en") : null,
        estimatedValuePiasters: num(row.estimatedValue),
        totalCommissionPercentBp: num(row.totalCommissionPercent),
        milestones: plan,
      });
    }

    for (const row of milestones.get(leadId) ?? []) {
      add(
        row.completedAt,
        "milestone_completed",
        "milestone",
        "Milestone completed",
        str(row.id) ?? "",
        {
          index: num(row.index),
          label: str(row.label),
          valuePiasters: num(row.value),
          commissionValuePiasters: num(row.commissionValue),
        },
      );
    }

    for (const row of statements.get(leadId) ?? []) {
      const id = str(row.id) ?? "";
      const expected = asDate(row.expectedDate);
      add(
        row.createdAt,
        "statement",
        "statement",
        "Statement raised",
        id,
        {
          code: str(row.code),
          milestoneLabel: str(row.milestoneLabel),
          clientName: str(row.clientName),
          status: str(row.status),
          milestoneValuePiasters: num(row.milestoneValue),
          percentBp: num(row.percentBp),
          amountPiasters: num(row.amount),
          adjustmentsPiasters: num(row.adjustments),
          expectedDate: expected?.toISOString() ?? null,
          expectedDateCairo: expected ? formatCairoDate(expected, "en") : null,
        },
        str(row.closerLabel),
        str(row.closerUserId),
      );
      add(
        row.paidAt,
        "statement_paid",
        "statement",
        "Statement paid",
        id,
        { code: str(row.code), milestoneLabel: str(row.milestoneLabel) },
        str(row.closerLabel),
        str(row.closerUserId),
      );
    }

    /* 5 — the ticked To-Do tasks (ADR-062), with who ticked them */
    for (const row of todoDones.get(leadId) ?? []) {
      const dueAt = asDate(row.dueAt);
      add(
        row.completedAt,
        "task_done",
        "lead",
        "To-Do task ticked done",
        str(row.id) ?? "",
        {
          followUpId: str(row.followUpId),
          meetingId: str(row.meetingId),
          statementId: str(row.statementId),
          milestoneId: str(row.milestoneId),
          taskDueAt: dueAt?.toISOString() ?? null,
          taskDueAtCairo: dueAt ? formatCairo(dueAt, "en") : null,
        },
        str(row.completedByLabel),
        str(row.completedById),
      );
    }

    /* 6 — the files: the contract and the payment proofs */
    for (const row of attachments.get(leadId) ?? []) {
      add(row.createdAt, "attachment", "lead", "File attached", str(row.id) ?? "", {
        kind: str(row.kind),
        filename: str(row.filename),
        storageKey: str(row.storageKey),
        mime: str(row.mime),
        sizeBytes: num(row.size),
      });
    }

    /* OLDEST FIRST. Ties are broken by kind then by record id so the file is
       BYTE-DETERMINISTIC: two events can share an instant (a stage move and
       the group row written in the same transaction always do), and an export
       whose order wobbled between runs could not be diffed against itself. */
    push.sort(
      (a, b) =>
        a.at.localeCompare(b.at) ||
        a.kind.localeCompare(b.kind) ||
        a.recordId.localeCompare(b.recordId),
    );

    const created = asDate(lead.createdAt);
    const whatsapp = asDate(lead.whatsappSentAt);
    return {
      leadId,
      name: str(lead.name) ?? "",
      companyName: str(lead.companyName),
      brand: str(lead.brand) ?? "",
      stage: str(lead.stage) ?? "",
      ownerType: str(lead.ownerType) ?? "",
      archived: bool(lead.archived),
      archivedAt: iso(lead.archivedAt),
      createdAt: created?.toISOString() ?? "",
      createdAtCairo: created ? formatCairo(created, "en") : "",
      whatsappSentAt: whatsapp?.toISOString() ?? null,
      whatsappSentBy: str(lead.whatsappSentByLabel),
      entries: push,
    };
  });
}
