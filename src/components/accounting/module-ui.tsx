"use client";

import { useId, useLayoutEffect, useState, type ReactNode } from "react";

/* =============================================================================
   The MODULES' motion pieces — Accounting and the Data Vault (founder: "the log
   in page is very nicely animated and designed the rest of the system is still
   not" → "Glass frame, solid data": every screen gets the sign-in's motion).

   Shared by both modules. They live here, beside the accounting components,
   because components/shared belongs to the foundation; the vault imports them
   from this file. All of their CSS is src/themes/modules.css.

   Every piece degrades to the page as it was: without JavaScript the server's
   HTML is complete and still (no group folds, nothing waits); under reduced
   motion the CSS is fenced off and the row helpers below skip their waits.
   ========================================================================== */

const reducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ------------------------------------------------------- the period switch */

/** The data that belongs to ONE period / company / filter. When `swapKey`
    changes (a month flicked, a company switched, a filter applied) the block
    re-mounts with `.mod-swap-in`, and the new period cross-fades in. The first
    mount is the page's own entrance, so it carries no class. A refresh after a
    write keeps the key, keeps the DOM, and therefore keeps the figures'
    count-on-change (LiveNumber) — only a different period is a new page. */
export function ModSwap({
  swapKey,
  className,
  children,
}: {
  swapKey: string;
  className?: string;
  children: ReactNode;
}) {
  /* derived state from a prop (React's own pattern): the render that sees a
     new key re-renders at once with `swapped`, before anything commits */
  const [seen, setSeen] = useState({ key: swapKey, swapped: false });
  if (seen.key !== swapKey) setSeen({ key: swapKey, swapped: true });
  /* a new period is never "just added": drop the fresh-row arming before the
     new rows get their first style (see armFresh) */
  useLayoutEffect(() => {
    if (seen.swapped) disarmFresh();
  }, [seen]);
  return (
    <div
      key={swapKey}
      className={`mod-swap${seen.swapped ? " mod-swap-in" : ""}${className ? ` ${className}` : ""}`}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------ a collapsible ledger */

/** A ledger card whose head folds its table away — the APG accordion: the
    title is a button INSIDE the heading, so the heading keeps its name and the
    button announces expanded / collapsed. Every group starts open; without
    JavaScript it simply stays open. */
export function ModGroup({
  title,
  aside,
  children,
}: {
  /** the heading's words (a count pill may ride along) */
  title: ReactNode;
  /** beside the title, at the inline end — e.g. the group's total */
  aside?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(true);
  const [toggled, setToggled] = useState(false);
  const bodyId = useId();
  return (
    <section
      className="card card--flush0 mod-group"
      data-open={open ? "true" : "false"}
      data-toggled={toggled ? "" : undefined}
    >
      <div className="card-head">
        <h2 className="u-h3">
          <button
            type="button"
            className="mod-group-toggle"
            aria-expanded={open}
            aria-controls={bodyId}
            onClick={() => {
              setToggled(true);
              setOpen((o) => !o);
            }}
          >
            <svg className="mod-chev" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
              <path
                d="M4 6l4 4 4-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>{title}</span>
          </button>
        </h2>
        {aside}
      </div>
      <div id={bodyId} className="mod-group-body" hidden={!open}>
        {children}
      </div>
    </section>
  );
}

/* --------------------------------------------------------- the row effects
   A write ends in router.refresh(), which re-renders the page in place. These
   three helpers give that moment a shape:
   · armFresh       — rows (and entity cards) the refresh INSERTS glow once;
   · flashWhenChanged — the row that was edited flashes when its new figures land;
   · markLeaving / leave — the row being deleted dims, then slides out, BEFORE
     the refresh removes it.
   They only ever set data-* attributes on elements React rendered (React does
   not own those attributes, so a re-render leaves them alone) and they clean
   up after themselves. */

/** the row — or the entity card — a control sits in */
export function rowOf(el: Element | null | undefined): HTMLElement | null {
  return (el?.closest("tbody tr, .ecard") as HTMLElement | null) ?? null;
}

let freshTimer: number | undefined;

/** Arm the page: for the next moments, every row the refresh inserts starts on
    the primary tint and fades to the card (a @starting-style in modules.css —
    rows that already existed never restart, so only the new one glows). */
export function armFresh() {
  if (typeof document === "undefined") return;
  const page = document.querySelector(".mod-page");
  if (!page) return;
  page.setAttribute("data-fresh", "");
  window.clearTimeout(freshTimer);
  freshTimer = window.setTimeout(() => page.removeAttribute("data-fresh"), 2600);
}

export function disarmFresh() {
  if (typeof document === "undefined") return;
  window.clearTimeout(freshTimer);
  document.querySelector(".mod-page[data-fresh]")?.removeAttribute("data-fresh");
}

/** Flash `row` the moment the refresh changes it (its figures, its status
    chip, its class) — or after 1.5 s if nothing visible changed. */
export function flashWhenChanged(row: HTMLElement) {
  if (reducedMotion() || typeof MutationObserver === "undefined") return;
  let done = false;
  const fire = () => {
    if (done) return;
    done = true;
    observer.disconnect();
    window.clearTimeout(timer);
    if (!row.isConnected) return;
    row.setAttribute("data-flash", "on");
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        row.setAttribute("data-flash", "off");
        window.setTimeout(() => row.removeAttribute("data-flash"), 700);
      }),
    );
  };
  const observer = new MutationObserver(fire);
  observer.observe(row, {
    subtree: true,
    childList: true,
    characterData: true,
    attributeFilter: ["class", "data-inactive"],
  });
  const timer = window.setTimeout(fire, 1500);
}

/** the delete is in the air: the row dims (a state, not motion) */
export function markLeaving(row: HTMLElement) {
  row.setAttribute("data-leaving", "pending");
}

/** the delete was refused: the row comes back exactly as it was */
export function cancelLeaving(row: HTMLElement) {
  row.removeAttribute("data-leaving");
}

/** The delete landed: the row slides out, and the promise settles once it has
    (at once under reduced motion), so the refresh that removes it follows the
    motion instead of cutting it. A row that is somehow still on the page a
    few seconds later is put back rather than left invisible. */
export function leave(row: HTMLElement): Promise<void> {
  row.setAttribute("data-leaving", "out");
  window.setTimeout(() => {
    if (row.isConnected) row.removeAttribute("data-leaving");
  }, 4000);
  return new Promise((resolve) => window.setTimeout(resolve, reducedMotion() ? 0 : 220));
}
