"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatMsg, tFor, type Locale, type Msg } from "@/lib/i18n/core";
import { useLocale } from "@/components/shared/LocaleProvider";
import { acct } from "@/lib/i18n/dict/accounting";
import type { AcctCompany } from "@/lib/accounting/constants";
import {
  isAcctUndoReason,
  type AcctUndoReason,
} from "@/lib/accounting/undo-reasons";

/* ============================================================================
   Founder: "add an undo and redo button for the accounting system."
   ONE STEP (undo reverses your last accounting action, redo puts it back) and
   PERSONAL (only your own actions) — his choices, both.

   THE SLOT. The pair lives in the module's own page chrome (AcctHead's
   .page-actions), at the inline START of the action cluster. Three reasons:
   (a) every one of the twelve accounting pages renders AcctHead, so the pair is
   reachable from all of them without threading a prop through twelve files;
   (b) the server half needs the CURRENT company, and `?company=` is a
   searchParam — the module LAYOUT cannot read one (the same constraint that
   made ModuleBrandScope and AcctModuleNav client components), while AcctHead
   already receives the resolved `view`; (c) it CANNOT be confused with the
   CRM's own undo, which is ADR-045's `.undo-fab`: a fixed snackbar pill at the
   bottom inline-start of the VIEWPORT, posting to /api/undo, over the
   leads/vault UndoEntry stack. Different place on the screen, different class
   names, different endpoint, different table — and the accounting mutations are
   not in ADR-045's allowlist at all, so that pill is not even lit while the
   books are being edited.

   WHY NOT AN ARROW-ONLY TOOLBAR. ADR-045's finding, kept: the label carries the
   DESCRIPTION of the action, so the person knows what he is about to reverse
   instead of pressing a blind arrow. The description is the sentence the server
   stored when the action happened, in EN or AR — never re-derived from data
   that may since have moved.

   HIDE vs DISABLE, decided once. With BOTH sides empty the control renders
   NOTHING (the server half returns null) — an undo/redo pair is not permanent
   furniture, and a Redo button that is always lit is exactly what teaches
   people to distrust it. With EITHER side live, BOTH halves render and the
   empty one is visibly and accessibly unavailable rather than hidden. Hiding
   one of two would reflow the cluster mid-interaction and make the pair
   unreadable AS a pair: the one flip that matters — press Undo, Undo goes quiet
   and Redo lights up IN THE SAME PLACE — is only legible if the place stays
   put.

   The quiet half carries `aria-disabled` and stays FOCUSABLE rather than taking
   the `disabled` attribute: a `disabled` button leaves the tab order, so the
   accessible name that explains why ("Nothing to redo") would be unreachable by
   exactly the people who need it, and its contrast would stop being anybody's
   problem. `disabled` is reserved for the in-flight state, where the whole
   point is that a second press must not land.
   ========================================================================== */

export type AcctUndoDirection = "undo" | "redo";

const COPY: Record<
  AcctUndoDirection,
  { name: Msg; nameWhat: Msg; nothing: Msg; working: Msg; done: Msg }
> = {
  undo: {
    name: acct.undoBtn,
    nameWhat: acct.undoNameWhat,
    nothing: acct.undoNothing,
    working: acct.undoWorking,
    done: acct.undoDone,
  },
  redo: {
    name: acct.redoBtn,
    nameWhat: acct.redoNameWhat,
    nothing: acct.redoNothing,
    working: acct.redoWorking,
    done: acct.redoDone,
  },
};

/* ---------------------------------------------------------------------------
   REFUSAL → HONEST COPY.

   The server's `error` body is English (handleRoute returns the thrown
   message) and this module is read in Arabic, so the copy is chosen HERE and
   the body is never printed. What chooses it is the REASON CODE the two
   accounting routes send beside that message — one word, from the closed set
   in lib/accounting/undo-reasons.ts, attached at the engine's own throw site.

   WHY A CODE AND NOT THE TEXT. The first cut of this control read the English
   message with regexes (`/pay them twice/`, `/records were added/`, `/already
   (undone|redone)/`, `/too old/`). It worked and it was pinned by tests, but a
   reword on the server silently changed which sentence a bookkeeper read, and
   the near miss was the dangerous part: the double-payroll guard says "That
   person ALREADY has another payroll row…" while having applied NOTHING, so a
   bare /already/ answered it with "That step was already applied" — telling
   him his click landed twice when in truth it never landed at all. On a money
   screen a wrong explanation of a refusal is worse than a generic one.

   The table below is `Record<AcctUndoReason, Msg>`, so the day a code is added
   to that closed set without a sentence to show for it, this file stops
   compiling. Nothing here can silently fall through to a stale default.

   THE TEXT MATCH SURVIVES AS A FALLBACK, nothing more. A body can arrive with
   no `reason` in it — a browser running an older cached bundle against a newer
   server, or a proxy that strips unknown JSON fields — and a refusal must
   still read correctly then, so ACCT_UNDO_REFUSALS keeps exactly the behaviour
   this control shipped with: the status decides, with four patterns splitting
   the statuses that carry more than one fact.
   ------------------------------------------------------------------------- */

