/* Founder V5: the whole system speaks Arabic and English — one toggle, every
   screen. Hand-rolled (no library): each UI string lives in a dict module as a
   Msg {en, ar}; components pick with tFor(locale). ENGLISH STRINGS ARE THE
   EXACT CURRENT LITERALS — the default locale stays "en" so every existing
   test and screenshot holds byte-for-byte. */

export type Locale = "en" | "ar";
export const LOCALES: Locale[] = ["en", "ar"];
export const LOCALE_COOKIE = "locale";

export type Msg = { en: string; ar: string };

export const tFor =
  (locale: Locale) =>
  (m: Msg): string =>
    m[locale];

export const dirFor = (locale: Locale): "ltr" | "rtl" => (locale === "ar" ? "rtl" : "ltr");
