import Link from "next/link";
import { requireBsAdminPage } from "@/lib/auth/page-guards";
import { getLocale } from "@/lib/i18n/server";
import { tFor } from "@/lib/i18n/core";
import { vault } from "@/lib/i18n/dict/vault";
import { formatCairo } from "@/lib/datetime";
import { vaultOverview } from "@/lib/services/vault/overview";
import { searchVault } from "@/lib/services/vault/search";
import { VaultHead } from "@/components/bsystems/vault/VaultHead";

/* ADR-053 Phase 5 — the vault landing: live counts, vault-wide search, and
   the module's recent activity (append-only, newest first). Admin only. */

import type { Msg } from "@/lib/i18n/core";

const ENTITY_LABELS: Record<string, Msg> = {
  vault_employee: vault.entityEmployee,
  vault_form: vault.entityForm,
  vault_sheet: vault.entitySheet,
  vault_document: vault.entityDocument,
  vault_task: vault.entityTask,
};

const ACTION_LABELS: Record<string, Msg> = {
  create: vault.actionCreate,
  update: vault.actionUpdate,
  archive: vault.actionArchive,
  restore: vault.actionRestore,
  complete: vault.actionComplete,
  reopen: vault.actionReopen,
  replace_file: vault.actionReplaceFile,
};

export async function generateMetadata() {
  const locale = await getLocale();
  return { title: tFor(locale)(vault.metaTitle) };
}

export default async function VaultOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireBsAdminPage();
  const locale = await getLocale();
  const t = tFor(locale);
  const { q } = await searchParams;
  const [data, results] = await Promise.all([
    vaultOverview(),
    q ? searchVault(q) : Promise.resolve(null),
  ]);

  const groups = results
    ? ([
        [t(vault.tabForms), results.groups.forms],
        [t(vault.tabSheets), results.groups.sheets],
        [t(vault.tabDocuments), results.groups.documents],
        [t(vault.tabTasks), results.groups.tasks],
      ] as const)
    : null;

  return (
    <div className="space-y-5">
      <VaultHead tab="overview" locale={locale} title={vault.overviewTitle} sub={vault.overviewSub} />

      <div className="tile-grid">
        <div className="tile">
          <span className="tile-label">{t(vault.liveForms)}</span>
          <span className="tile-value">{data.forms}</span>
        </div>
        <div className="tile">
          <span className="tile-label">{t(vault.liveSheets)}</span>
          <span className="tile-value">{data.sheets}</span>
        </div>
        <div className="tile">
          <span className="tile-label">{t(vault.liveDocuments)}</span>
          <span className="tile-value">{data.documents}</span>
        </div>
        <div className="tile">
          <span className="tile-label">{t(vault.openTasks)}</span>
          <span className="tile-value">{data.openTasks}</span>
        </div>
        <div className={data.overdueTasks > 0 ? "tile tile--warn" : "tile"}>
          <span className="tile-label">{t(vault.overdueTasks)}</span>
          <span className={data.overdueTasks > 0 ? "tile-value text-brand-danger" : "tile-value"}>
            {data.overdueTasks}
          </span>
        </div>
        <div className="tile">
          <span className="tile-label">{t(vault.archivedRecords)}</span>
          <span className="tile-value">{data.archived}</span>
        </div>
      </div>

      <section className="card card-pad space-y-3">
        <h2 className="u-h3">{t(vault.searchTitle)}</h2>
        <form method="get" className="flex flex-wrap gap-2 items-end">
          <label className="field grow">
            <span className="field-label">{t(vault.searchTitle)}</span>
            <input className="field-input"
              name="q"
              defaultValue={q ?? ""}
              placeholder={t(vault.searchPlaceholder)}
              maxLength={200}
            />
          </label>
          <button type="submit" className="btn-primary">
            {t(vault.searchButton)}
          </button>
        </form>
        {results && groups ? (
          results.total === 0 ? (
            <p className="empty">
              {results.term.length < 2 ? t(vault.searchMin) : t(vault.searchNoResults)}
            </p>
          ) : (
            <div className="space-y-3">
              {groups.map(([label, hits]) =>
                hits.length === 0 ? null : (
                  <div key={label}>
                    <p className="u-label">{label}</p>
                    <ul className="space-y-1">
                      {hits.map((h) => (
                        <li key={h.id}>
                          <Link href={h.href} className="chat-mention">
                            {h.title}
                          </Link>
                          {h.subtitle ? <span className="u-muted"> — {h.subtitle}</span> : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ),
              )}
            </div>
          )
        ) : null}
      </section>

      <section className="card card--flush0">
        <div className="card-pad">
          <h2 className="u-h3">{t(vault.recentActivity)}</h2>
        </div>
        {data.activity.length === 0 ? (
          <p className="empty m-4">{t(vault.noActivity)}</p>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>{t(vault.whenCol)}</th>
                  <th>{t(vault.type)}</th>
                  <th>{t(vault.actionCol)}</th>
                  <th>{t(vault.detailCol)}</th>
                </tr>
              </thead>
              <tbody>
                {data.activity.map((a) => (
                  <tr key={a.id}>
                    <td className="td-mono u-ltr">{formatCairo(a.createdAt)}</td>
                    <td>
                      <span className="chip-outline">
                        {a.entityType in ENTITY_LABELS
                          ? t(ENTITY_LABELS[a.entityType]!)
                          : a.entityType}
                      </span>
                    </td>
                    <td className="td-title">
                      {a.action in ACTION_LABELS ? t(ACTION_LABELS[a.action]!) : a.action}
                    </td>
                    {/* provenance detail: technical mono text (embeds names/dates) */}
                    <td className="td-mono u-ltr">{a.trigger}</td>
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
