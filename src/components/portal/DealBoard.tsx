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
import { PORTAL_STAGES, STAGE_LABELS } from "@/lib/pipeline-engine/constants";
import { portalConfig } from "@/lib/pipeline-engine/configs/portal";
import { formatEGP } from "@/lib/money";
import {
  FollowUpFields,
  LostFields,
  MeetingFields,
  ProposalFields,
  btnGhost,
  btnPrimary,
  groupForPortalStage,
  inputCls,
  labelCls,
} from "./groupForms";

/* §8.2 / §5.4 — Trello-style board. Reps drag between all columns EXCEPT Won
   (P-1); a Won drop is blocked client-side with the clear message AND rejected
   server-side by the engine if attempted (P-2). Dropping opens the target stage's
   field group; cancelling the form reverts the drop (nothing was committed). */

export interface BoardDeal {
  id: string;
  name: string;
  companyName: string;
  industry: string;
  stage: string;
  repName?: string;
  keyDatum: string;
}

const WON_BLOCK_MESSAGE = "Only the portal admin can move a deal to Won.";

function DealCard({ deal, detailBase }: { deal: BoardDeal; detailBase: string }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: deal.id,
  });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      data-deal-card={deal.name}
      style={
        transform
          ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 30 }
          : undefined
      }
      className={`bg-brand-surface-card border border-brand-border rounded-brand-card p-3 pb-5 shadow-brand-card touch-none ${
        isDragging ? "opacity-80" : ""
      }`}
    >
      <Link
        href={`${detailBase}/${deal.id}`}
        className="font-medium text-sm text-brand-link"
        onClick={(e) => e.stopPropagation()}
      >
        {deal.name}
      </Link>
      <p className="text-xs text-brand-muted mt-0.5">
        {deal.companyName} · {deal.industry}
      </p>
      {deal.repName ? <p className="text-xs text-brand-muted">{deal.repName}</p> : null}
      {deal.keyDatum ? <p className="text-xs text-brand-ink mt-1">{deal.keyDatum}</p> : null}
    </div>
  );
}

