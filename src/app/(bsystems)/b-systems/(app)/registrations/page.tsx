import { redirect } from "next/navigation";
import { requireCompanySection } from "@/lib/auth/page-guards";
import { BS_PIPELINE_ROLES } from "@/lib/crm/company";
import { bsRoleOf } from "@/lib/api/bsystems";
import { listRegistrations } from "@/lib/services/users";
import { formatCairo } from "@/lib/datetime";
import { RegistrationActions } from "@/components/bsystems/registrations";
import { tFor } from "@/lib/i18n/core";
import { getLocale } from "@/lib/i18n/server";
import { common, regRoleBadges, registrations as d } from "@/lib/i18n/dict/admin";

export async function generateMetadata() {
  const locale = await getLocale();
  return { title: tFor(locale)(d.meta) };
}

/* V2 §2.8 + founder V3: Registrations is the APPROVAL CYCLE — new agent
   sign-ups arrive here as pending requests; the admin approves or declines
   them. Below that, the registry of everyone on the system. */

export default async function RegistrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string }>;
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

  const registrations = await listRegistrations();
  const pending = registrations.filter((u) => u.registrationStatus === "pending");
  const locale = await getLocale();
  const t = tFor(locale);

  return (
    <div className="space-y-6">
      <div className="page-head">
        <div>
          <p className="u-eyebrow">{t(d.eyebrow)}</p>
          <h1 className="u-h1">{t(d.title)}</h1>
        </div>
      </div>

      <section className="card card--flush0">
        <div className="card-head">
          <h2 className="u-h3">{t(d.awaitingApproval)}</h2>
          <span className="count-pill" data-stage-key="won">
            {pending.length}
          </span>
        </div>
        {pending.length === 0 ? (
          <p className="empty m-4">{t(d.pendingEmpty)}</p>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>{t(common.thName)}</th>
                  <th>{t(common.thEmail)}</th>
                  <th>{t(common.thPhone)}</th>
                  <th>{t(d.thRequested)}</th>
                  <th>{t(d.thDecision)}</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <span className="td-title">{u.name}</span>
                    </td>
                    <td className="td-mono">{u.email ?? "—"}</td>
                    <td className="td-mono">{u.phone ?? "—"}</td>
                    <td>{formatCairo(u.createdAt)}</td>
                    <td>
                      <RegistrationActions userId={u.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card card--flush0">
        <div className="card-head">
          <h2 className="u-h3">{t(d.everyoneHeading)}</h2>
        </div>
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>{t(common.thName)}</th>
                <th>{t(common.thEmailOrPhone)}</th>
                <th>{t(d.thType)}</th>
                <th>{t(d.thRegistered)}</th>
                <th>{t(common.thStatus)}</th>
              </tr>
            </thead>
            <tbody>
              {registrations.map((u) => (
                <tr key={u.id} data-inactive={u.active ? undefined : ""}>
                  <td>
                    <span className="td-title">{u.name}</span>
                  </td>
                  <td className="td-mono">{u.email ?? u.phone ?? "—"}</td>
                  <td>
                    <span className="chip-outline">
                      {u.roles
                        .map((r) => (regRoleBadges[r.role] ? t(regRoleBadges[r.role]) : r.role))
                        .join(", ")}
                    </span>
                  </td>
                  <td>{formatCairo(u.createdAt)}</td>
                  <td>
                    {u.registrationStatus === "pending" ? (
                      <span className="badge badge--entity badge--entity-both">
                        {t(common.pending)}
                      </span>
                    ) : u.registrationStatus === "rejected" ? (
                      <span className="badge badge--danger">{t(d.badgeDeclined)}</span>
                    ) : u.active ? (
                      <span>{t(d.statusActive)}</span>
                    ) : (
                      <span className="badge badge--danger">{t(common.badgeDeactivated)}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
