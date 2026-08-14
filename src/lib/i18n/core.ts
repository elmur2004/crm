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

/* Composed strings (ADR-045's undo labels are the first) still have to exist in
   BOTH languages, so the template is a Msg and so are its variables: filling it
   yields a Msg, never a half-translated sentence. A plain string variable (a
   person's or company's name) is used as-is in both. */
export function formatMsg(m: Msg, vars: Record<string, string | Msg>): Msg {
  const fill = (text: string, locale: Locale) =>
    text.replace(/\{(\w+)\}/g, (_all, key: string) => {
      const value = vars[key];
      if (value === undefined) return `{${key}}`;
      return typeof value === "string" ? value : value[locale];
    });
  return { en: fill(m.en, "en"), ar: fill(m.ar, "ar") };
}
