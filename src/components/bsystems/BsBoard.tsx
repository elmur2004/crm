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
import { crmQuery } from "@/lib/crm/company";
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
  leadQuery,
}: {
  lead: BsBoardLead;
  drag?: CardDrag;
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
          href={`/b-systems/crm/lead/${lead.id}${leadQuery}`}
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
        {/* founder: dial straight from the card. stopPropagation on BOTH the
            click and the pointer-down so it neither drags the card nor
            triggers the whole-card navigation. */}
        <Link
          href={`/b-systems/crm/lead/${lead.id}/call${leadQuery}`}
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
                  await fetch(`/api/b-systems/leads/${lead.id}/ready`, { method: "POST" });
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
                    await fetch(`/api/b-systems/leads/${lead.id}/no-answer`, {
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
                      await fetch(`/api/b-systems/leads/${lead.id}/no-answer`, {
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
  leadQuery,
}: {
  lead: BsBoardLead;
  dragging: boolean;
  suppressClickRef: { current: boolean };
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
        router.push(`/b-systems/crm/lead/${lead.id}${leadQuery}`);
      }}
      className={`bcard ${isDragging || dragging ? "bcard--ghost" : ""}`}
    >
      <LeadCardBody
        lead={lead}
        drag={{ attributes, listeners, setActivatorNodeRef }}
        leadQuery={leadQuery}
      />
    </div>
  );
}

function Column({
  stage,
  meetingStage,
  leadQuery,
  leads,
  wonBlocked,
  draggingId,
  suppressClickRef,
  landedHere,
}: {
  stage: string;
  /* ADR-073 — passed in rather than read from a module-level config: the Today
     chip hangs off the MEETING column, and which stage that is belongs to the
     pipeline the board is drawing. */
  meetingStage: string;
  /** ADR-073 — `?company=…`, carried onto every card's links. */
  leadQuery: string;
  leads: BsBoardLead[];
  wonBlocked: boolean;
  draggingId: string | null;
  suppressClickRef: { current: boolean };
  /** drops this column has accepted this mount — bump releases its Today chip */
  landedHere: number;
}) {
  const locale = useLocale();
  const t = tFor(locale);
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const blocked = wonBlocked && stage === "won";
  const overCls = isOver ? (blocked ? "col--over-blocked" : "col--over-valid") : "";
  /* founder (ADR-061 + ADR-064): the Today chip — on Following Up, and now on
     Meeting Setting too. Client-side over the already-loaded cards, default
     OFF. "Today" is the CAIRO calendar day, never the viewer's local one; the
     day is sampled post-mount / on press, never at render (see useTodayFilter).
     The droppable stays the whole column, so a filtered column still accepts
     drops. Each column filters on its OWN instant, and says so when the filter
     empties it. */
  const isFollowUpCol = stage === "following_up";
  const isMeetingCol = stage === meetingStage;
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
      {blocked ? <p className="col-locked-note">{t(msg.adminOnlyColumn)}</p> : null}
      <div className="col-cards">
        {visible.map((l) => (
          <LeadCard
            key={l.id}
            lead={l}
            leadQuery={leadQuery}
            dragging={draggingId === l.id}
            suppressClickRef={suppressClickRef}
          />
        ))}
        {visible.length === 0 ? (
          /* review: while the Today chip is pressed and cards are merely
             HIDDEN, "Nothing here yet" would lie — say what the filter found */
          <div className="col-empty">
            {isOver && blocked
              ? t(msg.blocked)
              : todayOnly && leads.length > 0
                ? t(isMeetingCol ? msg.noTodayMeetings : msg.noTodayFollowUps)
                : t(msg.emptyColumn)}
          </div>
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

  async function commitDrop(
    body: unknown,
    leadId: string,
    to: string,
    surface: "modal" | "toast" = "modal",
  ) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/b-systems/leads/${leadId}/event`, {
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
    if (config.terminalStages.includes(lead.stage)) {
      setMessage(t(msg.terminalMove));
      return;
    }
    if (to === "won" && !canWin) {
      setMessage(t(msg.adminOnlyWin)); // server enforces too
      return;
    }
    if (to === "new") {
      void commitDrop({ event: { type: "drag", to } }, leadId, to, "toast"); // intake — no form
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
          {config.stages.map((stage) => (
            <Column
              key={stage}
              stage={stage}
              meetingStage={config.meetingStage}
              leadQuery={crmQuery(company)}
              leads={leads.filter((l) => l.stage === stage)}
              wonBlocked={!canWin}
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
          {draggingId ? (
            (() => {
              const l = leads.find((x) => x.id === draggingId);
              return l ? (
                <div className="bcard bcard--lift" aria-hidden>
                  <LeadCardBody lead={l} leadQuery={crmQuery(company)} />
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
