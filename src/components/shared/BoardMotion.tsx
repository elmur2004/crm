"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  KeyboardCode,
  KeyboardSensor,
  PointerSensor,
  defaultDropAnimationSideEffects,
  useSensor,
  useSensors,
  type DropAnimation,
  type KeyboardCoordinateGetter,
} from "@dnd-kit/core";

/* ============================================================================
   THE BOARDS' MOTION — the pieces a stylesheet cannot do on its own (the
   count that pops on a change, the settle of a drop, the keyboard drag);
   src/themes/crm.css carries everything else. Shared by the three boards:
   BsBoard, InternalBoard and PartnersBoard. No data, no request and no
   business rule passes through here — a keyboard drop lands in the same
   onDragEnd as a pointer drop.
   ========================================================================== */

/** how long after mount a count change still counts as the LOAD */
const SETTLE_MS = 1200;

/**
 * A column's count — it pops ONCE when the number CHANGES (a card landed, a
 * card left, the Today filter narrowed it), and never on the first paint.
 *
 * BUG-026: numbers never animate at load. The pill renders the server's
 * number from the first frame, and the only motion is a scale beat on the
 * pill itself, keyed to a change seen AFTER mount. `data-bump` alternates
 * between "a" and "b" so a second change restarts the beat (crm.css binds
 * each to its own keyframes name) without remounting the element — a test or
 * a screen reader holding it keeps holding it.
 */
export function CountPill({ count }: { count: number }) {
  /* React's documented adjust-state-during-render pattern (CalendarBoard
     uses it too): compare with the count last seen, re-render before paint */
  const [seen, setSeen] = useState(count);
  const [bump, setBump] = useState<"a" | "b" | null>(null);
  /* ARMED only once the board has settled. The lead boards split Following
     Up from Fallen behind the moment the Cairo day lands, a beat after the
     first paint — those counts change, but that is still the LOAD, and a pill
     that jumped then would be exactly the animation-on-load BUG-026 forbids. */
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setArmed(true), SETTLE_MS);
    return () => window.clearTimeout(id);
  }, []);
  if (count !== seen) {
    setSeen(count);
    if (armed) setBump((b) => (b === "a" ? "b" : "a"));
  }
  return (
    <span className="count-pill" data-bump={bump ?? undefined}>
      {count}
    </span>
  );
}

const REDUCED = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => undefined;
  const query = window.matchMedia(REDUCED);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
const reducedNow = () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(REDUCED).matches : false);
/* the server has no preference to read: it renders as if motion is allowed,
   and the client corrects before any drop can happen */
const reducedOnServer = () => false;

/**
 * The drop: the overlay flies back onto the card it stands in for — as it
 * always did — and SETTLES on the way, its tilt and lift easing out
 * (`.bcard-settling`, crm.css). The source card stays hidden under it for the
 * flight (dnd-kit's own default side effect, kept).
 *
 * Under reduced motion there is no flight at all: dnd-kit's drop animation is
 * script (the Web Animations API), so the stylesheet's motion fence cannot
 * reach it — `null` removes the overlay the moment the card is let go.
 */
const SETTLE_SIDE_EFFECTS = defaultDropAnimationSideEffects({
  styles: { active: { opacity: "0" } },
  className: { dragOverlay: "bcard-settling" },
});

/* the flight's timing is the house motion's, READ from its tokens
   (--duration-medium / --ease-standard on the brand scope), so it can never
   drift from the stylesheet's settle that runs beside it; the literals are
   only what a server render or a missing token falls back to */
function motionToken(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}
function toMs(value: string): number {
  const n = parseFloat(value);
  if (!Number.isFinite(n)) return 240;
  return /ms$/.test(value) ? n : /s$/.test(value) ? n * 1000 : n;
}

export function useBoardDropAnimation(): DropAnimation | null {
  const reduced = useSyncExternalStore(subscribe, reducedNow, reducedOnServer);
  return useMemo<DropAnimation | null>(
    () =>
      reduced
        ? null
        : {
            duration: toMs(motionToken("--duration-medium", "240ms")),
            easing: motionToken("--ease-standard", "cubic-bezier(.2, .8, .2, 1)"),
            sideEffects: SETTLE_SIDE_EFFECTS,
          },
    [reduced],
  );
}

/**
 * KEYBOARD DRAG — column to column.
 *
 * Every card's grip already carries dnd-kit's screen-reader instructions
 * ("press the space bar to pick up… use the arrow keys…") through its
 * `aria-describedby`, but the boards registered only the pointer sensor, so
 * the promise was hollow. The keyboard sensor makes it true, and the same
 * lifted, tilted overlay and the same settle carry a keyboard drag.
 *
 * dnd-kit's default getter steps 25px per press, which on a board of 218px
 * columns is eight presses per stage. This one jumps to the next column in
 * the direction pressed — by GEOMETRY, so Arrow Right is the column on the
 * right in Arabic too — and parks the card just under that column's head,
 * where the board's own collision detection (rect intersection) reads it as
 * over that column and no other. Up and Down do nothing: a board column has
 * no order a person sets. Space / Enter drops (the stage's form opens exactly
 * as for a pointer drop), Escape cancels.
 *
 * The activator is the GRIP only (setActivatorNodeRef), so a key pressed on
 * the card's name link or its chips never starts a drag.
 */
const HEAD_CLEARANCE = 44;

export const columnKeyboardCoordinates: KeyboardCoordinateGetter = (event, { context, currentCoordinates }) => {
  const { collisionRect, droppableRects, droppableContainers } = context;
  const step = event.code === KeyboardCode.Right ? 1 : event.code === KeyboardCode.Left ? -1 : 0;
  if (event.code === KeyboardCode.Up || event.code === KeyboardCode.Down) {
    event.preventDefault(); // the page must not scroll under a card in hand
    return undefined;
  }
  if (!step || !collisionRect) return undefined;
  event.preventDefault();
  const centre = collisionRect.left + collisionRect.width / 2;
  const columns = [...droppableRects.entries()]
    .filter(([id]) => !droppableContainers.get(id)?.disabled)
    .map(([, rect]) => rect)
    .sort((a, b) => a.left - b.left);
  const target =
    step > 0
      ? columns.find((r) => r.left + r.width / 2 > centre + 1)
      : [...columns].reverse().find((r) => r.left + r.width / 2 < centre - 1);
  if (!target) return currentCoordinates;
  return {
    x: target.left + (target.width - collisionRect.width) / 2,
    y: target.top + HEAD_CLEARANCE,
  };
};

/* module-level, so the sensor descriptors are stable across renders */
const POINTER_OPTIONS = { activationConstraint: { distance: 6 } };
const KEYBOARD_OPTIONS = { coordinateGetter: columnKeyboardCoordinates };

/** The three boards' sensors: a pointer (6px before a drag starts, so a click
    still opens the card) and the keyboard, column to column. */
export function useBoardSensors() {
  return useSensors(useSensor(PointerSensor, POINTER_OPTIONS), useSensor(KeyboardSensor, KEYBOARD_OPTIONS));
}
