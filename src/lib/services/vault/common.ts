import { z } from "zod";
import { VAULT_COMPANIES } from "./constants";

/* ADR-053 — shared vault validation atoms (the reference app's common.ts,
   re-expressed in house Zod). */

/**
 * The reference BR-01 — a form/link URL must be a well-formed http or https
 * address. `new URL()` alone happily accepts ftp://, javascript: and mailto:,
 * so the protocol is checked explicitly.
 */
export const zHttpUrl = z
  .string()
  .trim()
  .min(1, "Enter a web address.")
  .max(2048, "That address is too long.")
  .superRefine((value, ctx) => {
    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      ctx.addIssue({
        code: "custom",
        message: "Enter a full web address, starting with http:// or https://",
      });
      return;
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      ctx.addIssue({
        code: "custom",
        message: `Only http and https addresses work here — this one starts with ${parsed.protocol.replace(":", "")}.`,
      });
    }
    if (!parsed.hostname) {
      ctx.addIssue({ code: "custom", message: "That address has no domain name." });
    }
  });

export const zVaultCompany = z.enum(VAULT_COMPANIES);

/** "YYYY-MM-DD" calendar string (the module's date convention, ADR-052 §1). */
export const zVaultDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date picker.");

/** Optional free text that stores NULL rather than "" so filters stay honest. */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));

/** Shared list filters — search + company + archived view. Bad values fall
    back rather than 400 on a LIST (the reference's .catch pattern). */
export const vaultListParams = z.object({
  q: z.string().trim().max(200).optional().catch(undefined),
  company: zVaultCompany.optional().catch(undefined),
  archived: z.coerce.boolean().catch(false),
});
export type VaultListParams = z.infer<typeof vaultListParams>;

/** Result-link shape stored on VaultTask.resultLinks (JSON array). */
export const zResultLink = z.object({
  url: zHttpUrl,
  label: z.string().trim().max(160).nullish(),
});
export type ResultLink = { url: string; label: string | null };

export function parseResultLinks(json: string): ResultLink[] {
  try {
    const raw = JSON.parse(json) as unknown;
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((x): x is { url: string; label?: unknown } => Boolean(x && typeof x === "object" && typeof (x as { url?: unknown }).url === "string"))
      .map((x) => ({ url: x.url, label: typeof x.label === "string" ? x.label : null }));
  } catch {
    return [];
  }
}
