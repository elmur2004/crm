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

/* Accounting MODULE root layout (founder directive A / ADR-054): accounting is
   a peer of the two CRMs on the module switcher, not a B-Systems page. The
   <html> default is the ByteForce scope — the SPA's default tenant (directive
   D) — and the shell re-stamps [data-brand] per the ?company= filter, so the
   module wears each company's full brand. Both brands' font stacks load here
   (ByteForce's Lama Sans falls back per ADR-013 until the founder ships files;
   Raleway/Inter/JetBrains serve the B-Systems scope). */

export const metadata: Metadata = {
  title: "Accounting",
  description: "ByteForce × B-Systems accounting — both companies' books, one module.",
};

/* Every page here is auth-gated and DB-backed — render per request, NEVER at
   build time (a fresh container has no database while `next build` runs). */
export const dynamic = "force-dynamic";

export default async function AccountingRootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  return (
    <html lang={locale} dir={dirFor(locale)} data-brand="byteforce">
      <body className="min-h-screen bg-brand-surface text-brand-ink font-brand-body antialiased">
        <LocaleProvider locale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
