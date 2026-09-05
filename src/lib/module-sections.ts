import type { Brand } from "@/lib/pipeline-engine/constants";

/* ============================================================================
   ADR-076 — WHICH SECTIONS OF A MODULE A COMPANY HAS.

   Founder, and the scope is in his first four words: "for mindoo and only
   mindoo — accounting should only be : dashborad income expenses clients loans
   tresury and import export / vault should only be : links and sheets and
   documents".

   So Accounting and the Data Vault are still ONE module each (ADR-054), still
   with a company filter (ADR-074) — what changes is that a company can now have
   FEWER SECTIONS of them. B-Systems and ByteForce are untouched and must stay
   that way: this table names Mindoo and falls through to "everything" for
   everyone else, so adding a company here can only ever subtract.

   IT IS A WALL, NOT A MENU. The nav reads this so the tabs disappear, and every
   removed page reads it too and redirects — otherwise the sections would still
   be one typed URL away, which is the difference between tidying a nav and
   deciding what a company has.
   ========================================================================== */

/** Section paths, as they appear in each module's nav. */
export const ACCT_SECTIONS = [
  "/accounting", // the dashboard — the module root, never removable
  "/accounting/income",
  "/accounting/expenses",
  "/accounting/clients",
  "/accounting/roster",
  "/accounting/media",
  "/accounting/loans",
  "/accounting/treasury",
  "/accounting/report",
  "/accounting/departments",
  "/accounting/targets",
  "/accounting/import", // Import AND Export live on this one screen
] as const;

export const VAULT_SECTIONS = [
  "/vault", // the overview — the module root, never removable
  "/vault/forms",
  "/vault/links",
  "/vault/sheets",
  "/vault/documents",
  "/vault/tasks",
  "/vault/employees",
  "/vault/archive",
] as const;

/* Mindoo's own lists, verbatim from the founder's message and in his order.
   Everything absent is absent BY INSTRUCTION, not by oversight. */
const MINDOO_ACCT: readonly string[] = [
  "/accounting",
  "/accounting/income",
  "/accounting/expenses",
  "/accounting/clients",
  "/accounting/loans",
  "/accounting/treasury",
  "/accounting/import",
];

const MINDOO_VAULT: readonly string[] = [
  "/vault",
  "/vault/links",
  "/vault/sheets",
  "/vault/documents",
  /* NOT in his three, and kept anyway — flagged for his confirmation.

     Nothing in this vault is ever hard-deleted (ADR-053, the reference BR-11):
     "delete" means ARCHIVE, and the Archive screen is the only way back. Drop
     this tab and removing a link becomes permanent in practice for Mindoo — a
     destructive change to the three sections he DID ask for, arrived at by
     subtraction. It is a view OVER his three rather than a fourth kind of
     record, which is why it reads as included rather than as a fourth thing. */
  "/vault/archive",
];

/** The accounting sections this company has, in nav order. */
export function acctSectionsFor(company: Brand): readonly string[] {
  return company === "mindoo" ? MINDOO_ACCT : ACCT_SECTIONS;
}

/** The vault sections this company has, in nav order. */
export function vaultSectionsFor(company: Brand): readonly string[] {
  return company === "mindoo" ? MINDOO_VAULT : VAULT_SECTIONS;
}

/** Does this company have this section? Used by the nav AND by the page. */
export function hasAcctSection(company: Brand, section: string): boolean {
  return acctSectionsFor(company).includes(section);
}

export function hasVaultSection(company: Brand, section: string): boolean {
  return vaultSectionsFor(company).includes(section);
}
