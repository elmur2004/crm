import { cookies } from "next/headers";
import type { Viewport } from "next";
import { THEME_CHROME_DARK } from "@/themes/theme-chrome";
import { THEME_COOKIE, parseTheme, themeColorFor, type Theme } from "./core";

/** Server-side theme (cookie; default "light" — the founder removed the
    "system" option, and a stored "system" reads as light). Mirrors
    getLocale. Import ONLY from server components/actions. */
export async function getTheme(): Promise<Theme> {
  return parseTheme((await cookies()).get(THEME_COOKIE)?.value);
}

/** Each app root layout's generateViewport: the browser chrome colour for the
    theme this request will render (see themeColorFor). The landing group
    never calls it — it has no theme. */
export async function themeViewport(): Promise<Viewport> {
  const themeColor = themeColorFor(await getTheme(), THEME_CHROME_DARK);
  return themeColor === undefined ? {} : { themeColor };
}
