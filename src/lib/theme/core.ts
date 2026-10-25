/* =========================================================================
   Founder: "create an entire dark mode for the entire system".

   The theme is a PREFERENCE, never a record, so it lives where the locale
   lives — in a cookie — and follows the locale's exact shape (src/lib/i18n):
   a server action writes it, each app root layout reads it and stamps it on
   <html>, and the CSS does the rest. Nothing here touches the database.

   THE CONTRACT the token CSS is written against:

       <html data-theme="light" | "dark" | "system">

   stamped SERVER-SIDE, so the first byte of the document already carries the
   right theme and the first paint cannot be the wrong one. "system" is the
   default and is resolved by `@media (prefers-color-scheme: dark)` in CSS,
   which needs no JavaScript at all — so it cannot flash either.

   This file is pure (no next/headers) so client components may import it.
   ========================================================================= */

export type Theme = "light" | "dark" | "system";

/** Display order of the toggle's segments: the default first. */
export const THEMES: readonly Theme[] = ["system", "light", "dark"];

export const THEME_COOKIE = "theme";

/** No cookie means "follow the OS". A person who never touches the toggle
    gets the theme their device already asked for. */
export const DEFAULT_THEME: Theme = "system";

/** A year, like the locale cookie: a preference should outlive a session. */
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Tolerant by design: the cookie is user-controlled input. Anything that is
    not one of the three values — absent, empty, junk, a non-string, a value
    from some future build — reads as the default instead of throwing or
    stamping garbage into the attribute the CSS keys on. Case and surrounding
    whitespace are forgiven (a hand-edited "Dark " still means dark). */
export function parseTheme(raw: unknown): Theme {
  if (typeof raw !== "string") return DEFAULT_THEME;
  const value = raw.trim().toLowerCase();
  return value === "light" || value === "dark" || value === "system" ? value : DEFAULT_THEME;
}

/* The mobile browser chrome follows the theme too (<meta name="theme-color">,
   emitted by each app layout's generateViewport via themeViewport()).

   · light  — NO meta, exactly as before dark mode existed: the browser keeps
              its default chrome and the installed app keeps the manifest's
              theme_color. The light theme changes nothing.
   · dark   — the dark chrome, unconditionally.
   · system — the dark chrome ONLY under a dark OS (a media-qualified meta);
              under a light OS no meta matches and the light case applies.
   Pure, so the table is unit-tested without a request. */
export type ThemeColor = string | Array<{ media: string; color: string }> | undefined;

export function themeColorFor(theme: Theme, dark: string): ThemeColor {
  if (theme === "dark") return dark;
  if (theme === "system") return [{ media: "(prefers-color-scheme: dark)", color: dark }];
  return undefined;
}
