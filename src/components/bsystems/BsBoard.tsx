"use client";

import { useState } from "react";
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
import { BSYSTEMS_STAGES, STAGE_LABELS } from "@/lib/pipeline-engine/constants";
import { bsystemsCrmConfig } from "@/lib/pipeline-engine/configs/bsystems-crm";
import { btnGhost, btnPrimary } from "@/components/portal/groupForms";
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
  ownerLabel: string;
  readyToClose: boolean;
  keyDatum: string;
}

function LeadCard({ lead, dragging }: { lead: BsBoardLead; dragging: boolean }) {
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
      style={
        transform
          ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 30 }
          : undefined
      }
      className={`bcard touch-none ${isDragging || dragging ? "bcard--lift" : ""}`}
    >
      {lead.readyToClose ? <span className="bcard-badge">Ready to close</span> : null}
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
        <span className="bcard-tag">{lead.ownerLabel}</span>
      </div>
      {lead.keyDatum || (!lead.readyToClose && lead.stage !== "won" && lead.stage !== "lost") ? (
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
                Mark ready to close
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
}: {
  stage: string;
  leads: BsBoardLead[];
  wonBlocked: boolean;
  draggingId: string | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const blocked = wonBlocked && stage === "won";
  const overCls = isOver ? (blocked ? "col--over-blocked" : "col--over-valid") : "";
  return (
    <div
      ref={setNodeRef}
      data-stage={stage}
      data-stage-key={stageKey(stage)}
      className={`col ${overCls}`}
    >
      <div className="col-bar" aria-hidden />
      <div className="col-head">
        <span className="col-title">{STAGE_LABELS[stage]}</span>
        <span className="count-pill">{leads.length}</span>
      </div>
      {blocked ? <p className="col-locked-note">Admin-only column</p> : null}
      <div className="col-cards">
        {leads.map((l) => (
          <LeadCard key={l.id} lead={l} dragging={draggingId === l.id} />
        ))}
        {leads.length === 0 ? (
          <div className="col-empty">{isOver && blocked ? "Blocked" : "Nothing here yet"}</div>
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
  const router = useRouter();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [pendingDrop, setPendingDrop] = useState<{ leadId: string; to: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const formState = useGroupFormState();

  const canWin = role === "admin" || role === "sales";

  async function commitDrop(body: unknown, leadId: string) {
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
      setError(data?.error ?? "Something went wrong");
      return;
    }
    setPendingDrop(null);
    router.refresh();
  }

  function onDragStart(event: DragStartEvent) {
    setDraggingId(String(event.active.id));
  }

  function onDragEnd(event: DragEndEvent) {
    setDraggingId(null);
    setMessage(null);
    const leadId = String(event.active.id);
    const to = event.over ? String(event.over.id) : null;
    if (!to) return;
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.stage === to) return;
    if (bsystemsCrmConfig.terminalStages.includes(lead.stage)) {
      setMessage("Won and Lost leads can no longer be moved.");
      return;
    }
    if (to === "won" && !canWin) {
      setMessage("Only an admin can confirm a win."); // server enforces too
      return;
    }
    if (to === "new") {
      void commitDrop({ event: { type: "drag", to } }, leadId); // intake — no form
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
                  {STAGE_LABELS[pendingLead.stage]}
                  <span className="inline-block rtl:-scale-x-100" aria-hidden>
                    {" → "}
                  </span>
                  {STAGE_LABELS[pendingDrop.to]}
                </p>
                <p className="modal-title">{pendingLead.name}</p>
              </div>
              <button
                type="button"
                className="modal-close"
                aria-label="Close"
                onClick={() => {
                  setPendingDrop(null);
                  setError(null);
                }}
              >
                ✕
              </button>
            </div>
            <p className="modal-note">
              Complete this stage&apos;s details to confirm the move — cancel reverts it.
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
                  Cancelling reverts the card to {STAGE_LABELS[pendingLead.stage]}.
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
                    Cancel
                  </button>
                  <button type="submit" disabled={busy} className={btnPrimary}>
                    Confirm move
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
