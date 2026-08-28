import { requireVaultPage } from "@/lib/auth/page-guards";
import { getLocale } from "@/lib/i18n/server";
import { tFor } from "@/lib/i18n/core";
import { vault } from "@/lib/i18n/dict/vault";
import { formatCairoDate } from "@/lib/datetime";
import { listVaultDocuments, vaultDocumentListParams } from "@/lib/services/vault/documents";
import {
  VAULT_COMPANIES,
  VAULT_COMPANY_LABELS,
  VAULT_DOCUMENT_TYPE_LABELS,
  VAULT_DOCUMENT_TYPES,
  type VaultCompany,
  type VaultDocumentType,
} from "@/lib/services/vault/constants";
import { VaultHead } from "@/components/vault/VaultHead";
import {
  AddDocumentButton,
  EditDocumentButton,
  ReplaceFileButton,
} from "@/components/vault/forms";
import { ArchiveButton } from "@/components/shared/ArchiveButton";

/* ADR-053 Phase 5 — vault documents: the file itself, typed and filed;
   replacement appends a version. Admin only. */

export async function generateMetadata() {
  const locale = await getLocale();
  return { title: tFor(locale)(vault.metaTitle) };
}

export default async function VaultDocumentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireVaultPage();
  const locale = await getLocale();
  const t = tFor(locale);
  const params = vaultDocumentListParams.parse(await searchParams);
  const rows = await listVaultDocuments(params);
  const companyLabel = (c: string) =>
    (VAULT_COMPANIES as readonly string[]).includes(c)
      ? t(VAULT_COMPANY_LABELS[c as VaultCompany])
      : c;
  const typeLabel = (x: string) =>
    (VAULT_DOCUMENT_TYPES as readonly string[]).includes(x)
      ? t(VAULT_DOCUMENT_TYPE_LABELS[x as VaultDocumentType])
      : x;

  return (
    <div className="space-y-5">
      <VaultHead
        locale={locale}
        title={vault.documentsTitle}
        sub={vault.documentsSub}
      />

      <div className="page-actions">
        <AddDocumentButton />
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
        <label className="field">
          <span className="field-label">{t(vault.type)}</span>
          <select className="field-input" name="type" defaultValue={params.type ?? ""}>
            <option value="">{t(vault.all)}</option>
            {VAULT_DOCUMENT_TYPES.map((x) => (
              <option key={x} value={x}>
                {t(VAULT_DOCUMENT_TYPE_LABELS[x])}
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
          <p className="empty m-4">{t(vault.noDocuments)}</p>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>{t(vault.name)}</th>
                  <th>{t(vault.company)}</th>
                  <th>{t(vault.type)}</th>
                  <th>{t(vault.file)}</th>
                  <th>{t(vault.description)}</th>
                  <th>{t(vault.added)}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => {
                  const current = d.files[0] ?? null;
                  return (
                    <tr key={d.id}>
                      <td className="td-title">{d.name}</td>
                      <td>
                        <span className="chip-outline">{companyLabel(d.company)}</span>
                      </td>
                      <td>
                        <span className="chip-outline">{typeLabel(d.type)}</span>
                      </td>
                      <td>
                        {current ? (
                          <span className="inline-flex items-center gap-2 flex-wrap">
                            <a
                              href={`/api/files/${current.id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="chat-mention u-ltr"
                            >
                              {current.filename}
                            </a>
                            {d.files.length > 1 ? (
                              <span className="count-pill" title={t(vault.fileVersions)}>
                                {d.files.length}
                              </span>
                            ) : null}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>{d.description ?? "—"}</td>
                      <td className="td-mono u-ltr">{formatCairoDate(d.createdAt, locale)}</td>
                      <td>
                        <span className="inline-flex items-center gap-2 flex-wrap">
                          <EditDocumentButton
                            row={{
                              id: d.id,
                              company: d.company,
                              name: d.name,
                              description: d.description,
                              type: d.type,
                            }}
                          />
                          <ReplaceFileButton
                            postUrl={`/api/vault/documents/${d.id}/file`}
                            hint={t(vault.documentFileTypes)}
                            accept=".pdf,.docx,.xlsx"
                            label={t(vault.replaceFile)}
                          />
                          <ArchiveButton
                            postUrl={`/api/vault/documents/${d.id}/archive`}
                            archived={false} confirmText={t(vault.confirmArchive)}
                          />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
