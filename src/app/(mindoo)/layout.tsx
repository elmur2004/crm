import { dirFor } from "@/lib/i18n/core";
import { getLocale } from "@/lib/i18n/server";
import { LocaleProvider } from "@/components/shared/LocaleProvider";
import type { Metadata } from "next";
import "@fontsource/montserrat/400.css";
import "@fontsource/montserrat/500.css";
import "@fontsource/montserrat/600.css";
import "@fontsource/montserrat/700.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/700.css";
import "../globals.css";
import "@/themes/design-system.css";

/* ADR-074 — Mindoo's ROOT layout: its own <html>, its own brand scope.

   Founder: "the system opens with @mindoo brandguidline new 6.pdf branding".
   `data-brand="mindoo"` is the whole of that instruction in code — it activates
   branding/mindoo/tokens.css, and every component in the tree is already
   token-driven (SPEC §4, zero hardcoded colours), so the entire app changes
   skin without a single component knowing which company it is drawing.

   MONTSERRAT is the guideline's text face and is self-hosted here under the
   literal family name the token references. MONOTALIC is its display face and
   the files have not been supplied, so `--font-display` names it first and
   falls through to Montserrat: the day the .woff2 lands in branding/mindoo and
   is served, every heading changes with no code edit. Same arrangement
   ByteForce's Lama Sans has had since A-13 — the token is the seam.

   The LOGIN PAGE is deliberately not in this group. Founder: "the system log in
   page should stay exactly the same don't mention mindoo their." One sign-in
   for every app (ADR-028) means one unbranded door; which company you land in
   is decided by your roles afterwards, in `landingFor`. */

export const metadata: Metadata = {
  title: "Mindoo",
  description: "Mindoo CRM.",
};

/* Every page here is auth-gated and DB-backed — render per request, NEVER at
   build time (a fresh container has no database while `next build` runs). */
export const dynamic = "force-dynamic";

export default async function MindooRootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  return (
    <html lang={locale} dir={dirFor(locale)} data-brand="mindoo">
      <body className="min-h-screen bg-brand-surface text-brand-ink font-brand-body antialiased">
        <LocaleProvider locale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