function Column({
  stage,
  deals,
  detailBase,
  wonDisabled,
}: {
  stage: string;
  deals: BoardDeal[];
  detailBase: string;
  wonDisabled: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const isBlockedTarget = wonDisabled && stage === "won";
  return (
    <div
      ref={setNodeRef}
      data-stage={stage}
      className={`rounded-brand-card p-2 min-h-32 ${
        isOver
          ? isBlockedTarget
            ? "bg-brand-surface-tint outline-2 outline-brand-danger"
            : "bg-brand-surface-tint outline-2 outline-brand-primary"
          : "bg-brand-surface-tint"
      }`}
    >
      <p className="text-brand-meta text-brand-muted px-1 pb-2">
        {STAGE_LABELS[stage]} ({deals.length})
        {isBlockedTarget ? <span className="ms-1">(admin only)</span> : null}
      </p>
      <div className="space-y-2">
        {deals.map((d) => (
          <DealCard key={d.id} deal={d} detailBase={detailBase} />
        ))}
      </div>
    </div>
  );
}

export function DealBoard({
  deals,
  isAdmin,
  ownerPortalRepId,
  detailBase,
}: {
  deals: BoardDeal[];
  isAdmin: boolean;
  ownerPortalRepId?: string;
  detailBase: string;
}) {
  const router = useRouter();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [pendingDrop, setPendingDrop] = useState<{ dealId: string; to: string } | null>(null);
  const [arranged, setArranged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function commitDrop(body: unknown, dealId: string) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/portal/deals/${dealId}/event`, {
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
    setArranged(false);
    router.refresh();
  }

  function onDragEnd(event: DragEndEvent) {
    setMessage(null);
    const dealId = String(event.active.id);
    const to = event.over ? String(event.over.id) : null;
    if (!to) return;
    const deal = deals.find((d) => d.id === dealId);
    if (!deal || deal.stage === to) return;
    if (portalConfig.terminalStages.includes(deal.stage)) {
      setMessage("Won and Lost deals can no longer be moved.");
      return;
    }
    if (to === "won" && !isAdmin) {
      setMessage(WON_BLOCK_MESSAGE); // P-2 — clear message; server enforces too
      return;
    }
    if (to === "won" && isAdmin) {
      void commitDrop({ event: { type: "drag", to } }, dealId); // P-6, no group
      return;
    }
    if (to === "leads") {
      void commitDrop({ event: { type: "drag", to } }, dealId); // intake — no group
      return;
    }
    setPendingDrop({ dealId, to }); // §5.4: the stage's form opens; cancel reverts
  }

  const pendingDeal = pendingDrop ? deals.find((d) => d.id === pendingDrop.dealId) : null;

  return (
    <div className="space-y-4">
      {message ? (
        <p role="alert" className="text-sm text-brand-on-danger bg-brand-danger rounded-brand-control px-3 py-2">
          {message}
        </p>
      ) : null}

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-start">
          {PORTAL_STAGES.map((stage) => (
            <Column
              key={stage}
              stage={stage}
              deals={deals.filter((d) => d.stage === stage)}
              detailBase={detailBase}
              wonDisabled={!isAdmin}
            />
          ))}
        </div>
      </DndContext>

      {pendingDrop && pendingDeal ? (
        <div className="fixed inset-0 z-40 bg-brand-surface-dark/60 flex items-center justify-center p-4">
          <div className="bg-brand-surface rounded-brand-card shadow-brand-card p-6 w-full max-w-md max-h-[85vh] overflow-y-auto">
            <p className="font-brand-display font-bold mb-1">
              {pendingDeal.name}
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
                    group: groupForPortalStage(pendingDrop.to, fd, {
                      arranged,
                      ownerPortalRepId,
                    }),
                  },
                  pendingDrop.dealId,
                );
              }}
              className="space-y-3"
            >
              {pendingDrop.to === "following_up" ? <FollowUpFields /> : null}
              {pendingDrop.to === "meeting_setting" ? (
                <MeetingFields arranged={arranged} setArranged={setArranged} />
              ) : null}
              {pendingDrop.to === "proposal_sending" ? <ProposalFields /> : null}
              {pendingDrop.to === "lost" ? <LostFields /> : null}
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
                    setArranged(false);
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

export function NewDealForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className={btnPrimary}>
        Add deal
      </button>
    );
  }
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setBusy(true);
        setError(null);
        const res = await fetch("/api/portal/deals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: String(fd.get("name")),
            position: String(fd.get("position")),
            number: String(fd.get("number")),
            email: String(fd.get("email") || "") || undefined,
            companyName: String(fd.get("companyName")),
            industry: String(fd.get("industry")),
            requirements: String(fd.get("requirements") || "") || undefined,
          }),
        });
        setBusy(false);
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          setError(data?.error ?? "Something went wrong");
          return;
        }
        setOpen(false);
        router.refresh();
      }}
      className="border border-brand-border rounded-brand-card p-4 space-y-3 bg-brand-surface-card w-full"
    >
      <p className="text-sm font-bold">New deal</p>
      {error ? <p className="text-sm text-brand-danger">{error}</p> : null}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block">
          <span className={labelCls}>Name</span>
          <input type="text" name="name" required className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>Position</span>
          <input type="text" name="position" required className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>Number</span>
          <input type="tel" name="number" required className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>Email</span>
          <input type="email" name="email" className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>Company name</span>
          <input type="text" name="companyName" required className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>Industry</span>
          <input type="text" name="industry" required className={inputCls} />
        </label>
      </div>
      <label className="block">
        <span className={labelCls}>Requirements</span>
        <textarea name="requirements" rows={2} className={inputCls} />
      </label>
      <button type="submit" disabled={busy} className={btnPrimary}>
        Save deal
      </button>
    </form>
  );
}
