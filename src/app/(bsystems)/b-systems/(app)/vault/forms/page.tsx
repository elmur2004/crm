import { requireBsAdminPage } from "@/lib/auth/page-guards";
import { getLocale } from "@/lib/i18n/server";
import { tFor } from "@/lib/i18n/core";
import { vault } from "@/lib/i18n/dict/vault";
import { formatCairoDate } from "@/lib/datetime";
import { listVaultForms, vaultFormListParams } from "@/lib/services/vault/forms";
import {
  VAULT_COMPANIES,
  VAULT_COMPANY_LABELS,
  type VaultCompany,
} from "@/lib/services/vault/constants";
import { VaultHead } from "@/components/bsystems/vault/VaultHead";
import { AddFormButton, EditFormButton } from "@/components/bsystems/vault/forms";
import { ArchiveButton } from "@/components/shared/ArchiveButton";

/* ADR-053 Phase 5 — vault forms: named links, duplicate URLs flagged (409
   handshake in the modal), archive-not-delete. Admin only. */

export async function generateMetadata() {
  const locale = await getLocale();
  return { title: tFor(locale)(vault.metaTitle) };
}

export default async function VaultFormsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireBsAdminPage();
  const locale = await getLocale();
  const t = tFor(locale);
  const params = vaultFormListParams.parse(await searchParams);
  const rows = await listVaultForms(params);
  const companyLabel = (c: string) =>
    (VAULT_COMPANIES as readonly string[]).includes(c)
      ? t(VAULT_COMPANY_LABELS[c as VaultCompany])
      : c;

  return (
    <div className="space-y-5">
      <VaultHead tab="forms" locale={locale} title={vault.formsTitle} sub={vault.formsSub} />

      <div className="page-actions">
        <AddFormButton />
      </div>

      <form method="get" className="card card-pad flex flex-wrap gap-3 items-end">
        <label className="field">
          <span className="field-label">{t(vault.searchShort)}</span>
          <input className="field-input" name="q" defaultValue={params.q ?? ""} maxLength={200} />
        </label>
        <label className="field">
          <span className="field-label">{t(vault.company)}</span>
          <select className="field-input" name="company" defaultValue={params.company ?? ""}>
            <option value="">{t(vault.all)}</option>
            {VAULT_COMPANIES.map((c) => (
              <option key={c} value={c}>
                {t(VAULT_COMPANY_LABELS[c])}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn-ghost">
          {t(vault.apply)}
        </button>
      </form>

      <section className="card card--flush0">
        {rows.length === 0 ? (
          <p className="empty m-4">{t(vault.noForms)}</p>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>{t(vault.name)}</th>
                  <th>{t(vault.company)}</th>
                  <th>{t(vault.url)}</th>
                  <th>{t(vault.notes)}</th>
                  <th>{t(vault.added)}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((f) => (
                  <tr key={f.id}>
                    <td className="td-title">{f.name}</td>
                    <td>
                      <span className="chip-outline">{companyLabel(f.company)}</span>
                    </td>
                    <td>
                      <a href={f.url} target="_blank" rel="noreferrer" className="chat-mention">
                        {t(vault.open)}
                      </a>
                    </td>
                    <td>{f.notes ?? "—"}</td>
                    <td className="td-mono u-ltr">{formatCairoDate(f.createdAt)}</td>
                    <td>
                      <span className="inline-flex items-center gap-2 flex-wrap">
                        <EditFormButton
                          row={{
                            id: f.id,
                            company: f.company,
                            name: f.name,
                            url: f.url,
                            notes: f.notes,
                          }}
                        />
                        <ArchiveButton
                          postUrl={`/api/b-systems/vault/forms/${f.id}/archive`}
                          archived={false} confirmText={t(vault.confirmArchive)}
                        />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
