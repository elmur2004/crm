import { requireBsAdminPage } from "@/lib/auth/page-guards";
import { getLocale } from "@/lib/i18n/server";
import { tFor } from "@/lib/i18n/core";
import { vault } from "@/lib/i18n/dict/vault";
import { listVaultSheets, vaultSheetListParams } from "@/lib/services/vault/sheets";
import {
  VAULT_COMPANIES,
  VAULT_COMPANY_LABELS,
  VAULT_SHEET_TYPE_LABELS,
  VAULT_SHEET_TYPES,
  type VaultCompany,
  type VaultSheetType,
} from "@/lib/services/vault/constants";
import { VaultHead } from "@/components/vault/VaultHead";
import {
  AddSheetButton,
  EditSheetButton,
  ReplaceFileButton,
} from "@/components/vault/forms";
import { ArchiveButton } from "@/components/shared/ArchiveButton";

/* ADR-053 Phase 5 — vault sheets: a link XOR an uploaded file; CSV counts come
   from the file itself, XLSX/XLS keep the dated manual count. Replacing a file
   APPENDS a version. Admin only. */

export async function generateMetadata() {
  const locale = await getLocale();
  return { title: tFor(locale)(vault.metaTitle) };
}

export default async function VaultSheetsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireBsAdminPage();
  const locale = await getLocale();
  const t = tFor(locale);
  const params = vaultSheetListParams.parse(await searchParams);
  const rows = await listVaultSheets(params);
  const companyLabel = (c: string) =>
    (VAULT_COMPANIES as readonly string[]).includes(c)
      ? t(VAULT_COMPANY_LABELS[c as VaultCompany])
      : c;
  const typeLabel = (x: string) =>
    (VAULT_SHEET_TYPES as readonly string[]).includes(x)
      ? t(VAULT_SHEET_TYPE_LABELS[x as VaultSheetType])
      : x;

  return (
    <div className="space-y-5">
      <VaultHead locale={locale} title={vault.sheetsTitle} sub={vault.sheetsSub} />

      <div className="page-actions">
        <AddSheetButton />
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
            {VAULT_SHEET_TYPES.map((x) => (
              <option key={x} value={x}>
                {t(VAULT_SHEET_TYPE_LABELS[x])}
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
          <p className="empty m-4">{t(vault.noSheets)}</p>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>{t(vault.name)}</th>
                  <th>{t(vault.company)}</th>
                  <th>{t(vault.type)}</th>
                  <th>{t(vault.storageMode)}</th>
                  <th>{t(vault.records)}</th>
                  <th>{t(vault.dateCreated)}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => {
                  const current = s.files[0] ?? null;
                  const currentExt = current
                    ? (current.storageKey.split(".").pop() ?? "")
                    : "";
                  return (
                    <tr key={s.id}>
                      <td className="td-title">{s.name}</td>
                      <td>
                        <span className="chip-outline">{companyLabel(s.company)}</span>
                      </td>
                      <td>
                        <span className="chip-outline">{typeLabel(s.type)}</span>
                      </td>
                      <td>
                        {s.storage === "link" && s.url ? (
                          <a href={s.url} target="_blank" rel="noreferrer" className="chat-mention">
                            {t(vault.link)}
                          </a>
                        ) : current ? (
                          <span className="inline-flex items-center gap-2 flex-wrap">
                            <a
                              href={`/api/files/${current.id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="chat-mention u-ltr"
                            >
                              {current.filename}
                            </a>
                            {s.files.length > 1 ? (
                              <span className="count-pill" title={t(vault.fileVersions)}>
                                {s.files.length}
                              </span>
                            ) : null}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="td-mono">
                        {s.recordCount == null ? (
                          "—"
                        ) : (
                          <span title={currentExt === "csv" ? t(vault.countedFromFile) : undefined}>
                            {s.recordCount}
                            {s.recordCountAsOf ? (
                              <span className="u-muted u-ltr"> · {s.recordCountAsOf}</span>
                            ) : null}
                          </span>
                        )}
                      </td>
                      <td className="td-mono u-ltr">{s.dateCreated}</td>
                      <td>
                        <span className="inline-flex items-center gap-2 flex-wrap">
                          <EditSheetButton
                            row={{
                              id: s.id,
                              company: s.company,
                              name: s.name,
                              type: s.type,
                              storage: s.storage,
                              url: s.url,
                              dateCreated: s.dateCreated,
                              recordCount: s.recordCount,
                              recordCountAsOf: s.recordCountAsOf,
                              notes: s.notes,
                            }}
                          />
                          <ReplaceFileButton
                            postUrl={`/api/vault/sheets/${s.id}/file`}
                            hint={t(vault.sheetFileTypes)}
                            accept=".xlsx,.xls,.csv"
                            label={current ? t(vault.replaceFile) : t(vault.uploadFile)}
                          />
                          <ArchiveButton
                            postUrl={`/api/vault/sheets/${s.id}/archive`}
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
