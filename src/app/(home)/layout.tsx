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

export default function HomeLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-brand="neutral">
      <body>{children}</body>
    </html>
  );
}
