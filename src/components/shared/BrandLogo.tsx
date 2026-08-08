import { BRAND_ASSETS } from "@/themes/assets";
import type { Brand } from "@/lib/pipeline-engine/constants";

/* Brand-aware logo slot (ADR-006). Missing founder assets render the typographic
   fallback — never a broken image, never a hardcoded color. */

export function BrandLogo({
  brand,
  variant = "horizontal",
  height = 40,
}: {
  brand: Brand;
  variant?: "horizontal" | "mark";
  height?: number;
}) {
  const assets = BRAND_ASSETS[brand];
  const src = variant === "mark" ? assets.logoMark : (assets.logoHorizontal ?? assets.logoMark);

  if (src) {
    /* Plain img: the founder PNGs are small static assets; a fixed height with
       auto width preserves the lockup's aspect ratio (never stretch — §4). */
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img src={src} alt={`${assets.wordmark} logo`} style={{ height, width: "auto" }} />
    );
  }
  return (
    <span className="font-brand-display text-brand-heading font-bold tracking-tight text-xl">
      {assets.wordmark}
    </span>
  );
}
