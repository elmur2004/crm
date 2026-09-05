"use client";

import { useSearchParams } from "next/navigation";
import { ShellNav } from "@/components/shared/ShellNav";
import { tFor, type Msg } from "@/lib/i18n/core";
import { useLocale } from "@/components/shared/LocaleProvider";
import { vault } from "@/lib/i18n/dict/vault";
import { VAULT_COMPANIES } from "@/lib/services/vault/constants";
import { hasVaultSection } from "@/lib/module-sections";
import type { Brand } from "@/lib/pipeline-engine/constants";

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

export function VaultModuleNav({
  /* ADR-076 — the company whose sections to offer, resolved on the SERVER from
     the account's own roles. Read from the URL it would be a request rather
     than a fact: `?company=` is a filter here and an account that holds one
     company sees that company whatever the query says (ADR-074). */
  company,
  extras,
}: {
  company: Brand;
  extras?: React.ReactNode;
}) {
  const t = tFor(useLocale());
  const params = useSearchParams();
  const asked = params.get("company") ?? "";
  const suffix = (VAULT_COMPANIES as readonly string[]).includes(asked) ? `?company=${asked}` : "";
  /* founder: "for mindoo and only mindoo — vault should only be : links and
     sheets and documents". Every other company falls through to the full list. */
  const items = SECTIONS.filter((s) => hasVaultSection(company, s.href)).map((s) => ({
    href: `${s.href}${suffix}`,
    label: t(s.label),
  }));
  return <ShellNav items={items} extras={extras} />;
}