/** reason code → the one honest sentence for it. Exhaustive by type. */
export const ACCT_UNDO_REASON_COPY: Record<AcctUndoReason, Msg> = {
  nothing: acct.undoRefuseNothing,
  too_old: acct.undoRefuseTooOld,
  changed_since: acct.undoRefuseChanged,
  already_applied: acct.undoRefuseApplied,
  children_added: acct.undoRefuseChildren,
  double_payroll: acct.undoRefuseDoublePay,
  /* all three mean "you may not do this here", which is the one thing the
     reader can act on; the status alone said as much before the codes existed */
  no_actor: acct.undoRefuseDenied,
  not_permitted: acct.undoRefuseDenied,
  no_company: acct.undoRefuseDenied,
};

/** THE FALLBACK, for a body with no reason code in it. Byte-for-byte the
    mapping this control shipped with — see the note above on why it stays. */
export const ACCT_UNDO_REFUSALS: ReadonlyArray<{
  status: number;
  match: RegExp;
  msg: Msg;
}> = [
  { status: 409, match: /already (undone|redone)/i, msg: acct.undoRefuseApplied },
  { status: 409, match: /pay them twice/i, msg: acct.undoRefuseDoublePay },
  { status: 409, match: /records were added/i, msg: acct.undoRefuseChildren },
  { status: 400, match: /too old/i, msg: acct.undoRefuseTooOld },
];

/** Exported so the test can assert the whole mapping rather than a sample.
    `reason` is whatever arrived in the body — unvalidated, possibly absent. */
export function acctUndoRefusal(
  status: number,
  serverError: string | null,
  reason?: unknown,
): Msg {
  /* the machine-readable answer, when the server sent one */
  if (isAcctUndoReason(reason)) return ACCT_UNDO_REASON_COPY[reason];
  /* ---- no code in the body: fall back to the status and the prose ---- */
  const named = ACCT_UNDO_REFUSALS.find(
    (r) => r.status === status && r.match.test(serverError ?? ""),
  );
  if (named) return named.msg;
  if (status === 403) return acct.undoRefuseDenied;
  if (status === 400) return acct.undoRefuseNothing;
  /* every remaining 409 is a fingerprint mismatch, and "the row changed and
     nothing was touched" is true of all of them */
  if (status === 409) return acct.undoRefuseChanged;
  /* anything undocumented degrades to the module's OWN generic rather than
     leaking an English sentence onto an Arabic screen */
  return acct.somethingWentWrong;
}

/* The glyphs are DRAWN, never a font emoji (brand rule), and the redo path is
   the exact mirror of the undo path about x=8: each absolute x becomes 16-x,
   each relative dx is negated, and the arc's sweep flag flips. The two are
   therefore distinguished ONLY by direction — which is why they are mirrored
   again under [dir="rtl"] (`.acct-ur-icon` in design-system.css): "back" in
   Arabic is to the right, and an undo arrow pointing the reading-forward way is
   a real defect, not a cosmetic one. */
/* exported so the test can assert the mirror arithmetic rather than trust a
   reviewer to eyeball two path strings */
export const ACCT_UNDO_GLYPH: Record<AcctUndoDirection, readonly [string, string]> = {
  undo: ["M3.4 6.4a5.2 5.2 0 1 1-.7 3.3", "M1.6 2.9v4h4"],
  redo: ["M12.6 6.4a5.2 5.2 0 1 0 .7 3.3", "M14.4 2.9v4h-4"],
};

