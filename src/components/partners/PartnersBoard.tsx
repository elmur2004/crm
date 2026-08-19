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

   ADR-057 — the two kinds now run DIFFERENT columns, so one kanban cannot
   honestly show both. This file renders ONE pipeline per <ProspectPipeline>,
   with its columns, its config and its own drag rules read from the engine;
   the exported <PartnersBoard> is a dispatcher that shows the partner board,
   the agent board, or (the default, Kind = All) both, stacked. Each pipeline
   gets its OWN DndContext — four of the six droppable ids are common to both
   stage sets, so a shared registry would drop cards onto the wrong board — and
   its droppables are namespaced with the pipeline kind on top of that. */

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
  pipelineKind,
  stage,
  cards,
  draggingId,
  suppressClickRef,
}: {
  pipelineKind: string;
  stage: string;
  cards: ProspectCard[];
  draggingId: string | null;
  suppressClickRef: { current: boolean };
}) {
  const locale = useLocale();
  const t = tFor(locale);
  /* namespaced: `lead`, `didnt_answer`, `meeting_setting` and `lost` exist in
     BOTH stage sets, so a bare stage id would be ambiguous the day anyone
     merges the two contexts */
  const { setNodeRef, isOver } = useDroppable({ id: `${pipelineKind}:${stage}` });
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

/** ONE pipeline: the columns its kind runs, and nothing of the other kind's.
    Every piece of drag state lives in here, so two of these on one page can
    never share a modal, an overlay or an error. */
function ProspectPipeline({
  pipelineKind,
  cards,
  reps,
  onMessage,
}: {
  pipelineKind: string;
  cards: ProspectCard[];
  reps: Rep[];
  /** the PAGE's single toast slot — see <PartnersBoard> */
  onMessage: (message: string | null) => void;
}) {
  const config = partnersConfigFor(pipelineKind);
  const router = useRouter();
  const locale = useLocale();
  const t = tFor(locale);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [pending, setPending] = useState<{ id: string; to: string } | null>(null);
  const [busy, setBusy] = useState(false);
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
    onMessage(null);
    const id = String(event.active.id);
    /* `${pipelineKind}:${stage}` — a drop that lands outside THIS board's
       context reports no `over` at all, so a cross-board drag is simply a
       no-op rather than a wrong move */
    const to = event.over ? String(event.over.id).split(":")[1]! : null;
    if (!to) return;
    const card = cards.find((c) => c.id === id);
    if (!card || card.stage === to) return;
    if (config.terminalStages.includes(card.stage)) {
      onMessage(
        t(pipelineKind === "agent" ? pPipeline.terminalToastAgent : pPipeline.terminalToast),
      );
      return;
    }
    if (to === config.intakeStage) {
      void commit({ event: { type: "drag", to } }, id); // back to intake — no form
      return;
    }
    setPending({ id, to }); // the stage's form opens; cancel reverts
  }

  const pendingCard = pending ? cards.find((c) => c.id === pending.id) : null;

  return (
    <div className="space-y-4">
      <DndContext
        id={`partners-board-${pipelineKind}`}
        sensors={sensors}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="board" data-pipeline={pipelineKind} data-cols="6plus">
          {config.stages.map((stage) => (
            <Column
              key={stage}
              pipelineKind={pipelineKind}
              stage={stage}
              cards={cards.filter((c) => c.stage === stage)}
              draggingId={draggingId}
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

/* The board the Kind filter asked for. All (the default) stacks the two — a
   Partners section, then an Agents section — because a single kanban cannot
   honestly show two different stage sets, and collapsing them into one
   superset would invent columns neither kind has. */
export function PartnersBoard({
  cards,
  reps,
  kind = "any",
  filtered = false,
}: {
  cards: ProspectCard[];
  reps: Rep[];
  /** "any" | "partner" | "agent" — straight from the filter */
  kind?: string;
  /** any filter control is off its default — a section may be empty because of
      it, and "No partner cards yet." would then be a lie (the word is "yet") */
  filtered?: boolean;
}) {
  const locale = useLocale();
  const t = tFor(locale);
  /* ONE toast slot for the whole page. `.toast-wrap` is position:fixed at a
     single coordinate, so a per-pipeline message left the partner board's
     "Won and Lost cards can no longer be moved." sitting UNDER the agent
     board's "Qualified and Lost…" — two alerts, one of them stale, in the same
     spot. Lifting it here makes the newer message replace the older. */
  const [message, setMessage] = useState<string | null>(null);

  /** a section with nothing in it: say WHY, the way the leads board does */
  const emptySection = (own: typeof pPipeline.noPartnerCards) => (
    <p className="empty">{filtered ? t(pPipeline.noMatches) : t(own)}</p>
  );

  const board =
    kind === "partner" || kind === "agent" ? (
      <ProspectPipeline pipelineKind={kind} cards={cards} reps={reps} onMessage={setMessage} />
    ) : (
      (() => {
        const partners = cards.filter((c) => c.kind !== "agent");
        const agents = cards.filter((c) => c.kind === "agent");
        return (
          <div className="space-y-8">
            <section aria-labelledby="pipeline-partners">
              <h2 id="pipeline-partners" className="u-h2 mb-3">
                {t(pPipeline.sectionPartners)}
              </h2>
              {partners.length === 0 ? (
                emptySection(pPipeline.noPartnerCards)
              ) : (
                <ProspectPipeline
                  pipelineKind="partner"
                  cards={partners}
                  reps={reps}
                  onMessage={setMessage}
                />
              )}
            </section>
            <section aria-labelledby="pipeline-agents">
              <h2 id="pipeline-agents" className="u-h2 mb-3">
                {t(pPipeline.sectionAgents)}
              </h2>
              {agents.length === 0 ? (
                emptySection(pPipeline.noAgentCards)
              ) : (
                <ProspectPipeline
                  pipelineKind="agent"
                  cards={agents}
                  reps={reps}
                  onMessage={setMessage}
                />
              )}
            </section>
          </div>
        );
      })()
    );

  return (
    <>
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
      {board}
    </>
  );
}
