import type { Msg } from "@/lib/i18n/core";
import { vault } from "@/lib/i18n/dict/vault";

/* ADR-054 — the Data Vault module's OWN menu: Overview plus the sections —
   seven since ADR-070 added Links. Pure (no React), so the one-way-in guard
   (lib/launcher/menus.ts) reads the very list VaultModuleNav renders. */

export interface VaultNavItem {
  href: string;
  label: Msg;
}

export const VAULT_SECTIONS: readonly VaultNavItem[] = [
  { href: "/vault", label: vault.tabOverview },
  { href: "/vault/forms", label: vault.tabForms },
  /* ADR-070 — Links sits beside Forms because they are the same kind of thing:
     a named URL with a company on it. */
  { href: "/vault/links", label: vault.tabLinks },
  { href: "/vault/sheets", label: vault.tabSheets },
  { href: "/vault/documents", label: vault.tabDocuments },
  { href: "/vault/tasks", label: vault.tabTasks },
  { href: "/vault/employees", label: vault.tabEmployees },
  { href: "/vault/archive", label: vault.tabArchive },
];
