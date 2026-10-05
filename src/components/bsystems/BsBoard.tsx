"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import type { Brand } from "@/lib/pipeline-engine/constants";
import { configForBrand } from "@/lib/pipeline-engine/configs/for-brand";
import { requiredGroupForTarget } from "@/lib/pipeline-engine/transition";
import {
  FALLEN_BEHIND_COLUMN,
  followUpDateOfDrop,
  landingColumn,
  boardColumns,
  columnFor,
} from "@/lib/crm/fallen-behind";
import { btnGhost, btnPrimary } from "@/components/portal/groupForms";
import { formatMsg, tFor } from "@/lib/i18n/core";
import { useLocale } from "@/components/shared/LocaleProvider";
import { stageLabel } from "@/lib/i18n/dict/labels";
import { board as msg, common } from "@/lib/i18n/dict/crm";
import { callSheet } from "@/lib/i18n/dict/call";
import { CardGrip, useMouseOnlyListeners, type CardDrag } from "@/components/shared/CardGrip";
import { TodayChip, useTodayFilter } from "@/components/shared/TodayChip";
import { useCairoToday } from "@/components/shared/useCairoToday";
import { NoAnswerBadge } from "@/components/shared/NoAnswerBadge";
import { WhatsappChip } from "@/components/shared/WhatsappChip";
import { stageKey } from "./stageColors";
import {
  GroupFieldsV2,
  buildGroupPayload,
  isLight,
  useGroupFormState,
  type BsFormRole,
} from "./roleForms";

/* V2 §2.3/§3 — THE B-Systems board, prototype treatment (spec §2.7): tinted
   wells with accent bars, mono column titles, count pills, lift-on-drag cards.
   A drop opens the stage's role-aware form (modal §2.10); cancel reverts. Won
   is admin/sales-only; "Ready to close" flags any active card. */

export interface BsBoardLead {
  id: string;
  name: string;
  companyName: string | null;
  stage: string;
  ownerType: string;
  ownerLabel: string;
  readyToClose: boolean;
  noAnswer: boolean;
  /** ADR-064 — how many times we tried; 0 = no marker. `noAnswer` above stays
      the is-flagged truth (count > 0) for every existing reader. */
  noAnswerCount: number;
  keyDatum: string;
  /** wa.me link, precomputed server-side (null when no confident country code) */
  waHref: string | null;
  /** ADR-069 — "WhatsApp sent by Omar on 3 Sep 2026", built server-side (the
      one clock lives in lib/datetime); null = nobody has messaged them yet */
  waSentLabel: string | null;
  /** ADR-069 — where a press records the mark */
  waMarkUrl: string;
  /** ISO instant of the latest follow-up's dueAt — set only on Following Up
      cards; feeds the column's Today chip (ADR-061) */
  followUpDueAt: string | null;
  /** ISO instant of the meeting this card SHOWS — set only on Meeting Setting
      cards; the column is SORTED by it server-side and its Today chip filters
      on it (ADR-064). Null = no datetime yet, which sorts last. */
  meetingAt: string | null;
}

/* the two instants a column can filter "today" on — module-level so the memo in
   useTodayFilter sees a stable accessor (ADR-064) */
const FOLLOW_UP_AT = (lead: BsBoardLead) => lead.followUpDueAt;
const MEETING_AT = (lead: BsBoardLead) => lead.meetingAt;

/* The card's CONTENT — shared verbatim by the in-column draggable and the
   DragOverlay clone. Founder: columns cap their height and scroll inside now,
   so the dragged visual must ride an overlay — a transformed card inside a
   scrolling, clipping column would vanish under its neighbours. */
