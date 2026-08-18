import { dirFor } from "@/lib/i18n/core";
import { getLocale } from "@/lib/i18n/server";
import { LocaleProvider } from "@/components/shared/LocaleProvider";
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

export default async function VaultRootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  return (
    <html lang={locale} dir={dirFor(locale)} data-brand="neutral">
      <body className="min-h-screen bg-brand-surface text-brand-ink font-brand-body antialiased">
        <LocaleProvider locale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
