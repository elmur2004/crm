import { requireVaultPage } from "@/lib/auth/page-guards";
import { getLocale } from "@/lib/i18n/server";
import { tFor, type Msg } from "@/lib/i18n/core";
import { vault } from "@/lib/i18n/dict/vault";
import { formatCairo } from "@/lib/datetime";
import { listVaultForms } from "@/lib/services/vault/forms";
import { listVaultSheets } from "@/lib/services/vault/sheets";
import { listVaultDocuments } from "@/lib/services/vault/documents";
import { listVaultTasks } from "@/lib/services/vault/tasks";
import {
  VAULT_COMPANIES,
  VAULT_COMPANY_LABELS,
  type VaultCompany,
} from "@/lib/services/vault/constants";
import { VaultHead } from "@/components/vault/VaultHead";
import { ArchiveButton } from "@/components/shared/ArchiveButton";

/* ADR-053 Phase 5 — the archive: nothing in the vault is deleted, ever.
   Four per-kind sections, each row restorable in one click. Admin only. */

export async function generateMetadata() {
  const locale = await getLocale();
  return { title: tFor(locale)(vault.metaTitle) };
}

type ArchivedRow = {
  id: string;
  name: string;
  company: string | null;
  archivedAt: Date | null;
  restoreUrl: string;
};

export default async function VaultArchivePage() {
  await requireVaultPage();
  const locale = await getLocale();
  const t = tFor(locale);

  const [forms, sheets, documents, tasks] = await Promise.all([
    listVaultForms({ archived: true }),
    listVaultSheets({ archived: true }),
    listVaultDocuments({ archived: true }),
    listVaultTasks({ archived: true }),
  ]);

  const sections: Array<{ label: Msg; rows: ArchivedRow[] }> = [
    {
      label: vault.tabForms,
      rows: forms.map((f) => ({
        id: f.id,
        name: f.name,
        company: f.company,
        archivedAt: f.archivedAt,
        restoreUrl: `/api/vault/forms/${f.id}/archive`,
      })),
    },
    {
      label: vault.tabSheets,
      rows: sheets.map((s) => ({
        id: s.id,
        name: s.name,
        company: s.company,
        archivedAt: s.archivedAt,
        restoreUrl: `/api/vault/sheets/${s.id}/archive`,
      })),
    },
    {
      label: vault.tabDocuments,
      rows: documents.map((d) => ({
        id: d.id,
        name: d.name,
        company: d.company,
        archivedAt: d.archivedAt,
        restoreUrl: `/api/vault/documents/${d.id}/archive`,
      })),
    },
    {
      label: vault.tabTasks,
      rows: tasks.map((task) => ({
        id: task.id,
        name: task.name,
        company: task.company,
        archivedAt: task.archivedAt,
        restoreUrl: `/api/vault/tasks/${task.id}/archive`,
      })),
    },
  ];

  const companyLabel = (c: string | null) =>
    c === null
      ? t(vault.companyBoth)
      : (VAULT_COMPANIES as readonly string[]).includes(c)
        ? t(VAULT_COMPANY_LABELS[c as VaultCompany])
        : c;

  const total = sections.reduce((s, x) => s + x.rows.length, 0);

  return (
    <div className="space-y-5">
      <VaultHead locale={locale} title={vault.archiveTitle} sub={vault.archiveSub} />

      {total === 0 ? (
        <section className="card card-pad">
          <p className="empty">{t(vault.archiveEmpty)}</p>
        </section>
      ) : (
        sections.map((section) =>
          section.rows.length === 0 ? null : (
            <section key={section.label.en} className="card card--flush0">
              <div className="card-pad">
                <h2 className="u-h3">
                  {t(section.label)}{" "}
                  <span className="count-pill">{section.rows.length}</span>
                </h2>
              </div>
              <div className="table-scroll">
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t(vault.name)}</th>
                      <th>{t(vault.company)}</th>
                      <th>{t(vault.archivedOn)}</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {section.rows.map((row) => (
                      <tr key={row.id}>
                        <td className="td-title">
                          {row.name} <span className="badge badge--archived">{t(vault.archivedBadge)}</span>
                        </td>
                        <td>
                          <span className="chip-outline">{companyLabel(row.company)}</span>
                        </td>
                        <td className="td-mono u-ltr">{formatCairo(row.archivedAt, locale)}</td>
                        <td>
                          <ArchiveButton postUrl={row.restoreUrl} archived={true} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ),
        )
      )}
    </div>
  );
}