function LeadCardBody({
  lead,
  drag,
  apiBase,
  leadPathBase,
  leadQuery,
}: {
  lead: BsBoardLead;
  drag?: CardDrag;
  /** ADR-074 — this surface's API namespace and lead address (see BsBoard). */
  apiBase: string;
  leadPathBase: string;
  /* ADR-073 — `?company=…`. The lead DETAIL is a shared address now (B-Systems
     and Mindoo both use it), so a link that drops the company falls back to the
     account's DEFAULT company and 404s a lead that plainly exists. ByteForce
     never exposed this because its leads live on a different route. */
  leadQuery: string;
}) {
  const locale = useLocale();
  const t = tFor(locale);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <>
      {/* founder (phone): the card scrolls, THIS drags. Lives in the body so
          the DragOverlay clone is identical to the card it stands in for. */}
      <CardGrip drag={drag} label={t(common.dragHandle)} />
      {lead.readyToClose ? <span className="bcard-badge">{t(common.readyToClose)}</span> : null}
      <div className="bcard-name-row">
        <Link
          href={`${leadPathBase}/${lead.id}${leadQuery}`}
          className="bcard-name"
          onClick={(e) => e.stopPropagation()}
        >
          {lead.name}
        </Link>
        {lead.companyName ? <span className="bcard-rep">{lead.companyName}</span> : null}
      </div>
      <div className="bcard-chips">
        <span className="owner-chip" data-owner-key={lead.ownerType}>
          {lead.ownerLabel}
        </span>
        <NoAnswerBadge locale={locale} count={lead.noAnswerCount} />
        <Link
          href={`${leadPathBase}/${lead.id}/call${leadQuery}`}
          className="card-dial"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {t(callSheet.navLabel)}
        </Link>
        {/* founder: "message on WhatsApp" beside every Call — a new tab, same
            guards so it neither drags nor opens the lead */}
        {/* ADR-069 — and it goes GREEN once anyone has messaged this lead */}
        {lead.waHref ? (
          <WhatsappChip
            href={lead.waHref}
            markUrl={lead.waMarkUrl}
            sentLabel={lead.waSentLabel}
            justSentLabel={t(callSheet.whatsappSentJustNow)}
            restLabel={t(callSheet.whatsapp)}
            className="card-dial"
            cardGuards
          >
            {t(callSheet.whatsapp)}
          </WhatsappChip>
        ) : null}
      </div>
      {lead.keyDatum || (lead.stage !== "won" && lead.stage !== "lost") ? (

        <div className="bcard-meta">
          <span className="bcard-meta-dot" aria-hidden />
          <span className="min-w-0">
            {lead.keyDatum}
            {!lead.readyToClose && lead.stage !== "won" && lead.stage !== "lost" ? (
              <button
                type="button"
                disabled={busy}
                onClick={async (e) => {
                  e.stopPropagation();
                  setBusy(true);
                  await fetch(`${apiBase}/leads/${lead.id}/ready`, { method: "POST" });
                  setBusy(false);
                  router.refresh();
                }}
                onPointerDown={(e) => e.stopPropagation()}
                className="underline underline-offset-2 ms-1 disabled:opacity-50"
              >
                {t(common.markReadyToClose)}
              </button>
            ) : null}
            {lead.stage !== "won" && lead.stage !== "lost" ? (
              /* founder (ADR-039): "didn't answer" — a marker "just so we
                 know"; never a stage move. Same click guards as the RTC button
                 so it neither drags nor opens the lead.
                 founder (ADR-064): it is a COUNTER, so "Didn't answer" is
                 always offered — every press is one more try — and the
                 Answered button appears beside it once there is a tally to
                 clear. It used to be one button that flipped, which made a
                 second attempt unrecordable. */
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={async (e) => {
                    e.stopPropagation();
                    setBusy(true);
                    await fetch(`${apiBase}/leads/${lead.id}/no-answer`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ value: true }),
                    });
                    setBusy(false);
                    router.refresh();
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="underline underline-offset-2 ms-1 disabled:opacity-50"
                >
                  {t(common.markNoAnswer)}
                </button>
                {lead.noAnswerCount > 0 ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={async (e) => {
                      e.stopPropagation();
                      setBusy(true);
                      await fetch(`${apiBase}/leads/${lead.id}/no-answer`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ value: false }),
                      });
                      setBusy(false);
                      router.refresh();
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="underline underline-offset-2 ms-1 disabled:opacity-50"
                  >
                    {t(common.clearNoAnswer)}
                  </button>
                ) : null}
              </>
            ) : null}
          </span>
        </div>
      ) : null}
    </>
  );
}

