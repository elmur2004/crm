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
import "@/themes/neutral.css";
/* the system-wide glass + motion layer (after design-system / neutral) */
import "@/themes/glass.css";
import "@/themes/motion.css";
/* the module page bodies (Accounting + the Data Vault): their entrance, the
   ledger rows' add / edit / delete feedback, the period cross-fade, the
   grouped ledgers, the empty-state drawings — after the foundation layer */
import "@/themes/modules.css";

/* Data Vault MODULE root layout (founder directive A / ADR-054): the vault is
   a peer of the two CRMs on the module switcher. Company is a per-list FILTER
   (byteforce | bsystems | all): the shell re-stamps [data-brand] to the single
   company's scope, and "all" wears the NEUTRAL scope (full token parity in
   src/themes/neutral.css) — hence the neutral import and the neutral default
   on <html>. All brands' font stacks load here. */

export const metadata: Metadata = {
  title: "Data Vault",
  description: "ByteForce × B-Systems data vault — forms, sheets, documents and tasks.",
};

/* Every page here is auth-gated and DB-backed — render per request, NEVER at
   build time (a fresh container has no database while `next build` runs). */
export const dynamic = "force-dynamic";

/* Dark mode: the mobile browser chrome follows the theme cookie too (see
   themeColorFor — light emits nothing, exactly as before). */
export async function generateViewport() {
  return themeViewport();
}

export default async function VaultRootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  /* dark mode: data-theme is stamped HERE, on the server, so the document's
     first byte — and therefore its first paint — already carries the theme.
     Swept by src/lib/theme/theme-stamp.sweep.test.ts. */
  const theme = await getTheme();
  return (
    <html lang={locale} dir={dirFor(locale)} data-brand="neutral" data-theme={theme}>
      <body className="min-h-screen bg-brand-surface text-brand-ink font-brand-body antialiased">
        <LocaleProvider locale={locale}><ThemeProvider theme={theme}>{children}</ThemeProvider></LocaleProvider>
      </body>
    </html>
  );
}
