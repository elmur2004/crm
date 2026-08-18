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
import { BSYSTEMS_STAGES } from "@/lib/pipeline-engine/constants";
import { bsystemsCrmConfig } from "@/lib/pipeline-engine/configs/bsystems-crm";
import { btnGhost, btnPrimary } from "@/components/portal/groupForms";
import { tFor } from "@/lib/i18n/core";
import { useLocale } from "@/components/shared/LocaleProvider";
import { stageLabel } from "@/lib/i18n/dict/labels";
import { board as msg, common } from "@/lib/i18n/dict/crm";
import { callSheet } from "@/lib/i18n/dict/call";
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
  keyDatum: string;
  /** wa.me link, precomputed server-side (null when no confident country code) */
  waHref: string | null;
}

function LeadCard({
  lead,
  dragging,
  suppressClickRef,
}: {
  lead: BsBoardLead;
  dragging: boolean;
  suppressClickRef: { current: boolean };
}) {
  const t = tFor(useLocale());
  const router = useRouter();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
  });
  const [busy, setBusy] = useState(false);
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      data-deal-card={lead.name}
      data-stage-key={stageKey(lead.stage)}
      onClick={() => {
        /* founder: the whole card opens the lead — but never right after a
           drag (the browser fires a click on drop; the guard swallows it) */
        if (suppressClickRef.current) return;
        router.push(`/b-systems/crm/lead/${lead.id}`);
      }}
      style={
        transform
          ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 30 }
          : undefined
      }
      className={`bcard touch-none ${isDragging || dragging ? "bcard--lift" : ""}`}
    >
      {lead.readyToClose ? <span className="bcard-badge">{t(common.readyToClose)}</span> : null}
      <div className="bcard-name-row">
        <Link
          href={`/b-systems/crm/lead/${lead.id}`}
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
        {lead.noAnswer ? <span className="badge badge--noanswer">{t(common.noAnswer)}</span> : null}
        {/* founder: dial straight from the card. stopPropagation on BOTH the
            click and the pointer-down so it neither drags the card nor
            triggers the whole-card navigation. */}
        <Link
          href={`/b-systems/crm/lead/${lead.id}/call`}
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
                 know"; toggleable, never a stage move. Same click guards as
                 the RTC button so it neither drags nor opens the lead. */
              <button
                type="button"
                disabled={busy}
                onClick={async (e) => {
                  e.stopPropagation();
                  setBusy(true);
                  await fetch(`/api/b-systems/leads/${lead.id}/no-answer`, {
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
  wonBlocked,
  draggingId,
  suppressClickRef,
}: {
  stage: string;
  leads: BsBoardLead[];
  wonBlocked: boolean;
  draggingId: string | null;
  suppressClickRef: { current: boolean };
}) {
  const locale = useLocale();
  const t = tFor(locale);
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const blocked = wonBlocked && stage === "won";
  const overCls = isOver ? (blocked ? "col--over-blocked" : "col--over-valid") : "";
  /* the column hosting the active drag lifts its overflow clip + stacks above
     its siblings (design-system.css .col[data-drag-origin]) so the dragged
     card never disappears behind neighboring columns */
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
      {blocked ? <p className="col-locked-note">{t(msg.adminOnlyColumn)}</p> : null}
      <div className="col-cards">
        {leads.map((l) => (
          <LeadCard
            key={l.id}
            lead={l}
            dragging={draggingId === l.id}
            suppressClickRef={suppressClickRef}
          />
        ))}
        {leads.length === 0 ? (
          <div className="col-empty">{isOver && blocked ? t(msg.blocked) : t(msg.emptyColumn)}</div>
        ) : null}
      </div>
    </div>
  );
}

export function BsBoard({
  leads,
  role,
  reps,
}: {
  leads: BsBoardLead[];
  role: BsFormRole;
  reps: Array<{ id: string; name: string }>;
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
  /* set on every drag end, cleared a beat later: the click the browser fires
     on drop must not navigate (whole-card onClick checks this ref) */
  const suppressClickRef = useRef(false);
  const formState = useGroupFormState();

  const canWin = role === "admin" || role === "sales";

  async function commitDrop(body: unknown, leadId: string, surface: "modal" | "toast" = "modal") {
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
    if (bsystemsCrmConfig.terminalStages.includes(lead.stage)) {
      setMessage(t(msg.terminalMove));
      return;
    }
    if (to === "won" && !canWin) {
      setMessage(t(msg.adminOnlyWin)); // server enforces too
      return;
    }
    if (to === "new") {
      void commitDrop({ event: { type: "drag", to } }, leadId, "toast"); // intake — no form
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
          {BSYSTEMS_STAGES.map((stage) => (
            <Column
              key={stage}
              stage={stage}
              leads={leads.filter((l) => l.stage === stage)}
              wonBlocked={!canWin}
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
