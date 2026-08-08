import type { Metadata } from "next";
import "../globals.css";
import "@/themes/neutral.css";

/* Root layout for the brand-neutral entry only (ADR-007). There is deliberately
   NO top-level src/app/layout.tsx: each route group owns its <html> element so the
   brand groups can stamp <html data-brand="…">, which the :root[data-brand]-scoped
   tokens in branding/ require (ARCHITECTURE.md §6). */
export const metadata: Metadata = {
  title: "ByteForce × B-Systems Sales Platform",
  description:
    "One platform, two brands, three applications: ByteForce CRM, B-Systems CRM, B-Systems Partnership Portal.",
};

export default function HomeLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