function LeadCard({
  lead,
  dragging,
  suppressClickRef,
  apiBase,
  leadPathBase,
  leadQuery,
}: {
  lead: BsBoardLead;
  dragging: boolean;
  suppressClickRef: { current: boolean };
  apiBase: string;
  leadPathBase: string;
  leadQuery: string;
}) {
  const router = useRouter();
  const { attributes, listeners, setActivatorNodeRef, setNodeRef, isDragging } = useDraggable({
    id: lead.id,
  });
  /* a MOUSE still drags the whole card; a finger scrolls it and drags by the
     grip instead (see components/shared/CardGrip) */
  const mouseDrag = useMouseOnlyListeners(listeners);
  return (
    <div
      ref={setNodeRef}
      {...mouseDrag}
      data-deal-card={lead.name}
      data-stage-key={stageKey(lead.stage)}
      onClick={() => {
        /* founder: the whole card opens the lead — but never right after a
           drag (the browser fires a click on drop; the guard swallows it) */
        if (suppressClickRef.current) return;
        router.push(`${leadPathBase}/${lead.id}${leadQuery}`);
      }}
      className={`bcard ${isDragging || dragging ? "bcard--ghost" : ""}`}
    >
      <LeadCardBody
        lead={lead}
        drag={{ attributes, listeners, setActivatorNodeRef }}
        apiBase={apiBase}
        leadPathBase={leadPathBase}
        leadQuery={leadQuery}
      />
    </div>
  );
}

function Column({
  stage,
  meetingStage,
  followUpStage,
  apiBase,
  leadPathBase,
  leadQuery,
  leads,
  wonBlocked,
  draggingId,
  suppressClickRef,
  landedHere,
  dayKnown,
}: {
  /** a COLUMN id: every pipeline stage, plus ADR-082's derived
      `fallen_behind`, which is not a stage and is not a drop target */
  stage: string;
  /* ADR-073 — passed in rather than read from a module-level config: the Today
     chip hangs off the MEETING column, and which stage that is belongs to the
     pipeline the board is drawing. */
  meetingStage: string;
  /** ADR-082 — same reasoning as `meetingStage`: which stage the Today chip and
      the derived split belong to is a property of the pipeline being drawn. */
  followUpStage: string | null;
  apiBase: string;
  leadPathBase: string;
  /** ADR-073/074 — the query string carried onto every card's link:
      "?company=bsystems" under the merged shell, EMPTY under Mindoo. */
  leadQuery: string;
  leads: BsBoardLead[];
  wonBlocked: boolean;
  draggingId: string | null;
  suppressClickRef: { current: boolean };
  /** drops this column has accepted this mount — bump releases its Today chip */
  landedHere: number;
  /** ADR-082 (review) — has the Cairo day landed yet? Until it has, the derived
      column is empty because the split has not run, and must say nothing. */
  dayKnown: boolean;
}) {
  const locale = useLocale();
  const t = tFor(locale);
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  /* ADR-082 — "Fallen behind" is CLOSED to drops for a different reason than
     Won: Won is a permission wall, this is a DATE CONDITION with no destination
     to be. Same treatment on screen, because "you cannot drop here" is the same
     message, and `blocked` is deliberately the one flag so the two can never
     drift apart visually. */
  const closed = stage === FALLEN_BEHIND_COLUMN;
  const blocked = closed || (wonBlocked && stage === "won");
  const overCls = isOver ? (blocked ? "col--over-blocked" : "col--over-valid") : "";
  /* founder (ADR-061 + ADR-064): the Today chip — on Following Up, and now on
     Meeting Setting too. Client-side over the already-loaded cards, default
     OFF. "Today" is the CAIRO calendar day, never the viewer's local one; the
     day is sampled post-mount / on press, never at render (see useTodayFilter).
     The droppable stays the whole column, so a filtered column still accepts
     drops. Each column filters on its OWN instant, and says so when the filter
     empties it. */
  /* ADR-082 — the chip STAYS on Following Up and does NOT go on Fallen behind.
     On Following Up it still means what it meant, only narrower: the column is
     already today-or-later, so the chip separates TODAY from LATER — exactly
     the "just see today's follow ups" of ADR-061 (it used to also hide overdue
     cards, which are simply not in this column any more). On Fallen behind a
     Today filter could only ever count 0 and empty the column, because every
     card there is overdue by definition: a control that can only lie. */
  const isFollowUpCol = followUpStage !== null && stage === followUpStage;
  const isMeetingCol = stage === meetingStage;
  const { todayOnly, toggle, todayCount, visible } = useTodayFilter(
    leads,
    isMeetingCol ? MEETING_AT : isFollowUpCol ? FOLLOW_UP_AT : null,
    landedHere,
  );
  /* ADR-082 — `data-column` goes on EVERY column; `data-stage` only on the real
     pipeline stages. The derived Fallen behind column is not a stage, and an
     attribute saying it was would be a lie the suite reads: `.board
     [data-stage]` counts this pipeline's columns and must keep counting them.
     Every selector that wants "the column" uses `data-column`. */
  /* ADR-082 (review) — ONE expression for the empty line, and it may be
     NOTHING. On the first paint the Cairo day is not known yet, so every card
     still sits in its stage column and this one is empty for a beat — printing
     "Nothing has fallen behind" over a 0 count while overdue cards render next
     door is a one-beat affirmative falsehood, which is worse than a blank. The
     line appears the moment the day lands. */
  const emptyNote =
    isOver && blocked
      ? t(msg.blocked)
      : todayOnly && leads.length > 0
        ? t(isMeetingCol ? msg.noTodayMeetings : msg.noTodayFollowUps)
        : closed
          ? /* an empty Fallen behind column is GOOD NEWS — say so rather than
               "Nothing here yet", which reads as a gap. But only once the day
               is known: before that, the column is empty because the split has
               not run, not because he is on top of everything. */
            dayKnown
            ? t(msg.nothingFallenBehind)
            : null
          : t(msg.emptyColumn);
  const hasChip = isFollowUpCol || isMeetingCol;
  return (
    <div
      ref={setNodeRef}
      data-column={stage}
      data-stage={closed ? undefined : stage}
      data-stage-key={stageKey(stage)}
      className={`col ${overCls}`}
    >
      <div className="col-bar" aria-hidden />
      <div className="col-head">
        <span className="col-title">{stageLabel(locale, stage)}</span>
        <span className="flex items-center gap-1.5">
          {hasChip ? <TodayChip count={todayCount} pressed={todayOnly} onToggle={toggle} /> : null}
          <span className="count-pill">{visible.length}</span>
        </span>
      </div>
      {blocked ? (
        <p className="col-locked-note">
          {t(closed ? msg.dateOnlyColumn : msg.adminOnlyColumn)}
        </p>
      ) : null}
      <div className="col-cards">
        {visible.map((l) => (
          <LeadCard
            key={l.id}
            lead={l}
            apiBase={apiBase}
            leadPathBase={leadPathBase}
            leadQuery={leadQuery}
            dragging={draggingId === l.id}
            suppressClickRef={suppressClickRef}
          />
        ))}
        {visible.length === 0 && emptyNote !== null ? (
          /* review: while the Today chip is pressed and cards are merely
             HIDDEN, "Nothing here yet" would lie — say what the filter found */
          <div className="col-empty">{emptyNote}</div>
        ) : null}
      </div>
    </div>
  );
}

