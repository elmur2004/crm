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
import { PARTNER_STAGES } from "@/lib/pipeline-engine/constants";
import { partnersConfig } from "@/lib/pipeline-engine/configs/partners";
import { stageKey } from "@/components/bsystems/stageColors";
import { tFor } from "@/lib/i18n/core";
import { useLocale } from "@/components/shared/LocaleProvider";
import { stageLabel } from "@/lib/i18n/dict/labels";
import { pCommon, pPipeline, prospectKindLabel } from "@/lib/i18n/dict/partners";
import { callSheet } from "@/lib/i18n/dict/call";
import {
  ProspectGroupFields,
  prospectGroupPayload,
  type ProspectGateDefaults,
} from "./ProspectEventPanel";

/* Founder V4 — the Partners & Agents board drags like the main CRM: a drop opens
   the target stage's form (numbers picker, follow-up, meeting, the Won
   completeness gate, lost reason); cancel reverts; Won conversion via the gate.

   Founder V6 — the board carries BOTH kinds of card. Everything about a card is
   shared except its headline (a partner's company vs. an agent's own name) and
   a small kind chip, so the two are told apart at a glance. */

export interface ProspectCard {
  id: string;
  /** the card's headline — the partner company, or the agent */
  title: string;
  kind: string;
  /** the line under the headline: the partner's contact, the agent's number */
  subtitle: string;
  /** true when the subtitle is digits — it gets its own bidi run (RTL) */
  subtitleNumeric: boolean;
  stage: string;
  converted: boolean;
  keyDatum: string;
  defaults: ProspectGateDefaults;
  cardNumbers: string[];
  /** dial / wa.me links for the card's primary number, precomputed server-side */
  telHref: string | null;
  waHref: string | null;
}

type Rep = { id: string; name: string };

function Card({
  card,
  suppressClickRef,
}: {
  card: ProspectCard;
  suppressClickRef: { current: boolean };
}) {
  const locale = useLocale();
  const t = tFor(locale);
  const router = useRouter();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: card.id,
  });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      data-deal-card={card.title}
      data-kind={card.kind}
      onClick={() => {
        /* founder: the whole card opens the prospect — but never right after a
           drag (the browser fires a click on drop; the guard swallows it) */
        if (suppressClickRef.current) return;
        router.push(`/b-systems/partners-pipeline/${card.id}`);
      }}
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
        {card.title}
      </Link>
      {card.subtitle ? (
        <p className={`bcard-rep whitespace-normal${card.subtitleNumeric ? " u-ltr" : ""}`}>
          {card.subtitle}
        </p>
      ) : null}
      {/* the board's own chip row + chip scale (the leads boards use both), so
          the kind reads as card furniture rather than a second badge */}
      <div className="bcard-chips">
        <span className="bcard-tag">{prospectKindLabel(locale, card.kind)}</span>
        {card.converted ? (
          <span className="badge badge--converted">{t(pPipeline.converted)}</span>
        ) : null}
        {/* founder: "add call and whatsapp in agents and partners" — the lead
            boards' chip pair, same guards so neither drags nor opens the card */}
        {card.telHref ? (
          <a
            href={card.telHref}
            className="card-dial"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {t(callSheet.navLabel)}
          </a>
        ) : null}
        {card.waHref ? (
          <a
            href={card.waHref}
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
      {card.keyDatum ? (
        <div className="bcard-meta">
          <span className="bcard-meta-dot" aria-hidden />
          <span className="min-w-0 whitespace-normal">{card.keyDatum}</span>
        </div>
      ) : null}
    </div>
  );
}

function Column({
  stage,
  cards,
  draggingId,
  suppressClickRef,
}: {
  stage: string;
  cards: ProspectCard[];
  draggingId: string | null;
  suppressClickRef: { current: boolean };
}) {
  const locale = useLocale();
  const t = tFor(locale);
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  /* the column hosting the active drag lifts its overflow clip + stacks above
     its siblings (design-system.css .col[data-drag-origin]) so the dragged
     card never disappears behind neighboring columns */
  const hostsActiveDrag = draggingId !== null && cards.some((c) => c.id === draggingId);
  return (
    <div
      ref={setNodeRef}
      data-stage={stage}
      data-stage-key={stageKey(stage)}
      data-drag-origin={hostsActiveDrag ? "" : undefined}
      className={`col ${isOver ? "col--over-valid" : ""}`}
    >
      <div className="col-bar" aria-hidden />
      <div className="col-head">
        <span className="col-title">{stageLabel(locale, stage)}</span>
        <span className="count-pill">{cards.length}</span>
      </div>
      <div className="col-cards">
        {cards.map((c) => (
          <Card key={c.id} card={c} suppressClickRef={suppressClickRef} />
        ))}
        {cards.length === 0 ? <div className="col-empty">{t(pPipeline.emptyColumn)}</div> : null}
      </div>
    </div>
  );
}

export function PartnersBoard({ cards, reps }: { cards: ProspectCard[]; reps: Rep[] }) {
  const router = useRouter();
  const locale = useLocale();
  const t = tFor(locale);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [pending, setPending] = useState<{ id: string; to: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  /* set on every drag end, cleared a beat later: the click the browser fires
     on drop must not navigate (whole-card onClick checks this ref) */
  const suppressClickRef = useRef(false);

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
      setError(data?.error ?? t(pCommon.somethingWrong));
      return;
    }
    setPending(null);
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
    const id = String(event.active.id);
    const to = event.over ? String(event.over.id) : null;
    if (!to) return;
    const card = cards.find((c) => c.id === id);
    if (!card || card.stage === to) return;
    if (partnersConfig.terminalStages.includes(card.stage)) {
      setMessage(t(pPipeline.terminalToast));
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

      <DndContext
        id="partners-board"
        sensors={sensors}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="board" data-cols="6plus">
          {PARTNER_STAGES.map((stage) => (
            <Column
              key={stage}
              stage={stage}
              cards={cards.filter((c) => c.stage === stage)}
              draggingId={draggingId}
              suppressClickRef={suppressClickRef}
            />
          ))}
        </div>
      </DndContext>

      {pending && pendingCard ? (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-head">
              <div>
                <p className="modal-eyebrow">
                  {stageLabel(locale, pendingCard.stage)}
                  <span className="inline-block rtl:-scale-x-100" aria-hidden>
                    {" → "}
                  </span>
                  {stageLabel(locale, pending.to)}
                </p>
                <p className="modal-title">{pendingCard.title}</p>
              </div>
              <button
                type="button"
                className="modal-close"
                aria-label={t(pCommon.close)}
                onClick={() => {
                  setPending(null);
                  setError(null);
                }}
              >
                ✕
              </button>
            </div>
            <p className="modal-note">
              {t(pPipeline.modalNote)}
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void commit(
                  {
                    event: { type: "drag", to: pending.to },
                    group: prospectGroupPayload(
                      pending.to,
                      new FormData(e.currentTarget),
                      pendingCard.kind,
                    ),
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
                  {t(pPipeline.cancelReverts).replace("{stage}", stageLabel(locale, pendingCard.stage))}
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
                    {t(pCommon.cancel)}
                  </button>
                  <button type="submit" disabled={busy} className="btn-primary">
                    {t(pPipeline.confirmMove)}
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
