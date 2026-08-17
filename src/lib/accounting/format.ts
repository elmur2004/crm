import type { Locale } from "@/lib/i18n/core";

/** "2026-08" → "August 2026" / "أغسطس 2026" (display only). */
export function monthLabel(month: string, locale: Locale): string {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return month;
  return new Date(y, m - 1, 1).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-US", {
    month: "long",
    year: "numeric",
  });
}
