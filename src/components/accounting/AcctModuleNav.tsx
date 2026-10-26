"use client";

import { useSearchParams } from "next/navigation";
import { ShellNav } from "@/components/shared/ShellNav";
import { tFor } from "@/lib/i18n/core";
import { useLocale } from "@/components/shared/LocaleProvider";
import { accountingNavFor } from "@/lib/accounting/nav";
import { acctQuery, acctView } from "@/lib/accounting/params";
import type { Brand } from "@/lib/pipeline-engine/constants";

/* ADR-054 — the accounting module's OWN header nav: the SPA's eleven screens +
   Import. The list itself is lib/accounting/nav.ts (pure, so the one-way-in
   guard test reads the same list). Client-side because the links must carry
   the current ?company=&month= view — the layout is a server component and
   cannot read searchParams. Media Buying disappears ENTIRELY under
   company=bsystems (founder decision 5). Composes ShellNav — never a fork. */

export function AcctModuleNav({
  companies,
  extras,
}: {
  /* ADR-074 — the companies THIS ACCOUNT holds, handed down from the server.
     A client component cannot ask (it has only the URL and the roles are not in
     it), and it must never assume the module-level list. */
  companies: Brand[];
  extras?: React.ReactNode;
}) {
  const t = tFor(useLocale());
  const params = useSearchParams();
  const view = acctView(
    {
      company: params.get("company") ?? undefined,
      month: params.get("month") ?? undefined,
    },
    companies,
  );
  const items = accountingNavFor(view.company).map((s) => ({
    href: `${s.href}${acctQuery(view)}`,
    label: t(s.label),
  }));
  return <ShellNav items={items} extras={extras} />;
}
