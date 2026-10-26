/* =========================================================================
   Founder: "create an entire dark mode for the entire system".

   The theme is a PREFERENCE, never a record, so it lives where the locale
   lives — in a cookie — and follows the locale's exact shape (src/lib/i18n):
   a server action writes it, each app root layout reads it and stamps it on
   <html>, and the CSS does the rest. Nothing here touches the database.

   THE CONTRACT the token CSS is written against:

       <html data-theme="light" | "dark">

   stamped SERVER-SIDE, so the first byte of the document already carries the
   right theme and the first paint cannot be the wrong one.

   Founder (amending ADR-087): "remove the system theme option". There used to
   be a third value, "system", resolved in CSS by prefers-color-scheme; it is
   gone. The default is "light" — what everyone saw before dark mode existed —
   and a cookie still holding "system" (or anything else) reads as light. No
   CSS rule matches data-theme="system" any more (theme-tokens.test.ts and the
   theme-stamp sweep fail the build if one comes back).

   This file is pure (no next/headers) so client components may import it.
   ========================================================================= */

export type Theme = "light" | "dark";

/** Display order of the toggle's segments: the default first. */
export const THEMES: readonly Theme[] = ["light", "dark"];

export const THEME_COOKIE = "theme";

/** No cookie means light: what every screen looked like before dark mode,
    and what a person who never touches the toggle keeps seeing. */
export const DEFAULT_THEME: Theme = "light";

/** A year, like the locale cookie: a preference should outlive a session. */
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Tolerant by design: the cookie is user-controlled input. Anything that is
    not one of the two values — absent, empty, junk, a non-string, a value
    from some future build, and the retired "system" a cookie set before the
    founder removed it may still hold — reads as the default (light) instead
    of throwing or stamping garbage into the attribute the CSS keys on. Case
    and surrounding whitespace are forgiven (a hand-edited "Dark " still means
    dark). */
export function parseTheme(raw: unknown): Theme {
  if (typeof raw !== "string") return DEFAULT_THEME;
  const value = raw.trim().toLowerCase();
  return value === "light" || value === "dark" ? value : DEFAULT_THEME;
}

/* The mobile browser chrome follows the theme too (<meta name="theme-color">,
   emitted by each app layout's generateViewport via themeViewport()).

   · light — NO meta, exactly as before dark mode existed: the browser keeps
             its default chrome and the installed app keeps the manifest's
             theme_color. The light theme changes nothing.
   · dark  — the dark chrome, unconditionally.
   Pure, so the table is unit-tested without a request. */
export type ThemeColor = string | undefined;

export function themeColorFor(theme: Theme, dark: string): ThemeColor {
  return theme === "dark" ? dark : undefined;
}
