import { redirect } from "next/navigation";
import Link from "next/link";
import { requireVaultPage } from "@/lib/auth/page-guards";
import { getLocale } from "@/lib/i18n/server";
import { formatMsg, tFor } from "@/lib/i18n/core";
import { vault } from "@/lib/i18n/dict/vault";
import { formatCairo } from "@/lib/datetime";
import { listVaultTasks, vaultTaskListParams } from "@/lib/services/vault/tasks";
import { listVaultEmployeeCards } from "@/lib/services/vault/employees";
import {
  VAULT_COMPANIES,
  VAULT_COMPANY_LABELS,
  type VaultCompany,
} from "@/lib/services/vault/constants";
import { VaultHead } from "@/components/vault/VaultHead";
import {
  AddTaskButton,
  CompleteTaskButton,
  EditTaskButton,
  ReopenTaskButton,
} from "@/components/vault/forms";
import { ArchiveButton } from "@/components/shared/ArchiveButton";
import { hasVaultSection } from "@/lib/module-sections";
import { vaultCompaniesOf } from "@/lib/services/vault/tenancy";

/* ADR-053 Phase 5 — the tasks screen: assignee cards (open/overdue/completed,
   overdue highlighted) over the task table (open first, deadline ascending).
   Completing goes through the result panel — the gate's UX; the server is the
   enforcement layer. Admin only. */

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

