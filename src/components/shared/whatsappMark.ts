import { formatCairoDate } from "@/lib/datetime";
import { formatMsg, tFor, type Locale } from "@/lib/i18n/core";
import { callSheet } from "@/lib/i18n/dict/call";

/* ADR-069 — the WhatsApp mark, as the UI reads it.

   Founder: "when I click on the WhatsApp button, it should turn to be green to
   signal that I already sent WhatsApp to that prospect or to that lead, and it
   signals not just for my user, for any user that we have contacted this lead
   through WhatsApp."

   Deliberately NOT inside WhatsappChip.tsx: that file is `"use client"`, and a
   plain function exported from a client module cannot be CALLED by a server
   component — it arrives as a client reference. The sentence has to be built on
   the server (see `waSentLabel` below), so it lives here, where both sides of
   the boundary can import it. */

/** The three columns, as they cross the server → client boundary. `sentAt` is
    an ISO string rather than a Date because a client component's props are
    serialised — but nothing on the client ever formats it (ADR-068: the one
    clock lives in lib/datetime), so it is carried only for the surfaces that
    want to know WHETHER a record is marked. */
export type WhatsappMark = {
  sentAt: string | null;
  sentBy: string | null;
};

/** Straight off a Prisma row (a Lead or a PartnerProspect). */
export function whatsappMarkOf(row: {
  whatsappSentAt: Date | null;
  whatsappSentByLabel: string | null;
}): WhatsappMark {
  return {
    sentAt: row.whatsappSentAt ? row.whatsappSentAt.toISOString() : null,
    sentBy: row.whatsappSentByLabel,
  };
}

/** "WhatsApp sent by Omar on 3 Sep 2026" — the chip's accessible name and title
    once the record is marked, or null while nobody has messaged them.

    SERVER-SIDE, always: the date goes through the one shared formatter, so the
    chip never builds a clock of its own (ADR-068 §7's sweep) and the sentence
    is already in the reader's language before it crosses the boundary.

    Date only. The chip answers "have we done this yet"; the exact minute of a
    message sent weeks ago is noise on a hover, and the card's History carries
    every press with its full timestamp for anyone who needs it. */
export function waSentLabel(locale: Locale, mark: WhatsappMark | null): string | null {
  if (!mark?.sentAt) return null;
  const t = tFor(locale);
  const when = formatCairoDate(new Date(mark.sentAt), locale);
  return mark.sentBy
    ? t(formatMsg(callSheet.whatsappSentBy, { who: mark.sentBy, when }))
    : t(formatMsg(callSheet.whatsappSentOn, { when }));
}
