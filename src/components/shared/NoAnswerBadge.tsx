import { formatMsg, tFor, type Locale } from "@/lib/i18n/core";
import { common } from "@/lib/i18n/dict/crm";

/* Founder (ADR-039): the "didn't answer" card marker — "just so we know".
   Founder (ADR-064): "make the didn't answer button a counter so we can know
   how many times we tried" — so the marker carries the NUMBER.

   ONE badge for all five places the marker shows (both boards' cards, both lead
   details, the call sheet), so the number can never disagree with itself.

   Reading rules, in both languages:
     · 0 attempts — no badge at all, exactly as before;
     · 1 attempt  — the same two words as always ("No answer"). A bare "· 1" is
       noise: the badge being there IS the one attempt;
     · 2+         — "No answer · 3", the Today chip's own "label · n" shape,
       which is already proved to read correctly right-to-left.
   The full sentence ("Tried 3 times") rides title + aria-label, so the number
   is never ambiguous on hover or to a screen reader, and the visible badge
   stays as short as the card's height cap requires. The `role="img"` is what
   makes the second half of that true and is NOT decoration: a bare <span> maps
   to `role=generic`, and ARIA 1.2 PROHIBITS aria-label there — conforming
   assistive tech drops the name, so the sentence would have reached hover only.
   `img` is the standard role for a compound badge read as one thing, and it
   permits a name.

   No "use client": it holds no state and no hooks, so it drops into the server
   -rendered details AND into the client boards. The caller passes its own
   locale — `useLocale()` on the boards, the request locale on a page. */
export function NoAnswerBadge({ locale, count }: { locale: Locale; count: number }) {
  if (count <= 0) return null;
  const t = tFor(locale);
  const label = t(common.noAnswer);
  const sentence = t(
    count === 1
      ? common.noAnswerTriedOnce
      : formatMsg(common.noAnswerTriedTimes, { n: String(count) }),
  );
  return (
    <span className="badge badge--noanswer" role="img" title={sentence} aria-label={sentence}>
      {count > 1 ? `${label} · ${count}` : label}
    </span>
  );
}
