import type { Msg } from "@/lib/i18n/core";

/* The glass sign-in (src/components/login/). Only the strings the redesign
   ADDS live here — every string the page already had (title, labels, the four
   errors, the button, the portal link) is still read from `login` in
   ./auth.ts, byte-identical, because ~50 e2e specs sign in through them.

   Two rules these strings were written against:
   · Nothing here may contain the word the specs look for. `getByLabel`
     matches ANY element whose aria-label CONTAINS the text, case-insensitive,
     so a show-password button named "Show password" would make every
     `getByLabel("Password")` in the suite ambiguous. The eye is named "Show"
     (a toggle: its pressed state says whether the characters are visible), and
     the full sentence rides on `title`, which no label query reads.
   · Brand names stay Latin in Arabic, as they do in the page title. */

export const loginGlass = {
  /* the letter-spaced line under the heading (the reference's "Sign in to
     continue"); a <p>, never a button, so the "Sign in" button query is safe */
  kicker: { en: "Sign in to continue", ar: "سجّل الدخول للمتابعة" },
  /* the password eye — a toggle button; see the rule above */
  reveal: { en: "Show", ar: "إظهار" },
  revealTitleShow: { en: "Show password", ar: "إظهار كلمة المرور" },
  revealTitleHide: { en: "Hide password", ar: "إخفاء كلمة المرور" },
  /* the two marks in the hero tile, as one image */
  marks: { en: "ByteForce × B-Systems", ar: "ByteForce × B-Systems" },
  /* the letter-spaced line at the foot of the page */
  tagline: {
    en: "ByteForce × B-Systems · Sales Platform",
    ar: "ByteForce × B-Systems · منصة المبيعات",
  },
} satisfies Record<string, Msg>;
