import { telHref, waHref } from "@/lib/phone-dial";
import { tFor, type Locale } from "@/lib/i18n/core";
import { callSheet } from "@/lib/i18n/dict/call";

/* Founder: "also add call and whatsapp in agents and partners." The pair of
   small chips that follows a phone number wherever one is printed — tel: hands
   the number to the dialer, wa.me opens the chat in a new tab. Server-rendered
   (locale passed in, same chip class as the boards' dial chip); either chip
   simply stays away when no confident href exists for it. */
export function NumberActions({ number, locale }: { number: string; locale: Locale }) {
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
        <a href={wa} target="_blank" rel="noopener" className="card-dial">
          {t(callSheet.whatsapp)}
        </a>
      ) : null}
    </span>
  );
}
