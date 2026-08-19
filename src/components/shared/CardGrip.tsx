"use client";

import { useMemo, type PointerEvent as ReactPointerEvent } from "react";
import type { DraggableAttributes, DraggableSyntheticListeners } from "@dnd-kit/core";

/* Founder, on his phone: "the scroller of the columns and the CRM is not
   working — when I try to scroll using the cards it drags the card. I should
   have a button to drag the card... I cannot reach the leads under the
   column because I cannot scroll."

   The board card used to BE the drag activator and carried `touch-none`
   (touch-action: none), which tells the browser "no panning may start here".
   Cards fill the whole column, so every finger landing on the board killed
   the column's inner scroll, the board's horizontal scroll AND the page
   scroll at once, and turned the gesture into a drag.

   The split, on all three boards:
   · the CARD is an ordinary surface again (touch-action: manipulation) —
     a finger on it pans the column, the board and the page;
   · the GRIP below is the only drag activator for a finger, and the only
     element in the app allowed touch-action: none;
   · a MOUSE still drags the whole card (useMouseOnlyListeners) — desktop
     behaviour is unchanged, because a mouse has no competing pan gesture.

   NEVER re-spread raw dnd-kit `listeners` onto the card div: that is exactly
   the regression this file exists to prevent. */

type ListenerMap = NonNullable<DraggableSyntheticListeners>;

/** The activator bits `useDraggable` hands back, forwarded to the grip. */
export type CardDrag = {
  attributes: DraggableAttributes;
  listeners: DraggableSyntheticListeners;
  setActivatorNodeRef: (element: HTMLElement | null) => void;
};

/**
 * The card shell's own listeners, gated to a MOUSE.
 *
 * dnd-kit 6.3.1's PointerSensor exposes exactly one activator, `onPointerDown`
 * (core.esm.js:1632), and the synthetic event carries `pointerType` — so the
 * gate can be applied before the sensor ever sees it. Touch and pen fall
 * through to the browser and pan; every other key (a KeyboardSensor activator,
 * if one is ever registered) passes through untouched.
 */
export function useMouseOnlyListeners(
  listeners: DraggableSyntheticListeners,
): DraggableSyntheticListeners {
  return useMemo(() => {
    if (!listeners) return listeners;
    const gated: ListenerMap = { ...listeners };
    const activate = listeners.onPointerDown as
      | ((event: ReactPointerEvent<HTMLElement>) => void)
      | undefined;
    if (typeof activate === "function") {
      gated.onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
        if (event.pointerType !== "mouse") return; // a finger is scrolling, not dragging
        activate(event);
      };
    }
    return gated;
  }, [listeners]);
}

/**
 * The visible grip. Rendered inside the card BODY, so the DragOverlay clone —
 * which renders the same body verbatim — is pixel-identical to the card it
 * replaces and nothing reflows under the founder's finger at pick-up.
 *
 * The clone passes NO `drag`: its grip is inert and untabbable (`tabIndex -1`),
 * so the `aria-hidden` clone contributes no second button to the a11y tree.
 */
export function CardGrip({ drag, label }: { drag?: CardDrag; label: string }) {
  const listeners: ListenerMap = drag?.listeners ?? {};
  const { onPointerDown, ...passthrough } = listeners;
  const activate = onPointerDown as
    | ((event: ReactPointerEvent<HTMLButtonElement>) => void)
    | undefined;
  return (
    <button
      type="button"
      ref={drag?.setActivatorNodeRef}
      aria-label={label}
      className="bcard-grip"
      {...(drag ? drag.attributes : {})}
      {...passthrough}
      tabIndex={drag ? 0 : -1}
      onPointerDown={(event) => {
        /* start the drag from HERE, then keep the event off the card: same
           guard the Call/WhatsApp chips use, so a press on the grip never
           reaches the whole-card handler. dnd-kit's own bail-out
           (nativeEvent.dndKit) makes the order safe either way — but never
           preventDefault() here, which WOULD kill the drag. */
        activate?.(event);
        event.stopPropagation();
      }}
      onClick={(event) => event.stopPropagation()} // a tap on the grip must not open the lead
    >
      <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor" aria-hidden focusable="false">
        <circle cx="2.6" cy="3.4" r="1.15" />
        <circle cx="7.4" cy="3.4" r="1.15" />
        <circle cx="2.6" cy="8" r="1.15" />
        <circle cx="7.4" cy="8" r="1.15" />
        <circle cx="2.6" cy="12.6" r="1.15" />
        <circle cx="7.4" cy="12.6" r="1.15" />
      </svg>
    </button>
  );
}
