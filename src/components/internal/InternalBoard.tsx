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
import { INTERNAL_STAGES } from "@/lib/pipeline-engine/constants";
import { internalCrmConfig } from "@/lib/pipeline-engine/configs/internal-crm";
import { btnGhost, btnPrimary } from "@/components/portal/groupForms";
import { tFor } from "@/lib/i18n/core";
import { useLocale } from "@/components/shared/LocaleProvider";
import { stageLabel } from "@/lib/i18n/dict/labels";
import { board as msg, common } from "@/lib/i18n/dict/crm";
import { callSheet } from "@/lib/i18n/dict/call";
import { CardGrip, useMouseOnlyListeners, type CardDrag } from "@/components/shared/CardGrip";
import { TodayChip, useTodayFilter } from "@/components/shared/TodayChip";
import { NoAnswerBadge } from "@/components/shared/NoAnswerBadge";
import { WhatsappChip } from "@/components/shared/WhatsappChip";
import { stageKey } from "@/components/bsystems/stageColors";
import {
  FollowUpFields,
  LostFields,
  MeetingFields,
  ProposalFields,
  WonFields,
  followUpFromForm,
  meetingFromForm,
  proposalFromForm,
  wonFromForm,
} from "./LeadEventPanel";

/* Founder (ADR-042) — the ByteForce board gains full B-Systems-board parity:
   drag with the drop-opens-stage-form modal, whole-card open, lift/clip
   layering, and the didn't-answer marker. The forms are the INTERNAL §6.2
   field groups, shared with LeadEventPanel — a drop is the same move as the
   matching Next Action. */

