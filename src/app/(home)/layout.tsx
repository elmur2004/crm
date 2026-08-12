import { dirFor } from "@/lib/i18n/core";
import { getLocale } from "@/lib/i18n/server";
import { LocaleProvider } from "@/components/shared/LocaleProvider";
import type { Metadata } from "next";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/700.css";
import "@fontsource/raleway/700.css";
import "@fontsource/raleway/800.css";
import "../globals.css";
import "@/themes/design-system.css";
import "@/themes/neutral.css";

/* Root layout for the brand-neutral entry only (ADR-007). There is deliberately
   NO top-level src/app/layout.tsx: each route group owns its <html> element so the
   brand groups can stamp <html data-brand="…">. The neutral shell stamps its OWN
   scope (design round: docs/DESIGN-APPLICATION-SPEC.md §1.1) so the shared token
   contract also resolves here. Raleway/mono load for the login billboard + hub
   marks (brand billboards, spec §2.14). */
export const metadata: Metadata = {
  title: "ByteForce × B-Systems Sales Platform",
  description:
    "One platform, two brands: ByteForce CRM and the B-Systems CRM with its partnership programme.",
};

/* Render per request — the build environment has no database (login reads
   searchParams; the redirect root is trivially cheap). */
export const dynamic = "force-dynamic";

export default async function HomeLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  return (
    <html lang={locale} dir={dirFor(locale)} data-brand="neutral">
      <body><LocaleProvider locale={locale}>{children}</LocaleProvider></body>
    </html>
  );
}
