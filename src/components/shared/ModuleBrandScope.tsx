"use client";

import { useSearchParams } from "next/navigation";
import { BrandLogo } from "@/components/shared/BrandLogo";

/* ADR-054, founder directive D — the MODULES wear each company's whole brand.
   Root layouts cannot read searchParams, so the brand is stamped client-side:
   this wrapper reads ?company= and re-stamps [data-brand] on a div around the
   entire shell (header + main). The token files scope by [data-brand] on ANY
   element, and custom properties re-resolve per element, so the nearest scope
   wins for the whole subtree. The wrapper re-applies the surface/ink/body-font
   utilities because those are painted on <body> (outside this scope) and would
   otherwise be inherited from the <html> default brand.

   accounting: company byteforce | bsystems (module default byteforce — the
   SPA's default tenant). vault: byteforce | bsystems | all → "all" wears the
   NEUTRAL scope (full token parity in src/themes/neutral.css). */

export type ModuleName = "accounting" | "vault";

export function moduleBrand(module: ModuleName, company: string | null): string {
  if (module === "accounting") return company === "bsystems" ? "bsystems" : "byteforce";
  return company === "byteforce" || company === "bsystems" ? company : "neutral";
}

export function ModuleBrandScope({
  module,
  children,
}: {
  module: ModuleName;
  children: React.ReactNode;
}) {
  const brand = moduleBrand(module, useSearchParams().get("company"));
  return (
    <div
      data-brand={brand}
      className="min-h-screen bg-brand-surface text-brand-ink font-brand-body antialiased"
    >
      {children}
    </div>
  );
}

/* The module header's mark follows the active company (founder directive D):
   the REAL logo of the branded company; the neutral view (company=all) wears
   the platform's two-mark home lockup instead. Always paired with the module
   wordmark. The VAULT no longer uses this: the founder pinned its header to
   the B-Systems mark outright (see the vault layout) — accounting still
   follows its company switcher here. */
export function ModuleLogo({ module, wordmark }: { module: ModuleName; wordmark: string }) {
  const brand = moduleBrand(module, useSearchParams().get("company"));
  return (
    <>
      {brand === "byteforce" ? (
        <BrandLogo brand="byteforce" height={26} />
      ) : brand === "bsystems" ? (
        <BrandLogo brand="bsystems" variant="mark" height={36} />
      ) : (
        <span className="flex items-center gap-1.5" aria-hidden>
          <span className="hub-mark-a" style={{ width: 22, height: 22 }} />
          <span className="hub-mark-b" style={{ width: 22, height: 22, fontSize: 11 }}>
            S
          </span>
        </span>
      )}
      <span className="wordmark">{wordmark}</span>
    </>
  );
}
