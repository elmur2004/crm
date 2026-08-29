"use client";

import { useSearchParams } from "next/navigation";
import { ShellNav } from "@/components/shared/ShellNav";
import { tFor, type Msg } from "@/lib/i18n/core";
import { useLocale } from "@/components/shared/LocaleProvider";
import { vault } from "@/lib/i18n/dict/vault";
import { VAULT_COMPANIES } from "@/lib/services/vault/constants";

/* ADR-054 — the vault module's OWN header nav: Overview plus the sections —
   seven since ADR-070 added Links — in the app shell (the module is a switcher
   peer now). Client-side because
   the links preserve the ?company= filter — the brand follows it (directive D),
   so navigating between sections must not drop it. Composes ShellNav. */

const SECTIONS: Array<{ href: string; label: Msg }> = [
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

export function VaultModuleNav({ extras }: { extras?: React.ReactNode }) {
  const t = tFor(useLocale());
  const params = useSearchParams();
  const company = params.get("company") ?? "";
  const suffix = (VAULT_COMPANIES as readonly string[]).includes(company)
    ? `?company=${company}`
    : "";
  const items = SECTIONS.map((s) => ({ href: `${s.href}${suffix}`, label: t(s.label) }));
  return <ShellNav items={items} extras={extras} />;
}
