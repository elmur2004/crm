import { dirFor } from "@/lib/i18n/core";
import { getLocale } from "@/lib/i18n/server";
import { LocaleProvider } from "@/components/shared/LocaleProvider";
import { ThemeProvider } from "@/components/shared/ThemeProvider";
import { getTheme, themeViewport } from "@/lib/theme/server";
import type { Metadata } from "next";
import "@fontsource/raleway/500.css";
import "@fontsource/raleway/600.css";
import "@fontsource/raleway/700.css";
import "@fontsource/raleway/800.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/700.css";
import "../globals.css";
import "@/themes/design-system.css";
/* the system-wide glass + motion layer (after design-system) */
import "@/themes/glass.css";
import "@/themes/motion.css";
/* the CRM page bodies' own craft — boards, lists, details, the To-Do (after
   the foundation, so equal specificity resolves to the body layer) */
import "@/themes/crm.css";

/* Apps B & C shared root layout — stamps data-brand="bsystems" on <html>,
   activating the B-Systems token scope. Fonts self-host via fontsource @font-face
   under the literal family names the tokens reference (ADR-013): Raleway display /
   Inter body / JetBrains Mono meta (§4.3). */

export const metadata: Metadata = {
  title: "B-Systems",
  description: "B-Systems CRM and Partnership Portal — Systems Before Software.",
};

/* Every page here is auth-gated and DB-backed — render per request, NEVER at
   build time (a fresh container has no database while `next build` runs). */
export const dynamic = "force-dynamic";

/* Dark mode: the mobile browser chrome follows the theme cookie too (see
   themeColorFor — light emits nothing, exactly as before). */
export async function generateViewport() {
  return themeViewport();
}

export default async function BSystemsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  /* dark mode: data-theme is stamped HERE, on the server, so the document's
     first byte — and therefore its first paint — already carries the theme.
     Swept by src/lib/theme/theme-stamp.sweep.test.ts. */
  const theme = await getTheme();
  return (
    <html lang={locale} dir={dirFor(locale)} data-brand="bsystems" data-theme={theme}>
      <body className="min-h-screen bg-brand-surface text-brand-ink font-brand-body antialiased">
        <LocaleProvider locale={locale}><ThemeProvider theme={theme}>{children}</ThemeProvider></LocaleProvider>
      </body>
    </html>
  );
}
