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
import { partnersConfigFor } from "@/lib/pipeline-engine/configs/partners";
import { requiredGroupForTarget } from "@/lib/pipeline-engine/transition";
import { stageKey } from "@/components/bsystems/stageColors";
import { tFor } from "@/lib/i18n/core";
import { useLocale } from "@/components/shared/LocaleProvider";
import { stageLabel } from "@/lib/i18n/dict/labels";
import { pCommon, pPipeline, prospectKindLabel } from "@/lib/i18n/dict/partners";
/* the grip's label is the one shared board string this file needs — the same
   key the two CRM boards use, not a duplicate in dict/partners */
import { common } from "@/lib/i18n/dict/crm";
import { callSheet } from "@/lib/i18n/dict/call";
import { CardGrip, useMouseOnlyListeners, type CardDrag } from "@/components/shared/CardGrip";
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
   a small kind chip, so the two are told apart at a glance.

   ADR-059 — ONE board again. The founder put both kinds back on one set of
   columns, so the stacked two-board arrangement ADR-057 needed is redundant:
   it doubled the page height on a phone and duplicated the whole dnd-kit
   apparatus for nothing. There is now a single DndContext, a single overlay, a
   single modal and a single toast slot; the Kind filter (server-side, in
   pages.tsx) simply decides which CARDS arrive, and each card still wears its
   kind chip. The droppable ids are bare stage keys again — the namespacing
   existed only because two overlapping stage sets shared a page. */

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
  /** §7.2b — Qualified, and the login has not been minted yet (either kind) */
  awaitingAccount: boolean;
  keyDatum: string;
  defaults: ProspectGateDefaults;
  cardNumbers: string[];
  /** dial / wa.me links for the card's primary number, precomputed server-side */
  telHref: string | null;
  waHref: string | null;
}

type Rep = { id: string; name: string };

/* The card's CONTENT — shared verbatim by the in-column draggable and the
   DragOverlay clone. Founder: columns cap their height and scroll inside now,
   so the dragged visual must ride an overlay, never the clipping column. */
function CardBody({ card, drag }: { card: ProspectCard; drag?: CardDrag }) {
  const locale = useLocale();
  const t = tFor(locale);
  return (
    <>
      {/* founder (phone): the card scrolls, THIS drags. Lives in the body so
          the DragOverlay clone is identical to the card it stands in for. */}
      <CardGrip drag={drag} label={t(common.dragHandle)} />
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
        {/* ADR-059 — qualified with no login is a legitimate state for BOTH
            kinds, so the card says so instead of leaving the row empty (agent)
            or showing nothing but "Converted" (partner: PP-4 converts the card
            at qualification, long before an admin mints the directory login).
            The action itself lives on the detail — §7.2b as amended. `.bcard-tag`
            (body font, not the mono/uppercase badge) so Arabic reads properly. */}
        {card.awaitingAccount ? (
          <span className="bcard-tag">{t(pPipeline.noLoginYet)}</span>
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
    </>
  );
}

function Card({
  card,
  suppressClickRef,
}: {
  card: ProspectCard;
  suppressClickRef: { current: boolean };
}) {
  const router = useRouter();
  const { attributes, listeners, setActivatorNodeRef, setNodeRef, isDragging } = useDraggable({
    id: card.id,
  });
  /* a MOUSE still drags the whole card; a finger scrolls it and drags by the
     grip instead (see components/shared/CardGrip) */
  const mouseDrag = useMouseOnlyListeners(listeners);
  return (
    <div
      ref={setNodeRef}
      {...mouseDrag}
      data-deal-card={card.title}
      data-kind={card.kind}
      onClick={() => {
        /* founder: the whole card opens the prospect — but never right after a
           drag (the browser fires a click on drop; the guard swallows it) */
        if (suppressClickRef.current) return;
        router.push(`/b-systems/partners-pipeline/${card.id}`);
      }}
      className={`bcard ${isDragging ? "bcard--ghost" : ""}`}
    >
      <CardBody card={card} drag={{ attributes, listeners, setActivatorNodeRef }} />
    </div>
  );
}

function Column({
  stage,
  cards,
  suppressClickRef,
}: {
  stage: string;
  cards: ProspectCard[];
  suppressClickRef: { current: boolean };
}) {
  const locale = useLocale();
  const t = tFor(locale);
  /* one board, one context: the droppable id IS the stage key (ADR-059) */
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

/** THE board: the seven shared columns, both kinds of card, one drag context. */
export function PartnersBoard({ cards, reps }: { cards: ProspectCard[]; reps: Rep[] }) {
  /* both kinds run the SAME stages since ADR-059, so the COLUMNS come from the
     config once — `stages` is the same array object for either kind. Anything
     that depends on a card's BEHAVIOUR must ask that card's own config
     (`partnersConfigFor(card.kind)` in onDragEnd), never this one. */
  const config = partnersConfigFor("partner");
  const router = useRouter();
  const locale = useLocale();
  const t = tFor(locale);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [pending, setPending] = useState<{ id: string; to: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  /* ONE toast slot for the whole page: `.toast-wrap` is position:fixed at a
     single coordinate, so a second one would sit on top of the first. */
  const [message, setMessage] = useState<string | null>(null);
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
    /* the columns are shared, but "does this move ask anything?" is answered by
       THIS CARD's config: only the Qualified slot differs between the kinds, and
       asking the partner config on an agent's behalf is exactly how PP-6's pure
       move (founder 1.3) turns into an empty confirmation modal. */
    const cardConfig = partnersConfigFor(card.kind);
    if (cardConfig.terminalStages.includes(card.stage)) {
      /* one sentence now: Qualified and Lost are the terminal pair for BOTH
         kinds, so there is nothing to choose between (ADR-059) */
      setMessage(t(pPipeline.terminalToastAgent));
      return;
    }
    /* ADR-059 — ONE source of truth for "does this move ask anything?": the
       engine. A target with no required group commits on the drop, with no
       modal at all: Lead → Contacted (founder 1.2), anything → Waiting (1.1),
       an agent → Qualified (1.3), and the drag back to Lead as before. */
    if (!requiredGroupForTarget(cardConfig, card.stage, to)) {
      void commit({ event: { type: "drag", to } }, id);
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
        <div className="board" data-pipeline="prospects" data-cols="6plus">
          {config.stages.map((stage) => (
            <Column
              key={stage}
              stage={stage}
              cards={cards.filter((c) => c.stage === stage)}
              suppressClickRef={suppressClickRef}
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
                const c = cards.find((x) => x.id === draggingId);
                return c ? (
                  <div className="bcard bcard--lift" aria-hidden>
                    <CardBody card={c} />
                  </div>
                ) : null;
              })()
            : null}
        </DragOverlay>
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
                      requiredGroupForTarget(
                        partnersConfigFor(pendingCard.kind),
                        pendingCard.stage,
                        pending.to,
                      ),
                      new FormData(e.currentTarget),
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
                  group={requiredGroupForTarget(
                    partnersConfigFor(pendingCard.kind),
                    pendingCard.stage,
                    pending.to,
                  )}
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
