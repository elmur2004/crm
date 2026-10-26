"use server";

import { cookies } from "next/headers";
import { THEME_COOKIE, THEME_COOKIE_MAX_AGE, parseTheme, type Theme } from "./core";

/* Mirrors setLocale (src/lib/i18n/actions.ts): path "/", a year, SameSite=Lax.

   ONE DELIBERATE DIFFERENCE — httpOnly. setLocale leaves it off, but only by
   default: nothing on the client reads the locale cookie either (client
   components get the locale from LocaleProvider). The theme is in the same
   position, so it takes the stricter setting:

   · nothing in the browser needs to READ it — the server stamps the value on
     <html data-theme>, and that attribute is the client's source of truth
     (ThemeToggle writes the attribute directly for the instant switch);
   · httpOnly also forbids document.cookie from WRITING it, so this action is
     the single writer and parseTheme the single reader. A stray client write
     can never leave the cookie saying one thing and the server rendering
     another.

   No `secure` flag, like the locale: the value is not sensitive, and the app
   is also reached over plain http on a LAN, where a Secure cookie would be
   silently dropped and the toggle would appear to do nothing.

   The argument arrives from the client, so it is parsed, never trusted:
   anything that is not a theme — "light" or "dark"; the retired "system"
   included — stores the default (light). */
export async function setTheme(next: Theme): Promise<void> {
  (await cookies()).set(THEME_COOKIE, parseTheme(next), {
    path: "/",
    maxAge: THEME_COOKIE_MAX_AGE,
    sameSite: "lax",
    httpOnly: true,
  });
}
