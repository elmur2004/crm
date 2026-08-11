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
import { PARTNER_STAGES, STAGE_LABELS } from "@/lib/pipeline-engine/constants";
import { partnersConfig } from "@/lib/pipeline-engine/configs/partners";
import { stageKey } from "@/components/bsystems/stageColors";
import {
  ProspectGroupFields,
  prospectGroupPayload,
  type ProspectGateDefaults,
} from "./ProspectEventPanel";

/* Founder V4 — the Partnership CRM board drags like the main CRM: a drop opens
   the target stage's form (numbers picker, follow-up, meeting, the Won
   completeness gate, lost reason); cancel reverts; Won conversion via the gate. */

export interface ProspectCard {
  id: string;
  companyName: string;
  name: string;
  stage: string;
  converted: boolean;
  keyDatum: string;
  defaults: ProspectGateDefaults;
  cardNumbers: string[];
}

type Rep = { id: string; name: string };

function Card({ card }: { card: ProspectCard }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: card.id,
  });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      data-deal-card={card.companyName}
      style={
        transform
          ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 30 }
          : undefined
      }
      className={`bcard touch-none ${isDragging ? "bcard--lift" : ""}`}
    >
      <Link
        href={`/b-systems/partners-pipeline/${card.id}`}
        className="bcard-name"
        onClick={(e) => e.stopPropagation()}
      >
        {card.companyName}
      </Link>
      <p className="bcard-rep whitespace-normal">{card.name}</p>
      {card.converted ? (
        <p className="mt-1.5">
          <span className="badge badge--converted">Converted</span>
        </p>
      ) : null}
      {card.keyDatum ? (
        <div className="bcard-meta">
          <span className="bcard-meta-dot" aria-hidden />
          <span className="min-w-0 whitespace-normal">{card.keyDatum}</span>
        </div>
      ) : null}
    </div>
  );
}

function Column({ stage, cards }: { stage: string; cards: ProspectCard[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  return (
    <div
      ref={setNodeRef}
      data-stage={stage}
      data-stage-key={stageKey(stage)}
      className={`col ${isOver ? "col--over-valid" : ""}`}
    >
      <div className="col-bar" aria-hidden />
      <div className="col-head">
        <span className="col-title">{STAGE_LABELS[stage]}</span>
        <span className="count-pill">{cards.length}</span>
      </div>
      <div className="col-cards">
        {cards.map((c) => (
          <Card key={c.id} card={c} />
        ))}
        {cards.length === 0 ? <div className="col-empty">Nothing here yet</div> : null}
      </div>
    </div>
  );
}

export function PartnersBoard({ cards, reps }: { cards: ProspectCard[]; reps: Rep[] }) {
  const router = useRouter();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [pending, setPending] = useState<{ id: string; to: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function commit(body: unknown, prospectId: string) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/b-systems/partners-pipeline/${prospectId}/event`, {
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
    setPending(null);
    router.refresh();
  }

  function onDragEnd(event: DragEndEvent) {
    setMessage(null);
    const id = String(event.active.id);
    const to = event.over ? String(event.over.id) : null;
    if (!to) return;
    const card = cards.find((c) => c.id === id);
    if (!card || card.stage === to) return;
    if (partnersConfig.terminalStages.includes(card.stage)) {
      setMessage("Won and Lost cards can no longer be moved.");
      return;
    }
    if (to === "lead") {
      void commit({ event: { type: "drag", to } }, id); // back to intake — no form
      return;
    }
    setPending({ id, to }); // the stage's form opens; cancel reverts
  }

  const pendingCard = pending ? cards.find((c) => c.id === pending.id) : null;

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

      <DndContext id="partners-board" sensors={sensors} onDragEnd={onDragEnd}>
        <div className="board" data-cols="6plus">
          {PARTNER_STAGES.map((stage) => (
            <Column key={stage} stage={stage} cards={cards.filter((c) => c.stage === stage)} />
          ))}
        </div>
      </DndContext>

      {pending && pendingCard ? (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-head">
              <div>
                <p className="modal-eyebrow">
                  {STAGE_LABELS[pendingCard.stage]}
                  <span className="inline-block rtl:-scale-x-100" aria-hidden>
                    {" → "}
                  </span>
                  {STAGE_LABELS[pending.to]}
                </p>
                <p className="modal-title">{pendingCard.companyName}</p>
              </div>
              <button
                type="button"
                className="modal-close"
                aria-label="Close"
                onClick={() => {
                  setPending(null);
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
                void commit(
                  {
                    event: { type: "drag", to: pending.to },
                    group: prospectGroupPayload(pending.to, new FormData(e.currentTarget)),
                  },
                  pending.id,
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
                <ProspectGroupFields
                  target={pending.to}
                  reps={reps}
                  defaults={pendingCard.defaults}
                  cardNumbers={pendingCard.cardNumbers}
                />
              </div>
              <div className="modal-foot">
                <span className="modal-foot-note">
                  Cancelling reverts the card to {STAGE_LABELS[pendingCard.stage]}.
                </span>
                <span className="flex gap-2">
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => {
                      setPending(null);
                      setError(null);
                    }}
                  >
                    Cancel
                  </button>
                  <button type="submit" disabled={busy} className="btn-primary">
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
