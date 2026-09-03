import Link from "next/link";
import { requireVaultPage } from "@/lib/auth/page-guards";
import { getLocale } from "@/lib/i18n/server";
import { tFor } from "@/lib/i18n/core";
import { vault } from "@/lib/i18n/dict/vault";
import { listVaultEmployeeCards } from "@/lib/services/vault/employees";
import {
  VAULT_COMPANIES,
  VAULT_COMPANY_LABELS,
  type VaultCompany,
} from "@/lib/services/vault/constants";
import { VaultHead } from "@/components/vault/VaultHead";
import { AddEmployeeButton, EmployeeActions } from "@/components/vault/forms";
import { vaultCompaniesOf } from "@/lib/services/vault/tenancy";

/* ADR-053 Phase 5 — employee CARDS: assignees, not accounts (founder §7.3).
   Deactivate-never-delete; a deactivated card keeps its history. Admin only. */

export async function generateMetadata() {
  const locale = await getLocale();
  return { title: tFor(locale)(vault.metaTitle) };
}

function markInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default async function VaultEmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ inactive?: string }>;
}) {
  const user = await requireVaultPage();
  /* ADR-074 — the companies this account may see (services/vault/tenancy). */
  const visible = vaultCompaniesOf(user);
  const locale = await getLocale();
  const t = tFor(locale);
  const { inactive } = await searchParams;
  const showInactive = inactive === "true";
  const cards = await listVaultEmployeeCards(visible, { includeInactive: showInactive });
  const companyLabel = (c: string | null) =>
    c === null
      ? t(vault.companyBoth)
      : (VAULT_COMPANIES as readonly string[]).includes(c)
        ? t(VAULT_COMPANY_LABELS[c as VaultCompany])
        : c;

  return (
    <div className="space-y-5">
      <VaultHead
        locale={locale}
        title={vault.employeesTitle}
        sub={vault.employeesSub}
      />

      <div className="page-actions">
        <AddEmployeeButton />
        <Link
          href={showInactive ? "/vault/employees" : "/vault/employees?inactive=true"}
          className="btn-ghost"
          aria-current={showInactive ? "true" : undefined}
        >
          {t(vault.showInactive)}
        </Link>
      </div>

      {cards.length === 0 ? (
        <section className="card card-pad">
          <p className="empty">{t(vault.noEmployees)}</p>
        </section>
      ) : (
        <div className="ecard-grid">
          {cards.map((c) => (
            <div key={c.id} className="ecard cursor-default">
              <span className="ecard-top">
                <span className="ecard-mark" aria-hidden="true">
                  {markInitials(c.name)}
                </span>
                {c.active ? null : (
                  <span className="badge badge--archived">{t(vault.inactiveBadge)}</span>
                )}
              </span>
              <span className="ecard-title">{c.name}</span>
              <span className="ecard-sub">
                {c.title ?? "—"} · {companyLabel(c.company)}
              </span>
              <span className="ecard-stats">
                <span>
                  <span className="ecard-stat-label block">{t(vault.openCount)}</span>
                  <span className="ecard-stat-value block">{c.openCount}</span>
                </span>
                <span>
                  <span className="ecard-stat-label block">{t(vault.overdueCount)}</span>
                  <span
                    className={
                      c.overdueCount > 0
                        ? "ecard-stat-value block text-brand-danger"
                        : "ecard-stat-value block"
                    }
                  >
                    {c.overdueCount}
                  </span>
                </span>
                <span>
                  <span className="ecard-stat-label block">{t(vault.completedCount)}</span>
                  <span className="ecard-stat-value block">{c.completedCount}</span>
                </span>
              </span>
              <span className="ecard-footer">
                <EmployeeActions
                  row={{
                    id: c.id,
                    name: c.name,
                    title: c.title,
                    company: c.company,
                    active: c.active,
                  }}
                />
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