export interface InternalBoardLead {
  id: string;
  name: string;
  subtitle: string; // "type · rep-or-Unassigned" — precomputed server-side
  partnerBadge: string | null; // "Partner: X" — precomputed server-side
  stage: string;
  keyDatum: string;
  noAnswer: boolean;
  /** ADR-064 — how many times we tried; 0 = no marker. `noAnswer` above stays
      the is-flagged truth (count > 0) for every existing reader. */
  noAnswerCount: number;
  latestProposalValue: number | null; // Won form prefill (ADR-011)
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
const FOLLOW_UP_AT = (lead: InternalBoardLead) => lead.followUpDueAt;
const MEETING_AT = (lead: InternalBoardLead) => lead.meetingAt;

type Rep = { id: string; name: string };

/* The card's CONTENT — shared verbatim by the in-column draggable and the
   DragOverlay clone. Founder: columns cap their height and scroll inside now,
   so the dragged visual must ride an overlay, never the clipping column. */
function LeadCardBody({
  lead,
  basePath,
  query,
  apiBase,
  drag,
}: {
  lead: InternalBoardLead;
  basePath: string;
  /* ADR-067 — "?company=byteforce"; every card link keeps the company */
  query: string;
  apiBase: string;
  drag?: CardDrag;
}) {
  const locale = useLocale();
  const t = tFor(locale);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const active = lead.stage !== "won" && lead.stage !== "lost";
  return (
    <>
      {/* founder (phone): the card scrolls, THIS drags. Lives in the body so
          the DragOverlay clone is identical to the card it stands in for. */}
      <CardGrip drag={drag} label={t(common.dragHandle)} />
      <div className="bcard-name-row">
        <Link
          href={`${basePath}/leads/lead/${lead.id}${query}`}
          className="bcard-name"
          onClick={(e) => e.stopPropagation()}
        >
          {lead.name}
        </Link>
      </div>
      <p className="bcard-rep mt-1">{lead.subtitle}</p>
      <div className="bcard-chips">
        {lead.partnerBadge ? <span className="bcard-badge">{lead.partnerBadge}</span> : null}
        <NoAnswerBadge locale={locale} count={lead.noAnswerCount} />
        {/* founder: dial straight from the card. stopPropagation on BOTH the
            click and the pointer-down so it neither drags the card nor
            triggers the whole-card navigation. */}
        <Link
          href={`${basePath}/leads/lead/${lead.id}/call${query}`}
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
      {lead.keyDatum || active ? (
        <div className="bcard-meta">
          <span className="bcard-meta-dot" aria-hidden />
          <span className="min-w-0">
            {lead.keyDatum}
            {active ? (
              /* founder (ADR-039/042): the didn't-answer marker, same click
                 guards as on the B-Systems board.
                 founder (ADR-064): a COUNTER — "Didn't answer" is always
                 offered (every press is one more try) and Answered appears
                 beside it once there is a tally to clear. Full parity with the
                 B-Systems card, as ADR-042 requires. */
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
  basePath,
  query,
  apiBase,
  dragging,
  suppressClickRef,
}: {
  lead: InternalBoardLead;
  basePath: string;
  /* ADR-067 — "?company=byteforce"; every card link keeps the company */
  query: string;
  apiBase: string;
  dragging: boolean;
  suppressClickRef: { current: boolean };
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
        /* whole card opens the lead — but never right after a drag (the
           browser fires a click on drop; the guard swallows it) */
        if (suppressClickRef.current) return;
        router.push(`${basePath}/leads/lead/${lead.id}${query}`);
      }}
      className={`bcard ${isDragging || dragging ? "bcard--ghost" : ""}`}
    >
      <LeadCardBody
        lead={lead}
        basePath={basePath}
        query={query}
        apiBase={apiBase}
        drag={{ attributes, listeners, setActivatorNodeRef }}
      />
    </div>
  );
}

function Column({
  stage,
  leads,
  basePath,
  query,
  apiBase,
  draggingId,
  suppressClickRef,
  landedHere,
}: {
  stage: string;
  leads: InternalBoardLead[];
  basePath: string;
  /* ADR-067 — "?company=byteforce"; every card link keeps the company */
  query: string;
  apiBase: string;
  draggingId: string | null;
  suppressClickRef: { current: boolean };
  /** drops this column has accepted this mount — bump releases its Today chip */
  landedHere: number;
}) {
  const locale = useLocale();
  const t = tFor(locale);
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const overCls = isOver ? "col--over-valid" : "";
  /* founder (ADR-061 + ADR-064): the Today chip — on Following Up, and now on
     Meeting Setting too. Client-side over the already-loaded cards, default
     OFF. "Today" is the CAIRO calendar day, never the viewer's local one; the
     day is sampled post-mount / on press, never at render (see useTodayFilter).
     The droppable stays the whole column, so a filtered column still accepts
     drops. Each column filters on its OWN instant, and says so when the filter
     empties it. */
  const isFollowUpCol = stage === "following_up";
  const isMeetingCol = stage === internalCrmConfig.meetingStage;
  const { todayOnly, toggle, todayCount, visible } = useTodayFilter(
    leads,
    isMeetingCol ? MEETING_AT : isFollowUpCol ? FOLLOW_UP_AT : null,
    landedHere,
  );
  const hasChip = isFollowUpCol || isMeetingCol;
  return (
    <div
      ref={setNodeRef}
      data-stage={stage}
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
      <div className="col-cards">
        {visible.map((l) => (
          <LeadCard
            key={l.id}
            lead={l}
            basePath={basePath}
            query={query}
            apiBase={apiBase}
            dragging={draggingId === l.id}
            suppressClickRef={suppressClickRef}
          />
        ))}
        {visible.length === 0 ? (
          /* review: while the Today chip is pressed and cards are merely
             HIDDEN, "Nothing here yet" would lie — say what the filter found */
          <div className="col-empty">
            {todayOnly && leads.length > 0
              ? t(isMeetingCol ? msg.noTodayMeetings : msg.noTodayFollowUps)
              : t(msg.emptyColumn)}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function InternalBoard({
  leads,
  reps,
  basePath,
  query,
  apiBase,
}: {
  leads: InternalBoardLead[];
  reps: Rep[];
  basePath: string;
  /* ADR-067 — "?company=byteforce"; every card link keeps the company */
  query: string;
  apiBase: string;
}) {
  const locale = useLocale();
  const t = tFor(locale);
  const router = useRouter();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [pendingDrop, setPendingDrop] = useState<{ leadId: string; to: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [arranged, setArranged] = useState(false);
  /* set on every drag end, cleared a beat later: the click the browser fires
     on drop must not navigate (whole-card onClick checks this ref) */
  const suppressClickRef = useRef(false);

  /* Review — which column last accepted a drop, and how many drops it has
     taken this mount. A column whose Today chip is pressed lets go when a card
     lands in it, so the rep never drags a card in and watches it vanish behind
     the filter (see useTodayFilter). Counted rather than flagged so two drops
     into the same column are two distinct signals. */
  const [landed, setLanded] = useState<{ stage: string; n: number }>({ stage: "", n: 0 });

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
    setLanded((p) => ({ stage: to, n: p.stage === to ? p.n + 1 : 1 }));
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
    if (!lead || lead.stage === to) return;
    if (internalCrmConfig.terminalStages.includes(lead.stage)) {
      setMessage(t(msg.terminalMove));
      return;
    }
    if (to === "new") {
      void commitDrop({ event: { type: "drag", to } }, leadId, to, "toast"); // intake — no form
      return;
    }
    setArranged(false);
    setPendingDrop({ leadId, to }); // the stage's form opens; cancel reverts
  }

  function fieldsForTarget(target: string, lead: InternalBoardLead) {
    if (target === "following_up") return <FollowUpFields reps={reps} />;
    if (target === "meeting_setting")
      return <MeetingFields arranged={arranged} setArranged={setArranged} reps={reps} />;
    if (target === "sending_proposal") return <ProposalFields />;
    if (target === "lost") return <LostFields />;
    if (target === "won") return <WonFields prefillValue={lead.latestProposalValue} />;
    return null;
  }

  function payloadForTarget(target: string, fd: FormData) {
    if (target === "following_up") return followUpFromForm(fd);
    if (target === "meeting_setting") return meetingFromForm(fd, arranged);
    if (target === "sending_proposal") return proposalFromForm(fd);
    if (target === "lost")
      return { group: "lost" as const, data: { reason: String(fd.get("reason")) } };
    if (target === "won") return wonFromForm(fd);
    return undefined;
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

      <DndContext
        id="internal-board"
        sensors={sensors}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="board" data-cols="6plus">
          {INTERNAL_STAGES.map((stage) => (
            <Column
              key={stage}
              stage={stage}
              leads={leads.filter((l) => l.stage === stage)}
              basePath={basePath}
              query={query}
              apiBase={apiBase}
              draggingId={draggingId}
              suppressClickRef={suppressClickRef}
              landedHere={landed.stage === stage ? landed.n : 0}
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
          {draggingId
            ? (() => {
                const l = leads.find((x) => x.id === draggingId);
                return l ? (
                  <div className="bcard bcard--lift" aria-hidden>
                    <LeadCardBody lead={l} basePath={basePath} query={query} apiBase={apiBase} />
                  </div>
                ) : null;
              })()
            : null}
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
            <p className="modal-note">{t(msg.completeToConfirm)}</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                void commitDrop(
                  {
                    event: { type: "drag", to: pendingDrop.to },
                    group: payloadForTarget(pendingDrop.to, fd),
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
                {fieldsForTarget(pendingDrop.to, pendingLead)}
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
