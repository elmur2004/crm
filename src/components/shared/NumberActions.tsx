import { telHref, waHref } from "@/lib/phone-dial";
import { tFor, type Locale } from "@/lib/i18n/core";
import { callSheet } from "@/lib/i18n/dict/call";
import { WhatsappChip } from "./WhatsappChip";
import { waSentLabel, type WhatsappMark } from "./whatsappMark";

/* Founder: "also add call and whatsapp in agents and partners." The pair of
   small chips that follows a phone number wherever one is printed — tel: hands
   the number to the dialer, wa.me opens the chat in a new tab. Server-rendered
   (locale passed in, same chip class as the boards' dial chip); either chip
   simply stays away when no confident href exists for it.

   ADR-069 — the WhatsApp half is the shared chip now, so a number printed here
   wears the same green as the same record's card on the board. `mark` and
   `markUrl` are OPTIONAL: a surface with no record behind the number (the
   Agents list entry for an agent who signed himself up, so has no partner/agent
   card) still gets a working link, simply with no state to show or record. */
export function NumberActions({
  number,
  locale,
  mark = null,
  markUrl = null,
}: {
  number: string;
  locale: Locale;
  mark?: WhatsappMark | null;
  markUrl?: string | null;
}) {
  const t = tFor(locale);
  const tel = telHref(number);
  const wa = waHref(number);
  if (!tel && !wa) return null;
  return (
    <span className="inline-flex gap-1 align-middle ms-1.5">
      {tel ? (
        <a href={tel} className="card-dial">
          {t(callSheet.navLabel)}
        </a>
      ) : null}
      {wa ? (
        <WhatsappChip
          href={wa}
          markUrl={markUrl}
          sentLabel={waSentLabel(locale, mark)}
          justSentLabel={t(callSheet.whatsappSentJustNow)}
          restLabel={t(callSheet.whatsapp)}
          className="card-dial"
        >
          {t(callSheet.whatsapp)}
        </WhatsappChip>
      ) : null}
    </span>
  );
}
