import Image from "next/image";
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
    return (
      <Image
        src={src}
        alt={`${assets.wordmark} logo`}
        height={height}
        width={Math.round(height * (variant === "mark" ? 1 : 3))}
        style={{ height, width: "auto" }}
        priority
      />
    );
  }
  return (
    <span className="font-brand-display text-brand-secondary font-bold tracking-tight text-xl">
      {assets.wordmark}
    </span>
  );
}
