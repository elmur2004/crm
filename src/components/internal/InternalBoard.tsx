"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  DndContext,
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
  latestProposalValue: number | null; // Won form prefill (ADR-011)
  /** wa.me link, precomputed server-side (null when no confident country code) */
  waHref: string | null;
}

type Rep = { id: string; name: string };

function LeadCard({
  lead,
  basePath,
  apiBase,
  dragging,
  suppressClickRef,
}: {
  lead: InternalBoardLead;
  basePath: string;
  apiBase: string;
  dragging: boolean;
  suppressClickRef: { current: boolean };
}) {
  const t = tFor(useLocale());
  const router = useRouter();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
  });
  const [busy, setBusy] = useState(false);
  const active = lead.stage !== "won" && lead.stage !== "lost";
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      data-deal-card={lead.name}
      data-stage-key={stageKey(lead.stage)}
      onClick={() => {
        /* whole card opens the lead — but never right after a drag (the
           browser fires a click on drop; the guard swallows it) */
        if (suppressClickRef.current) return;
        router.push(`${basePath}/leads/lead/${lead.id}`);
      }}
      style={
        transform
          ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 30 }
          : undefined
      }
      className={`bcard touch-none ${isDragging || dragging ? "bcard--lift" : ""}`}
    >
      <div className="bcard-name-row">
        <Link
          href={`${basePath}/leads/lead/${lead.id}`}
          className="bcard-name"
          onClick={(e) => e.stopPropagation()}
        >
          {lead.name}
        </Link>
      </div>
      <p className="bcard-rep mt-1">{lead.subtitle}</p>
      <div className="bcard-chips">
        {lead.partnerBadge ? <span className="bcard-badge">{lead.partnerBadge}</span> : null}
        {lead.noAnswer ? <span className="badge badge--noanswer">{t(common.noAnswer)}</span> : null}
        {/* founder: dial straight from the card. stopPropagation on BOTH the
            click and the pointer-down so it neither drags the card nor
            triggers the whole-card navigation. */}
        <Link
          href={`${basePath}/leads/lead/${lead.id}/call`}
          className="card-dial"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {t(callSheet.navLabel)}
        </Link>
        {/* founder: "message on WhatsApp" beside every Call — a new tab, same
            guards so it neither drags nor opens the lead */}
        {lead.waHref ? (
          <a
            href={lead.waHref}
            target="_blank"
            rel="noopener"
            className="card-dial"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {t(callSheet.whatsapp)}
          </a>
        ) : null}
      </div>
      {lead.keyDatum || active ? (
        <div className="bcard-meta">
          <span className="bcard-meta-dot" aria-hidden />
          <span className="min-w-0">
            {lead.keyDatum}
            {active ? (
              /* founder (ADR-039/042): the didn't-answer marker, same click
                 guards as on the B-Systems board */
              <button
                type="button"
                disabled={busy}
                onClick={async (e) => {
                  e.stopPropagation();
                  setBusy(true);
                  await fetch(`${apiBase}/leads/${lead.id}/no-answer`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ value: !lead.noAnswer }),
                  });
                  setBusy(false);
                  router.refresh();
                }}
                onPointerDown={(e) => e.stopPropagation()}
                className="underline underline-offset-2 ms-1 disabled:opacity-50"
              >
                {lead.noAnswer ? t(common.clearNoAnswer) : t(common.markNoAnswer)}
              </button>
            ) : null}
          </span>
        </div>
      ) : null}
    </div>
  );
}

function Column({
  stage,
  leads,
  basePath,
  apiBase,
  draggingId,
  suppressClickRef,
}: {
  stage: string;
  leads: InternalBoardLead[];
  basePath: string;
  apiBase: string;
  draggingId: string | null;
  suppressClickRef: { current: boolean };
}) {
  const locale = useLocale();
  const t = tFor(locale);
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const overCls = isOver ? "col--over-valid" : "";
  /* the column hosting the active drag lifts its overflow clip + stacks above
     its siblings (design-system.css .col[data-drag-origin]) */
  const hostsActiveDrag = draggingId !== null && leads.some((l) => l.id === draggingId);
  return (
    <div
      ref={setNodeRef}
      data-stage={stage}
      data-stage-key={stageKey(stage)}
      data-drag-origin={hostsActiveDrag ? "" : undefined}
      className={`col ${overCls}`}
    >
      <div className="col-bar" aria-hidden />
      <div className="col-head">
        <span className="col-title">{stageLabel(locale, stage)}</span>
        <span className="count-pill">{leads.length}</span>
      </div>
      <div className="col-cards">
        {leads.map((l) => (
          <LeadCard
            key={l.id}
            lead={l}
            basePath={basePath}
            apiBase={apiBase}
            dragging={draggingId === l.id}
            suppressClickRef={suppressClickRef}
          />
        ))}
        {leads.length === 0 ? <div className="col-empty">{t(msg.emptyColumn)}</div> : null}
      </div>
    </div>
  );
}

export function InternalBoard({
  leads,
  reps,
  basePath,
  apiBase,
}: {
  leads: InternalBoardLead[];
  reps: Rep[];
  basePath: string;
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

  async function commitDrop(body: unknown, leadId: string, surface: "modal" | "toast" = "modal") {
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
      void commitDrop({ event: { type: "drag", to } }, leadId, "toast"); // intake — no form
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
              apiBase={apiBase}
              draggingId={draggingId}
              suppressClickRef={suppressClickRef}
            />
          ))}
        </div>
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