export function BsBoard({
  leads,
  role,
  reps,
  company,
  apiBase,
  leadPathBase,
  leadQuery,
  people = [],
}: {
  leads: BsBoardLead[];
  role: BsFormRole;
  reps: Array<{ id: string; name: string }>;
  /* ADR-073 — WHICH pipeline this board is drawing. It used to import
     `bsystemsCrmConfig` directly, which was true while this board served one
     company. Mindoo runs the same SHAPE of pipeline under a different role gate
     (its staff closes its own deals), so a hardcoded config would have drawn
     Mindoo's board with B-Systems' rules and offered its staff no way to win.
     REQUIRED, deliberately: an optional prop defaulting to B-Systems would let
     a new call site inherit the wrong pipeline silently, which is the whole
     failure this prop exists to prevent. */
  company: Brand;
  /* ADR-074 — apiBase + leadPathBase, threaded from the SURFACE.

     These were literals (`/api/b-systems`, `/b-systems/crm/lead`) and that was
     true while this board served one company. ADR-073 gave Mindoo the same
     board under `?company=mindoo` and left the literals alone, so every WRITE
     from a Mindoo card — the drop, "Mark ready to close", the didn't-answer
     counter — was posted to B-Systems' namespace and refused by the brand wall
     the moment it arrived: the board LOOKED complete and could not be used.
     ADR-074 gives Mindoo its own address, and the seam is here. Required
     props, so a new call site must answer rather than inherit a company. */
  apiBase: string;
  leadPathBase: string;
  /** the query string every card link carries — "?company=bsystems" under the
      merged shell, EMPTY under Mindoo, which has no company parameter. */
  leadQuery: string;
  /** ADR-071 — the company roster, threaded to the meeting form's "Also
      blocks" picker. Optional: a caller that omits it simply does not offer
      the field, which is what every screen did before the calendar existed. */
  people?: Array<{ id: string; name: string }>;
}) {
  const config = configForBrand(company);
  const locale = useLocale();
  const t = tFor(locale);
  const router = useRouter();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [pendingDrop, setPendingDrop] = useState<{ leadId: string; to: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  /* set on every drag end, cleared a beat later: the click the browser fires
     on drop must not navigate (whole-card onClick checks this ref) */
  const suppressClickRef = useRef(false);
  const formState = useGroupFormState();

  const canWin = role === "admin" || role === "sales";

  /* Review — which column last accepted a drop, and how many drops it has
     taken this mount. A column whose Today chip is pressed lets go when a card
     lands in it, so the rep never drags a card in and watches it vanish behind
     the filter (see useTodayFilter). Counted rather than flagged so two drops
     into the same column are two distinct signals. */
  const [landed, setLanded] = useState<{ stage: string; n: number }>({ stage: "", n: 0 });

  /* ADR-082 — TODAY'S CAIRO DAY, from the one hook that owns it (useCairoToday,
     shared with the ByteForce board and the Today chip): never read at render,
     because this board is SSR'd and a render-time clock can hydration-mismatch.
     Until it lands, every card sits in its stage column — the pre-split picture
     for one beat, which is honestly "not known yet" rather than a guess, and
     the derived column stays SILENT while it is (see Column).

     Review — the hook RE-SAMPLES at the next Cairo midnight and when the tab
     comes back. The previous `useEffect(…, [])` sampled once per MOUNT, and
     `router.refresh()` re-renders without remounting: a tab left open overnight
     kept yesterday's division while the server had already moved on. */
  const today = useCairoToday();
  const columnOf = (lead: BsBoardLead) =>
    today ? columnFor(lead, config.followUpStage, today) : lead.stage;

  async function commitDrop(
    body: unknown,
    leadId: string,
    to: string,
    surface: "modal" | "toast" = "modal",
  ) {
    setBusy(true);
    setError(null);
    const res = await fetch(`${apiBase}/leads/${leadId}/event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      const text = data?.error ?? t(common.somethingWentWrong);
      /* hardening (review): the formless drag-to-New path has no modal — a
         failure there must reach the board toast, not a hidden error state */
      if (surface === "toast") setMessage(text);
      else setError(text);
      return;
    }
    setPendingDrop(null);
    /* ADR-082 (review) — the column the card ACTUALLY went to, which is not
       always the stage it was dropped on: a backdated follow-up lands in Fallen
       behind. `landed` releases the Today chip of the column that accepted the
       card, so it has to name the right one — and a move he cannot see has to
       be said out loud, because the column it landed in refuses drops and would
       otherwise read as the feature being broken. */
    const column = landingColumn(to, followUpDateOfDrop(body), config.followUpStage, today);
    setLanded((p) => ({ stage: column, n: p.stage === column ? p.n + 1 : 1 }));
    if (column !== to) {
      const name = leads.find((l) => l.id === leadId)?.name ?? "";
      setMessage(t(formatMsg(msg.landedFallenBehind, { name })));
    }
    router.refresh();
  }

  function onDragStart(event: DragStartEvent) {
    setDraggingId(String(event.active.id));
  }

  function onDragEnd(event: DragEndEvent) {
    suppressClickRef.current = true;
    setTimeout(() => {
      suppressClickRef.current = false;
    }, 150);
    setDraggingId(null);
    setMessage(null);
    const leadId = String(event.active.id);
    const to = event.over ? String(event.over.id) : null;
    if (!to) return;
    const lead = leads.find((l) => l.id === leadId);
    if (!lead) return;
    /* ADR-082 — nothing can be dropped INTO Fallen behind: it is a date
       condition, not a destination. Checked before the stage comparison,
       because the column is not a stage and `lead.stage === to` cannot catch
       it. A card is dragged OUT of it exactly as it would be out of Following
       Up — its stage IS following_up, so there is no second path below. */
    if (to === FALLEN_BEHIND_COLUMN) {
      setMessage(t(msg.cannotDropFallenBehind));
      return;
    }
    if (lead.stage === to) return;
    if (config.terminalStages.includes(lead.stage)) {
      setMessage(t(msg.terminalMove));
      return;
    }
    if (to === "won" && !canWin) {
      setMessage(t(msg.adminOnlyWin)); // server enforces too
      return;
    }
    /* ADR-082 — ASK THE ENGINE, never a list of stage names kept by hand (see
       InternalBoard, where exactly this list going stale is what broke the
       Postpone drop). A null requiredGroup means "commit immediately, no
       modal": intake, Postpone, and whatever formless destination comes next. */
    if (requiredGroupForTarget(config, lead.stage, to) === null) {
      void commitDrop({ event: { type: "drag", to } }, leadId, to, "toast");
      return;
    }
    setPendingDrop({ leadId, to }); // the stage's form opens; cancel reverts
  }

  const pendingLead = pendingDrop ? leads.find((l) => l.id === pendingDrop.leadId) : null;

  return (
    <div className="space-y-4">
      {message ? (
        <div className="toast-wrap">
          <p role="alert" className="toast">
            <span className="toast-icon" aria-hidden>
              !
            </span>
            {message}
          </p>
        </div>
      ) : null}

      <DndContext id="bs-board" sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="board" data-cols="6plus">
          {/* ADR-082 — the pipeline's stages PLUS the derived Fallen behind
              column. The engine still owns the STAGES (§5.1); `boardColumns`
              adds one more COLUMN, which is a rendering fact, not a pipeline
              one — no config gained a stage and no §10 row was written. */}
          {boardColumns(config.stages, config.followUpStage).map((stage) => (
            <Column
              key={stage}
              stage={stage}
              meetingStage={config.meetingStage}
              followUpStage={config.followUpStage}
              apiBase={apiBase}
              leadPathBase={leadPathBase}
              leadQuery={leadQuery}
              leads={leads.filter((l) => columnOf(l) === stage)}
              wonBlocked={!canWin}
              draggingId={draggingId}
              suppressClickRef={suppressClickRef}
              landedHere={landed.stage === stage ? landed.n : 0}
              dayKnown={today !== null}
            />
          ))}
        </div>
        {/* the dragged card's visual — position:fixed, never clipped by the
            scrolling column it left; the source card stays put, ghosted.
            aria-hidden: the clone is pure paint — it must never double the
            card's links/buttons in the accessibility tree (the live region
            already narrates the drag), and it lingers briefly through the
            drop animation. */}
        <DragOverlay>
          {draggingId ? (
            (() => {
              const l = leads.find((x) => x.id === draggingId);
              return l ? (
                <div className="bcard bcard--lift" aria-hidden>
                  <LeadCardBody
                    lead={l}
                    apiBase={apiBase}
                    leadPathBase={leadPathBase}
                    leadQuery={leadQuery}
                  />
                </div>
              ) : null;
            })()
          ) : null}
        </DragOverlay>
      </DndContext>

      {pendingDrop && pendingLead ? (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-head">
              <div>
                <p className="modal-eyebrow">
                  {stageLabel(locale, pendingLead.stage)}
                  <span className="inline-block rtl:-scale-x-100" aria-hidden>
                    {" → "}
                  </span>
                  {stageLabel(locale, pendingDrop.to)}
                </p>
                <p className="modal-title">{pendingLead.name}</p>
              </div>
              <button
                type="button"
                className="modal-close"
                aria-label={t(msg.close)}
                onClick={() => {
                  setPendingDrop(null);
                  setError(null);
                }}
              >
                ✕
              </button>
            </div>
            <p className="modal-note">
              {t(msg.completeToConfirm)}
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                void commitDrop(
                  {
                    event: { type: "drag", to: pendingDrop.to },
                    group: buildGroupPayload(pendingDrop.to, fd, {
                      light: isLight(role),
                      agreed: formState.agreed,
                      milestoneCount: formState.milestoneCount,
                    }),
                  },
                  pendingDrop.leadId,
                  pendingDrop.to,
                );
              }}
              className="contents"
            >
              <div className="modal-body space-y-3">
                {error ? (
                  <p role="alert" className="alert-error">
                    {error}
                  </p>
                ) : null}
                <GroupFieldsV2
                  target={pendingDrop.to}
                  role={role}
                  reps={reps}
                  agreed={formState.agreed}
                  setAgreed={formState.setAgreed}
                  milestoneCount={formState.milestoneCount}
                  setMilestoneCount={formState.setMilestoneCount}
                  people={people}
                />
              </div>
              <div className="modal-foot">
                <span className="modal-foot-note">
                  {t(msg.cancelReverts).replace("{stage}", stageLabel(locale, pendingLead.stage))}
                </span>
                <span className="flex gap-2">
                  <button
                    type="button"
                    className={btnGhost}
                    onClick={() => {
                      setPendingDrop(null);
                      setError(null);
                    }}
                  >
                    {t(common.cancel)}
                  </button>
                  <button type="submit" disabled={busy} className={btnPrimary}>
                    {t(msg.confirmMove)}
                  </button>
                </span>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
