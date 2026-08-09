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
} from "@dnd-kit/core";
import { BSYSTEMS_STAGES, STAGE_LABELS } from "@/lib/pipeline-engine/constants";
import { bsystemsCrmConfig } from "@/lib/pipeline-engine/configs/bsystems-crm";
import { btnGhost, btnPrimary } from "@/components/portal/groupForms";
import { stageAccent, stageTint } from "./stageColors";
import {
  GroupFieldsV2,
  buildGroupPayload,
  isLight,
  useGroupFormState,
  type BsFormRole,
} from "./roleForms";

/* V2 §2.3/§3 — THE B-Systems board: colored per-stage columns, drag & drop for
   every role (a drop opens the stage's role-aware form; cancel reverts), Won
   admin/sales-only, "Ready to close" flag always available on active cards. */

export interface BsBoardLead {
  id: string;
  name: string;
  companyName: string | null;
  stage: string;
  ownerLabel: string;
  readyToClose: boolean;
  keyDatum: string;
}

function LeadCard({ lead, role }: { lead: BsBoardLead; role: BsFormRole }) {
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
      style={
        transform
          ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 30 }
          : undefined
      }
      className={`bg-brand-surface-card border border-brand-border rounded-brand-card p-3 pb-4 shadow-brand-card touch-none ${
        isDragging ? "opacity-80" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-1">
        <Link
          href={`/b-systems/crm/lead/${lead.id}`}
          className="font-medium text-sm text-brand-link"
          onClick={(e) => e.stopPropagation()}
        >
          {lead.name}
        </Link>
        {lead.readyToClose ? (
          <span className="text-[10px] bg-brand-accent text-brand-on-accent rounded-brand-control px-1.5 py-0.5 shrink-0">
            Ready to close
          </span>
        ) : null}
      </div>
      {lead.companyName ? (
        <p className="text-xs text-brand-muted mt-0.5">{lead.companyName}</p>
      ) : null}
      <p className="text-xs text-brand-muted">{lead.ownerLabel}</p>
      {lead.keyDatum ? <p className="text-xs text-brand-ink mt-1">{lead.keyDatum}</p> : null}
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
          className="mt-1.5 text-[11px] text-brand-muted underline underline-offset-2"
        >
          Mark ready to close
        </button>
      ) : null}
    </div>
  );
}

function Column({
  stage,
  leads,
  role,
  wonBlocked,
}: {
  stage: string;
  leads: BsBoardLead[];
  role: BsFormRole;
  wonBlocked: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const blocked = wonBlocked && stage === "won";
  return (
    <div
      ref={setNodeRef}
      data-stage={stage}
      className={`rounded-brand-card min-h-32 overflow-hidden ${stageTint(stage)} ${
        isOver ? (blocked ? "outline-2 outline-brand-danger" : "outline-2 outline-brand-primary") : ""
      }`}
    >
      <div className={`h-1.5 ${stageAccent(stage)}`} aria-hidden />
      <div className="p-2">
        <p className="text-brand-meta text-brand-muted px-1 pb-2">
          {STAGE_LABELS[stage]} ({leads.length})
          {blocked ? <span className="ms-1">(admin only)</span> : null}
        </p>
        <div className="space-y-2">
          {leads.map((l) => (
            <LeadCard key={l.id} lead={l} role={role} />
          ))}
        </div>
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
  const formState = useGroupFormState();

  const engineRole =
    role === "admin"
      ? ("bsystems_admin" as const)
      : role === "sales"
        ? ("bsystems_sales" as const)
        : role === "agent"
          ? ("bsystems_agent" as const)
          : ("bsystems_partner" as const);
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

  function onDragEnd(event: DragEndEvent) {
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
        <p role="alert" className="text-sm text-brand-on-danger bg-brand-danger rounded-brand-control px-3 py-2">
          {message}
        </p>
      ) : null}

      <DndContext id="bs-board" sensors={sensors} onDragEnd={onDragEnd}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3 items-start">
          {BSYSTEMS_STAGES.map((stage) => (
            <Column
              key={stage}
              stage={stage}
              leads={leads.filter((l) => l.stage === stage)}
              role={role}
              wonBlocked={!canWin}
            />
          ))}
        </div>
      </DndContext>

      {pendingDrop && pendingLead ? (
        <div className="fixed inset-0 z-40 bg-brand-surface-dark/60 flex items-center justify-center p-4">
          <div className="bg-brand-surface rounded-brand-card shadow-brand-card p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto">
            <p className="font-brand-display font-bold mb-1">
              {pendingLead.name}
              <span className="inline-block rtl:-scale-x-100" aria-hidden>
                {" → "}
              </span>
              {STAGE_LABELS[pendingDrop.to]}
            </p>
            <p className="text-xs text-brand-muted mb-4">
              Complete this stage&apos;s details to confirm the move — cancel reverts it.
            </p>
            {error ? (
              <p role="alert" className="text-sm text-brand-danger mb-2">
                {error}
              </p>
            ) : null}
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
              className="space-y-3"
            >
              <GroupFieldsV2
                target={pendingDrop.to}
                role={role}
                reps={reps}
                agreed={formState.agreed}
                setAgreed={formState.setAgreed}
                milestoneCount={formState.milestoneCount}
                setMilestoneCount={formState.setMilestoneCount}
              />
              <div className="flex gap-2">
                <button type="submit" disabled={busy} className={btnPrimary}>
                  Confirm move
                </button>
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
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