function Glyph({ direction }: { direction: AcctUndoDirection }) {
  const [arc, tail] = ACCT_UNDO_GLYPH[direction];
  return (
    <svg className="acct-ur-icon" viewBox="0 0 16 16" aria-hidden focusable="false">
      <path d={arc} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path
        d={tail}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* Hoisted out of the parent on purpose: a component declared inside a render is
   a NEW type every render, so React unmounts and remounts its DOM node — which
   would throw the keyboard user's focus away on the very refresh this control
   triggers. */
function Half({
  direction,
  what,
  locale,
  inFlight,
  frozen,
  onPress,
  buttonRef,
}: {
  direction: AcctUndoDirection;
  /** the stored description, or null when there is nothing on this side */
  what: string | null;
  locale: Locale;
  inFlight: boolean;
  /** a request is in the air (this half's or the other's) */
  frozen: boolean;
  onPress: (direction: AcctUndoDirection) => void;
  buttonRef: (el: HTMLButtonElement | null) => void;
}) {
  const t = tFor(locale);
  const copy = COPY[direction];
  /* the accessible name is the verb AND the thing, or the reason there is
     nothing to press. Never a bare arrow, in either state. */
  const name = what === null ? t(copy.nothing) : t(formatMsg(copy.nameWhat, { what }));
  return (
    <button
      ref={buttonRef}
      type="button"
      /* the house primitives, not a fork of them: .btn-ghost + .btn--sm carry
         the ground, ink, border, radius and font; .acct-ur-btn adds only the
         icon row, the truncating description, the touch target and the
         unavailable state */
      className="btn-ghost btn--sm acct-ur-btn"
      onClick={what === null ? undefined : () => onPress(direction)}
      /* `disabled` ONLY while a request is in the air — see the header note on
         why the empty half stays focusable instead */
      disabled={frozen}
      aria-disabled={what === null ? true : undefined}
      aria-label={name}
      title={name}
      aria-describedby="acct-ur-scope"
    >
      <Glyph direction={direction} />
      <span className="acct-ur-verb">{inFlight ? t(copy.working) : t(copy.name)}</span>
      {/* the description: visible on a wide screen, dropped on a phone by CSS
          — the accessible name above carries it either way */}
      {what === null || inFlight ? null : (
        <span className="acct-ur-what" aria-hidden>
          {what}
        </span>
      )}
    </button>
  );
}

export function AcctUndoRedoButtons({
  company,
  /** the pending undo's stored description, already picked for the locale by
      the server half — null means there is nothing to undo */
  undoWhat,
  /** the same, for the pending redo */
  redoWhat,
}: {
  company: AcctCompany;
  undoWhat: string | null;
  redoWhat: string | null;
}) {
  const locale = useLocale();
  const t = tFor(locale);
  const router = useRouter();
  /* WHICH direction is in flight, not a bare boolean: the pressed half shows
     "Undoing…" while BOTH halves go `disabled`, so neither a double-click on
     one nor an undo-then-redo race can put two writes in the air. */
  const [busy, setBusy] = useState<AcctUndoDirection | null>(null);
  const [result, setResult] = useState<{ text: string; ok: boolean } | null>(null);
  /* belt for the double-click, independent of the render cycle: two clicks
     dispatched inside one frame share the handler's closure, so the `busy`
     state alone is not a guarantee. */
  const running = useRef(false);
  const nodes = useRef<Partial<Record<AcctUndoDirection, HTMLButtonElement | null>>>({});
  /* The press is remembered WITH the offer that was live for that half at the
     time, because "has the world moved yet" is the whole question below. */
  const pressed = useRef<{
    dir: AcctUndoDirection;
    what: string | null;
    waited: boolean;
  } | null>(null);

  /* Give the keyboard back what the in-flight `disabled` took: once the request
     settles, put focus on the half that was pressed if it is still there, and
     otherwise on its partner — which, after a successful undo, is the Redo that
     just lit up in the same place. Nothing to restore if the whole control is
     gone; the live region has already said what happened.

     THE TIMING IS THE WHOLE DIFFICULTY, and the first version got it wrong
     (caught by e2e/accounting-undo-redo.spec.ts, BUG-023). This effect fires
     TWICE on a successful press: once when `setBusy(null)` lands, and again a
     server round trip later when `router.refresh()` delivers the new offers.
     On that FIRST pass the pressed half still carries its old live label, so
     the old code focused it and then cleared the ref — and when the half went
     quiet a moment later the effect returned immediately, leaving the keyboard
     parked on "Nothing to undo" while the Redo it had just lit sat one Tab
     away. So the press now stays remembered until this half's offer actually
     CHANGES, which is the only honest signal that the refresh has landed. */
  useEffect(() => {
    if (busy !== null) return;
    const p = pressed.current;
    if (!p) return;
    const live = p.dir === "undo" ? undoWhat : redoWhat;
    const mine = nodes.current[p.dir];
    const other: AcctUndoDirection = p.dir === "undo" ? "redo" : "undo";
    const quiet = (n?: HTMLButtonElement | null) =>
      !n || n.getAttribute("aria-disabled") === "true";

    if (live !== p.what) {
      /* The refreshed offers have arrived. Keep the keyboard on the pressed
         half if it is still live; hand it to the partner if this press is what
         made it quiet. */
      pressed.current = null;
      (quiet(mine) ? nodes.current[other] : mine)?.focus();
      return;
    }

    /* Settled, but this half's offer has not changed: either the refresh is
       still in flight, or the press was REFUSED and the offer never will
       change. Either way the keyboard belongs on the half the person pressed.
       Stay armed for exactly one more render and then disarm WITHOUT touching
       focus again, so a later unrelated refresh cannot steal it from wherever
       he has tabbed to since. */
    if (p.waited) {
      pressed.current = null;
      return;
    }
    p.waited = true;
    mine?.focus();
  }, [busy, undoWhat, redoWhat]);

  async function run(direction: AcctUndoDirection) {
    if (running.current) return;
    running.current = true;
    /* Record the offer this half is showing RIGHT NOW: the focus effect above
       compares against it to tell "the refresh has landed" from "settled but
       nothing has changed yet". */
    pressed.current = {
      dir: direction,
      what: direction === "undo" ? undoWhat : redoWhat,
      waited: false,
    };
    setBusy(direction);
    setResult(null);

    let res: Response;
    try {
      res = await fetch(`/api/accounting/${direction}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company }),
      });
    } catch {
      /* the phone dropped the network mid-press. Say so, and do NOT refresh:
         the figures on screen are still the last truth we were served, and a
         failed refresh would only replace them with a crash. */
      running.current = false;
      setBusy(null);
      setResult({ text: t(acct.somethingWentWrong), ok: false });
      return;
    }

    const data = (await res.json().catch(() => null)) as
      | { error?: string; reason?: unknown; label?: string; labelAr?: string }
      | null;
    running.current = false;
    setBusy(null);

    if (!res.ok) {
      setResult({
        text: t(acctUndoRefusal(res.status, data?.error ?? null, data?.reason)),
        ok: false,
      });
      /* a refusal is news about the SERVER's state: the offer we were showing
         is very likely gone, so re-read rather than keep a stale button lit */
      router.refresh();
      return;
    }

    /* the route echoes the bilingual label of what it actually applied; if it
       ever answers 200 without one, fall back to the description we were
       already showing rather than printing "undefined" */
    const echoed = locale === "ar" ? data?.labelAr : data?.label;
    const what =
      echoed ?? (direction === "undo" ? undoWhat : redoWhat) ?? t(COPY[direction].name);
    setResult({ text: t(formatMsg(COPY[direction].done, { what })), ok: true });
    /* the figures, and BOTH buttons, come from the server — this is what makes
       the pair flip without any client-side bookkeeping of its own */
    router.refresh();
  }

  return (
    <>
      <div className="acct-ur" role="group" aria-label={t(acct.undoRedoGroup)}>
        <Half
          direction="undo"
          what={undoWhat}
          locale={locale}
          inFlight={busy === "undo"}
          frozen={busy !== null}
          onPress={run}
          buttonRef={(el) => {
            nodes.current.undo = el;
          }}
        />
        <Half
          direction="redo"
          what={redoWhat}
          locale={locale}
          inFlight={busy === "redo"}
          frozen={busy !== null}
          onPress={run}
          buttonRef={(el) => {
            nodes.current.redo = el;
          }}
        />
        {/* the founder's two choices, said once for both halves: it answers
            "why is nothing on offer when I know the books changed" */}
        <span id="acct-ur-scope" className="sr-only">
          {t(acct.undoRedoScope)}
        </span>
      </div>
      {/* The live region is MOUNTED ALWAYS and only its contents change: a
          region that appears together with its first message is announced
          unreliably across screen readers. `.toast-wrap` is fixed and
          pointer-events:none, so an empty one paints and costs nothing.
          Polite, not assertive: both the confirmation and the refusal answer a
          press the person has just made, so there is nothing to interrupt. */}
      <div className="toast-wrap" role="status" aria-live="polite" aria-atomic="true">
        {result ? (
          <p className={result.ok ? "toast toast--ok" : "toast"}>
            <span className="toast-icon" aria-hidden>
              !
            </span>
            {result.text}
          </p>
        ) : null}
      </div>
    </>
  );
}
