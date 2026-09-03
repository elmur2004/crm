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

/* ADR-074 — a TABLE, for the reason every ternary in this codebase became one
   when Mindoo arrived: `a === "x" ? p : q` is total with two values and a
   trapdoor with three. Both of these fell through to ByteForce / neutral, so a
   Mindoo account would have read its own books under ByteForce's colours —
   which is not a cosmetic bug, it is the module telling him he is looking at
   another company. */
const MODULE_BRANDS: readonly string[] = ["byteforce", "bsystems", "mindoo"];

export function moduleBrand(
  module: ModuleName,
  company: string | null,
  /* ADR-074 — the brand to wear when the URL names no company. It is a PROP
     from the server, not a literal, because the answer depends on the account:
     accounting always shows ONE company's books, and for Mindoo's administrator
     that company is Mindoo. Hardcoded to ByteForce, his own books opened under
     another company's colours — the module telling him he is looking at
     somebody else's money, which is worse than a cosmetic bug.

     The vault can show several companies at once and wears the NEUTRAL scope
     for that mixed view, so its fallback is "neutral" — except for an account
     that holds exactly one company, where the mixed view IS that company. Both
     of those are decided on the server; this function only obeys. */
  fallback: string,
  /* ADR-074 — the companies this ACCOUNT holds, from the server.

     This function used to trust `?company=` on its own, and the SERVER does
     not: `resolveModuleCompany` returns the account's own default for a company
     it does not hold. So `/accounting?company=mindoo` opened as a B-Systems
     admin showed ByteForce's books — correctly — inside a Mindoo-branded shell
     with Mindoo's mark on it, while the switcher underneath marked ByteForce as
     current. The screen contradicted itself, and it did the more alarming thing
     too: it labelled one company's money with another company's name.

     Not an access hole — the API wall 404s an unheld company either way — but
     exactly the failure lib/module-companies.ts names in its own docblock:
     "rendering a company's rows under another company's label." The rule is
     simply that the chrome answers the same question the server did, which
     means it needs the same input. */
  allowed: readonly string[],
): string {
  if (company && MODULE_BRANDS.includes(company) && allowed.includes(company)) return company;
  void module;
  return fallback;
}

export function ModuleBrandScope({
  module,
  fallback,
  allowed,
  children,
}: {
  module: ModuleName;
  /** the brand to wear when the URL names no company — see `moduleBrand` */
  fallback: string;
  /** the companies this account holds — see `moduleBrand` */
  allowed: readonly string[];
  children: React.ReactNode;
}) {
  const brand = moduleBrand(module, useSearchParams().get("company"), fallback, allowed);
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
export function ModuleLogo({
  module,
  fallback,
  allowed,
  wordmark,
}: {
  module: ModuleName;
  fallback: string;
  allowed: readonly string[];
  wordmark: string;
}) {
  const brand = moduleBrand(module, useSearchParams().get("company"), fallback, allowed);
  return (
    <>
      {brand === "byteforce" ? (
        <BrandLogo brand="byteforce" height={26} />
      ) : brand === "bsystems" ? (
        <BrandLogo brand="bsystems" variant="mark" height={36} />
      ) : brand === "mindoo" ? (
        /* ADR-074 — Mindoo's typographic fallback (themes/assets.ts), which is
           the documented state for a brand whose files the founder has not
           supplied, not a gap. */
        <BrandLogo brand="mindoo" variant="mark" height={36} />
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
