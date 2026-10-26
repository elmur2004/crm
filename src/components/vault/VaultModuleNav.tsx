"use client";

import { useSearchParams } from "next/navigation";
import { ShellNav } from "@/components/shared/ShellNav";
import { tFor } from "@/lib/i18n/core";
import { useLocale } from "@/components/shared/LocaleProvider";
import { VAULT_COMPANIES } from "@/lib/services/vault/constants";
import { VAULT_SECTIONS } from "@/lib/services/vault/nav";

/* ADR-054 — the vault module's OWN header nav: Overview plus the sections
   (lib/services/vault/nav.ts — pure, so the one-way-in guard test reads the
   same list). Client-side because the links preserve the ?company= filter —
   the brand follows it (directive D), so navigating between sections must not
   drop it. Composes ShellNav. */

export function VaultModuleNav({ extras }: { extras?: React.ReactNode }) {
  const t = tFor(useLocale());
  const params = useSearchParams();
  const asked = params.get("company") ?? "";
  const suffix = (VAULT_COMPANIES as readonly string[]).includes(asked) ? `?company=${asked}` : "";
  /* ADR-080 — every company has every section again: the per-company table this
     used to filter through existed only to subtract Mindoo's. */
  const items = VAULT_SECTIONS.map((s) => ({ href: `${s.href}${suffix}`, label: t(s.label) }));
  return <ShellNav items={items} extras={extras} />;
}
