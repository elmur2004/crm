"use client";

import { useSyncExternalStore, type ReactNode } from "react";

/* ADR-069 — the ONE WhatsApp chip.

   Founder: "when I click on the WhatsApp button, it should turn to be green to
   signal that I already sent WhatsApp to that prospect or to that lead, and it
   signals not just for my user, for any user that we have contacted this lead
   through WhatsApp. So it turns green or something. Just change its color. If
   it's not green right now, turn it green to signal that we did our due
   diligence and sent them WhatsApp message."

   Every surface that shows a WhatsApp control renders THIS — the two boards, the
   two lead details, the call sheet, the prospect board and detail, the partner
   directory and the Agents list — so a record cannot be green in one place and
   plain in another, which is the confusion the request exists to remove. The
   variants differ only by the `className` and the `children` they are handed.

   ---- THE LINK IS NEVER BLOCKED --------------------------------------------

   The chip's JOB is to open WhatsApp; marking is a SIDE EFFECT. So:

   · `preventDefault` is never called, on any path. The anchor navigates
     natively, exactly as it did before this feature existed.
   · the mark is dispatched with `navigator.sendBeacon`, which HANDS the request
     to the browser and returns immediately. Nothing is awaited, so the message
     never waits on the network, and the browser delivers the request even
     though this tab is about to lose focus to the new one — which a plain
     `fetch` is entitled to abandon.
   · `fetch(…, { keepalive: true })` is the fallback for the browsers that have
     no sendBeacon (and for the queue-full case, where sendBeacon returns false).
     `keepalive` buys the same outlive-the-page guarantee.
   · every failure is swallowed. Offline, 403, 500, a browser that blocks the
     beacon: the founder still gets his WhatsApp window and never sees an error.
     A missed mark is a far smaller cost than a WhatsApp button that feels
     broken.

   The request carries NO BODY: who pressed comes from the session, server-side
   (see the three routes), so there is nothing for a client to claim. */

/* ---- THE OPTIMISTIC GREEN IS THE RECORD'S, NOT THIS ELEMENT'S -------------

   A screen can print several chips for the SAME record — the prospect detail
   has one in the header and one after every number it lists, all pointing at
   the same markUrl. With the just-pressed state inside each chip, pressing one
   would leave its siblings plain until the next server render: precisely the
   "green in one place and plain in another" this component exists to prevent.

   So the pressed set lives in the MODULE, keyed by markUrl, and every chip
   subscribes to it. Per-tab and never cleared, exactly like the state it
   replaces: once green in this tab it never goes back, so a stale refresh
   cannot un-green the chip under his hand. */
const pressedMarks = new Set<string>();
const pressListeners = new Set<() => void>();

function rememberPressed(url: string): void {
  if (pressedMarks.has(url)) return;
  pressedMarks.add(url);
  for (const notify of pressListeners) notify();
}

function subscribePressed(notify: () => void): () => void {
  pressListeners.add(notify);
  return () => {
    pressListeners.delete(notify);
  };
}

/** Hand the mark to the browser. The boolean says the request was DISPATCHED —
    never that it was delivered: `sendBeacon` returns true once the request is
    QUEUED, and the `fetch` fallback is deliberately not awaited, so an offline
    press and a 500 both read as true here. That is ADR-069 §4's trade, stated
    plainly: "an offline press opens WhatsApp and records nothing". The green it
    paints is therefore optimistic and per-tab, and the next real load simply
    shows the truth. Only a dispatch that fails SYNCHRONOUSLY — a browser that
    throws on both paths — returns false, and then the chip stays plain. */
function fireMark(url: string): boolean {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      if (navigator.sendBeacon(url)) return true;
    }
  } catch {
    /* some browsers throw here rather than returning false — same answer */
  }
  try {
    void fetch(url, { method: "POST", keepalive: true, credentials: "same-origin" }).catch(
      () => undefined,
    );
    return true;
  } catch {
    return false;
  }
}

export function WhatsappChip({
  href,
  markUrl,
  sentLabel,
  justSentLabel,
  restLabel,
  className,
  cardGuards = false,
  children,
}: {
  /** the wa.me link — built server-side by waHref */
  href: string;
  /** where to record the mark; null when this surface has no record behind it
      (a self-signed-up agent has no partner/agent card to carry the mark) */
  markUrl: string | null;
  /** "WhatsApp sent by Omar on 3 Sep 2026", built server-side; null = unmarked.
      A surface whose rest label carries information the sentence does not — the
      call sheet's number — composes the two, so marking never costs the chip
      its verb (see CallSheet). */
  sentLabel: string | null;
  /** what it says between the press and the next server render */
  justSentLabel: string;
  /** the accessible name while unmarked — the exact string this surface used
      before ADR-069, so no existing name changes for an unmarked record */
  restLabel: string;
  /** the variant's base class: card-dial / btn-ghost / call-cta call-cta--wa */
  className: string;
  /** boards only: the chip must neither drag the card nor open the lead */
  cardGuards?: boolean;
  children: ReactNode;
}) {
  /* Optimistic, and STICKY — and shared by every chip on this screen that marks
     the same record (see the module store above). The mark is fire-and-forget,
     so the server render that follows a press may still be the pre-press one;
     the next real load carries the sentence with who and when. On the server
     nothing has been pressed yet, which is also the first client snapshot, so
     the hydrated markup matches. */
  const justSent = useSyncExternalStore(
    subscribePressed,
    () => (markUrl ? pressedMarks.has(markUrl) : false),
    () => false,
  );
  const sent = sentLabel !== null || justSent;
  /* the sentence wins when we have it; the bare "WhatsApp sent" covers the
     window between the press and the next server render */
  const name = sentLabel ?? (justSent ? justSentLabel : restLabel);

  const fire = () => {
    if (!markUrl) return;
    if (fireMark(markUrl)) rememberPressed(markUrl);
  };

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      className={sent ? `${className} wa-sent` : className}
      /* the state in WORDS, never colour alone: this is the chip's accessible
         name, and the same sentence is the sighted user's tooltip */
      aria-label={name}
      title={sent ? name : undefined}
      data-wa-sent={sent ? "true" : undefined}
      onPointerDown={cardGuards ? (e) => e.stopPropagation() : undefined}
      onClick={(e) => {
        if (cardGuards) e.stopPropagation();
        fire();
      }}
      /* a middle-click opens the link too, and fires auxclick instead of click.
         Button 2 is the context menu, which opens nothing — so it marks nothing. */
      onAuxClick={(e) => {
        if (e.button !== 1) return;
        if (cardGuards) e.stopPropagation();
        fire();
      }}
    >
      {sent ? (
        <span className="wa-sent-tick" aria-hidden>
          ✓
        </span>
      ) : null}
      {children}
    </a>
  );
}
