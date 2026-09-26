import type { Brand } from "@/lib/pipeline-engine/constants";

/* Per-brand asset map (ADR-006). Canonical files live in branding/; the served
   copies sit in public/brand/ (kept in sync by scripts — never reference branding/
   paths from components, and never a missing slot: null renders the typographic
   fallback). Founder still owes: B-Systems horizontal/stacked/mono lockups,
   ByteForce mark/mono versions, Lama Sans font files (A-13). */

export interface BrandAssets {
  /** primary horizontal lockup for light surfaces */
  logoHorizontal: string | null;
  /** compact mark for favicon/avatar/squares */
  logoMark: string | null;
  wordmark: string; // typographic fallback text
  tagline: string;
}

export const BRAND_ASSETS: Record<Brand, BrandAssets> = {
  byteforce: {
    logoHorizontal: "/brand/byteforce/logo-horizontal.png",
    logoMark: null, // pending from founder
    wordmark: "BYTE FORCE",
    tagline: "BY TELLING FORCE",
  },
  bsystems: {
    logoHorizontal: null, // pending from founder — mark + wordmark composed instead
    logoMark: "/brand/b-systems/logo-mark.png",
    wordmark: "SYSTEMS",
    tagline: "COMPLETE YOUR PROCESS",
  },
};
