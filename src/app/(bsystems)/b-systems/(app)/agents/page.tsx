import Link from "next/link";
import { redirect } from "next/navigation";
import { requireCompanySection } from "@/lib/auth/page-guards";
import { BS_PIPELINE_ROLES } from "@/lib/crm/company";
import { bsRoleOf } from "@/lib/api/bsystems";
import { listAgentsDetailed, listBsLeads } from "@/lib/services/bsystems-admin";
import { BSYSTEMS_STAGES } from "@/lib/pipeline-engine/constants";
import { formatCairoDate } from "@/lib/datetime";
import { StageBadge } from "@/components/shared/StageBadge";
import { NumberActions } from "@/components/shared/NumberActions";
import { stageKey } from "@/components/bsystems/stageColors";
import { tFor } from "@/lib/i18n/core";
import { getLocale } from "@/lib/i18n/server";
import { stageLabel } from "@/lib/i18n/dict/labels";
import { agents as d, common } from "@/lib/i18n/dict/admin";

export async function generateMetadata() {
  const locale = await getLocale();
  return { title: tFor(locale)(d.meta) };
}

/* V2 §2.7 — Agents, like Partners: a Detailed view (profile cards + join date +
   leads table) and a Pipeline view (their leads across the stages). */

export default async function AgentsPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string; view?: string }>;
}) {
  /* ADR-067 — a B-Systems-ONLY section: refused under company=byteforce, and
     refused BEFORE the role narrowing below, so a ByteForce-only teammate is
     redirected rather than falling into bsRoleOf and turning into a 500.
     Past this line bsRoleOf is TOTAL: holding "bsystems" is exactly holding one
     of the five B-Systems roles, so it can no longer throw. */
  const { user } = await requireCompanySection(
    "bsystems",
    (await searchParams).company,
    BS_PIPELINE_ROLES,
  );
  if (bsRoleOf(user) !== "bsystems_admin") redirect("/b-systems/crm");

  const { view } = await searchParams;
  const pipeline = view === "pipeline";
  const locale = await getLocale();
  const t = tFor(locale);

  return (
    <div className="space-y-6">
      <div className="page-head">
        <div>
          <p className="u-eyebrow">{t(d.eyebrow)}</p>
          <h1 className="u-h1">{t(d.title)}</h1>
        </div>
        <div className="page-actions">
          <nav className="flex gap-1" aria-label={t(d.viewAria)}>
            <Link
              href="/b-systems/agents"
              className="nav-item"
              aria-current={!pipeline ? "page" : undefined}
            >
              {t(d.viewDetailed)}
            </Link>
            <Link
              href="/b-systems/agents?view=pipeline"
              className="nav-item"
              aria-current={pipeline ? "page" : undefined}
            >
              {t(d.viewPipeline)}
            </Link>
          </nav>
        </div>
      </div>

      {pipeline ? <AgentsPipeline /> : <AgentsDetailed />}
    </div>
  );
}

async function AgentsDetailed() {
  const agents = await listAgentsDetailed();
  const locale = await getLocale();
  const t = tFor(locale);
  if (agents.length === 0) {
    return <p className="empty">{t(d.empty)}</p>;
  }
  return (
    <div className="space-y-4">
      {agents.map((a) => (
        <div key={a.id} className="card card--flush0">
          <div className="identity-head">
            <div className="space-y-0.5">
              <p className="identity-name">
                {a.firstName} {a.lastName}
                {!a.user.active ? (
                  <span className="ms-2 badge badge--danger align-middle">
                    {t(common.badgeDeactivated)}
                  </span>
                ) : null}
              </p>
              <p className="identity-sub">{a.speciality}</p>
              <p className="u-muted">
                <span>{t(common.labelPhone)}</span> {a.user.phone ?? "—"}
                {/* founder: "add call and whatsapp in agents and partners" */}
                {a.user.phone ? <NumberActions number={a.user.phone} locale={locale} /> : null}
              </p>
              <p className="u-muted">
                <span>{t(common.labelAddress)}</span> {a.address}
              </p>
            </div>
            <p className="text-brand-meta text-brand-muted">
              {t(d.joinedWord)} {formatCairoDate(a.user.createdAt)}
            </p>
          </div>
          {a.user.ownedLeads.length === 0 ? (
            <p className="u-muted card-pad">{t(d.noLeadsYet)}</p>
          ) : (
            <div className="table-scroll">
              <table className="table table--embedded">
                <thead>
                  <tr>
                    <th>{t(d.thLead)}</th>
                    <th>{t(common.thNumber)}</th>
                    <th>{t(d.thStage)}</th>
                    <th>{t(common.thCreated)}</th>
                  </tr>
                </thead>
                <tbody>
                  {a.user.ownedLeads.map((l) => (
                    <tr key={l.id}>
                      <td>
                        <Link href={`/b-systems/crm/lead/${l.id}`} className="td-title">
                          {l.name}
                        </Link>
                      </td>
                      <td className="td-mono">{l.number}</td>
                      <td>
                        <StageBadge stage={l.stage} />
                      </td>
                      <td>{formatCairoDate(l.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

async function AgentsPipeline() {
  const leads = await listBsLeads("agent");
  const locale = await getLocale();
  return (
    <div className="board" data-cols="6plus">
      {BSYSTEMS_STAGES.map((stage) => {
        const cards = leads.filter((l) => l.stage === stage);
        return (
          <div key={stage} className="col" data-stage-key={stageKey(stage)}>
            <div className="col-bar" aria-hidden />
            <div className="col-head">
              <p className="col-title">
                {stageLabel(locale, stage)} ({cards.length})
              </p>
            </div>
            <div className="col-cards">
              {cards.map((l) => (
                <Link key={l.id} href={`/b-systems/crm/lead/${l.id}`} className="bcard block">
                  <p className="bcard-name">{l.name}</p>
                  <p className="bcard-rep mt-0.5">{l.owner?.name ?? "—"}</p>
                </Link>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
