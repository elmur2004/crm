import Link from "next/link";
import { tFor, type Locale, type Msg } from "@/lib/i18n/core";
import { vault } from "@/lib/i18n/dict/vault";

/* ADR-053 Phase 5 — the shared vault page chrome: eyebrow/title/sub plus the
   tab strip (the AcctHead/AcctNav pattern). Company is a per-list FILTER, not
   a view switcher, so the head carries no controls. Composed from existing
   design-system classes only. */

export type VaultTab =
  | "overview"
  | "forms"
  | "sheets"
  | "documents"
  | "tasks"
  | "employees"
  | "archive";

const TABS: Array<{ id: VaultTab; href: string; label: Msg }> = [
  { id: "overview", href: "/b-systems/vault", label: vault.tabOverview },
  { id: "forms", href: "/b-systems/vault/forms", label: vault.tabForms },
  { id: "sheets", href: "/b-systems/vault/sheets", label: vault.tabSheets },
  { id: "documents", href: "/b-systems/vault/documents", label: vault.tabDocuments },
  { id: "tasks", href: "/b-systems/vault/tasks", label: vault.tabTasks },
  { id: "employees", href: "/b-systems/vault/employees", label: vault.tabEmployees },
  { id: "archive", href: "/b-systems/vault/archive", label: vault.tabArchive },
];

export function VaultNav({ tab, locale }: { tab: VaultTab; locale: Locale }) {
  const t = tFor(locale);
  return (
    <nav className="card card-pad flex flex-wrap gap-1" aria-label={t(vault.navItem)}>
      {TABS.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          className="nav-item"
          aria-current={item.id === tab ? "page" : undefined}
        >
          {t(item.label)}
        </Link>
      ))}
    </nav>
  );
}

export function VaultHead({
  tab,
  locale,
  title,
  sub,
}: {
  tab: VaultTab;
  locale: Locale;
  title: Msg;
  sub?: Msg;
}) {
  const t = tFor(locale);
  return (
    <>
      <div className="page-head">
        <div>
          <p className="u-eyebrow">{t(vault.eyebrow)}</p>
          <h1 className="u-h1">{t(title)}</h1>
          {sub ? <p className="u-sub">{t(sub)}</p> : null}
        </div>
      </div>
      <VaultNav tab={tab} locale={locale} />
    </>
  );
}
