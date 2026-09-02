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
  /* ADR-073 — Mindoo has no brand yet, and does not need one: the founder's
     rule since ADR-067 is that the CHROME never changes when you switch company
     ("I don't need the entire interface to change"), so a Mindoo lead is read
     inside the B-Systems shell exactly as a ByteForce one is. Both slots are
     null, which is the documented "typographic fallback" state this map was
     built to express — not a gap. The wordmark is the only thing anybody sees,
     and it is his own name for the company. */
  mindoo: {
    logoHorizontal: null,
    logoMark: null,
    wordmark: "MINDOO",
    tagline: "",
  },
};
