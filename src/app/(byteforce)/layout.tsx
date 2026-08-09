import type { Metadata } from "next";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/700.css";
import "../globals.css";
import "@/themes/design-system.css";

/* App A root layout — stamps data-brand="byteforce" on <html>, activating the
   ByteForce token scope (branding/byteforce/tokens.css). Lama Sans loads here via
   @font-face once the founder supplies files (A-13/ADR-013); the token fallback
   stack applies until then. */

export const metadata: Metadata = {
  title: "ByteForce CRM",
  description: "ByteForce sales pipeline — leads, CRM, clients.",
};

/* Every page here is auth-gated and DB-backed — render per request, NEVER at
   build time (a fresh container has no database while `next build` runs). */
export const dynamic = "force-dynamic";

export default function ByteForceLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-brand="byteforce">
      <body className="min-h-screen bg-brand-surface text-brand-ink font-brand-body antialiased">
        {children}
      </body>
    </html>
  );
}