export default async function VaultTasksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireVaultPage();
  /* ADR-074 — the companies this account may see (services/vault/tenancy). */
  const visible = vaultCompaniesOf(user);
  /* ADR-076 — a section this company does not have is REFUSED, not merely
     hidden from the nav. Founder: "for mindoo and only mindoo — vault should
     only be : links and sheets and documents". Leaving the page reachable by
     typing its address would make that a tidier menu rather than a decision
     about what the company has. */
  if (!hasVaultSection(visible[0] ?? "byteforce", "/vault/tasks")) redirect("/vault");
  const locale = await getLocale();
  const t = tFor(locale);
  const raw = await searchParams;
  const params = vaultTaskListParams.parse(raw);
  const [rows, cards] = await Promise.all([
    listVaultTasks({ ...params, employeeId: raw.employee ?? params.employeeId }, visible),
    listVaultEmployeeCards(visible),
  ]);
  const employeeFilter = raw.employee ?? "";
  const companyLabel = (c: string | null) =>
    c === null
      ? t(vault.companyBoth)
      : (VAULT_COMPANIES as readonly string[]).includes(c)
        ? t(VAULT_COMPANY_LABELS[c as VaultCompany])
        : c;
  const assignees = cards.map((c) => ({ id: c.id, name: c.name }));

  return (
    <div className="space-y-5">
      <VaultHead locale={locale} title={vault.tasksTitle} sub={vault.tasksSub} />

      <div className="page-actions">
        <AddTaskButton assignees={assignees} />
      </div>

      {cards.length === 0 ? (
        <section className="card card-pad">
          <p className="empty">{t(vault.noEmployees)}</p>
        </section>
      ) : (
        <div className="ecard-grid">
          {cards.map((c) => (
            <Link
              key={c.id}
              href={employeeFilter === c.id ? "/vault/tasks" : `/vault/tasks?employee=${c.id}`}
              className={employeeFilter === c.id ? "ecard ecard--accent" : "ecard"}
              aria-current={employeeFilter === c.id ? "true" : undefined}
            >
              <span className="ecard-top">
                <span className="ecard-mark" aria-hidden="true">
                  {markInitials(c.name)}
                </span>
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
            </Link>
          ))}
        </div>
      )}

      <form method="get" className="card card-pad flex flex-wrap gap-3 items-end">
        {employeeFilter ? <input type="hidden" name="employee" value={employeeFilter} /> : null}
        <label className="field">
          <span className="field-label">{t(vault.searchShort)}</span>
          <input className="field-input" name="q" defaultValue={params.q ?? ""} maxLength={200} />
        </label>
        <label className="field">
          <span className="field-label">{t(vault.company)}</span>
          <select className="field-input" name="company" defaultValue={params.company ?? ""}>
            <option value="">{t(vault.all)}</option>
            {/* ADR-074 — this account's companies, not the platform's:
                offering a company the list cannot return is a filter that
                always comes back empty. */}
            {visible.map((c) => (
              <option key={c} value={c}>
                {t(VAULT_COMPANY_LABELS[c])}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">{t(vault.status)}</span>
          <select className="field-input" name="status" defaultValue={params.status ?? ""}>
            <option value="">{t(vault.all)}</option>
            <option value="open">{t(vault.statusOpen)}</option>
            <option value="completed">{t(vault.statusCompleted)}</option>
          </select>
        </label>
        <label className="check-row">
          <input type="checkbox" name="overdue" value="true" defaultChecked={Boolean(params.overdue)} />
          <span>{t(vault.onlyOverdue)}</span>
        </label>
        <button type="submit" className="btn-ghost">
          {t(vault.apply)}
        </button>
      </form>

      <section className="card card--flush0">
        {rows.length === 0 ? (
          <p className="empty m-4">{t(vault.noTasks)}</p>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>{t(vault.name)}</th>
                  <th>{t(vault.assignee)}</th>
                  <th>{t(vault.company)}</th>
                  <th>{t(vault.deadline)}</th>
                  <th>{t(vault.status)}</th>
                  <th>{t(vault.late)}</th>
                  <th>{t(vault.completedOn)}</th>
                  <th>{t(vault.result)}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((task) => (
                  <tr key={task.id}>
                    <td className="td-title">
                      {task.name}
                      {task.description ? (
                        <span className="u-muted block text-sm">{task.description}</span>
                      ) : null}
                    </td>
                    <td>{task.employee.name}</td>
                    <td>
                      <span className="chip-outline">{companyLabel(task.company)}</span>
                    </td>
                    <td className="td-mono">
                      <span className="u-ltr">{task.deadline}</span>{" "}
                      {task.isOverdue ? (
                        <span className="badge badge--danger">{t(vault.overdueBadge)}</span>
                      ) : null}
                    </td>
                    <td>
                      {task.status === "completed" ? (
                        <span className="stage-chip" data-stage-key="intake">
                          {t(vault.statusCompleted)}
                        </span>
                      ) : (
                        <span className="stage-chip" data-stage-key="following">
                          {t(vault.statusOpen)}
                        </span>
                      )}
                    </td>
                    <td>
                      {task.status !== "completed" || task.wasLate === null
                        ? "—"
                        : task.wasLate
                          ? t(formatMsg(vault.lateByDays, { days: String(task.daysLate ?? 0) }))
                          : t(vault.onTime)}
                    </td>
                    <td className="td-mono u-ltr">
                      {task.completedAt ? formatCairo(task.completedAt, locale) : "—"}
                    </td>
                    <td>
                      {task.resultText || task.attachments.length > 0 || task.links.length > 0 ? (
                        <span className="u-muted text-sm">
                          {[
                            task.resultText ? t(vault.noteShort) : null,
                            task.attachments.length > 0
                              ? `${task.attachments.length} ${t(vault.filesCount)}`
                              : null,
                            task.links.length > 0
                              ? `${task.links.length} ${t(vault.linksCount)}`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <span className="inline-flex items-center gap-2 flex-wrap">
                        {task.status === "open" ? (
                          <CompleteTaskButton
                            taskId={task.id}
                            taskName={task.name}
                            resultText={task.resultText}
                          />
                        ) : (
                          <ReopenTaskButton taskId={task.id} />
                        )}
                        <EditTaskButton
                          row={{
                            id: task.id,
                            employeeId: task.employeeId,
                            name: task.name,
                            description: task.description,
                            company: task.company,
                            deadline: task.deadline,
                            status: task.status,
                          }}
                          assignees={assignees}
                        />
                        <ArchiveButton
                          postUrl={`/api/vault/tasks/${task.id}/archive`}
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
