/* The ONLY money converter/formatter (ADR-018, A-9). All persisted amounts are
   integer piasters (EGP minor units). Zod caps values at Int32. */

export const CURRENCY = "EGP" as const; // A-9 — configurable constant

export const MAX_PIASTERS = 2_147_483_647; // Int32 cap ≈ 21.4M EGP (ADR-018)

/** "1500.50" | 1500.5 → 150050 piasters. Throws on negatives/overflow/NaN. */
export function toPiasters(pounds: number | string): number {
  const n = typeof pounds === "string" ? Number(pounds.replace(/,/g, "")) : pounds;
  if (!Number.isFinite(n) || n < 0) throw new Error(`Invalid money amount: ${pounds}`);
  const piasters = Math.round(n * 100);
  if (piasters > MAX_PIASTERS) throw new Error(`Amount exceeds cap: ${pounds}`);
  return piasters;
}

/** 150050 → 1500.5 */
export function toPounds(piasters: number): number {
  return piasters / 100;
}

/** 150050 → "EGP 1,500.50" (no decimals shown for whole amounts) */
export function formatEGP(piasters: number | null | undefined): string {
  const p = piasters ?? 0;
  const pounds = p / 100;
  const hasFraction = p % 100 !== 0;
  return `${CURRENCY} ${pounds.toLocaleString("en-EG", {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

/** Dashboard sums treat missing as 0 (SPEC §6.5). */
export function sumPiasters(values: Array<number | null | undefined>): number {
  return values.reduce<number>((acc, v) => acc + (v ?? 0), 0);
}
