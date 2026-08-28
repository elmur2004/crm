import { redirect } from "next/navigation";
import { requireCompanySection } from "@/lib/auth/page-guards";
import { bsRoleOf } from "@/lib/api/bsystems";
import { impersonate } from "@/lib/auth/actions";
import { listUsers } from "@/lib/services/users";
import { formatCairoDate } from "@/lib/datetime";
import {
  ActiveToggle,
  CreateUserForm,
  DeleteUserButton,
  EditUserButton,
} from "@/components/bsystems/users";
import { tFor } from "@/lib/i18n/core";
import { getLocale } from "@/lib/i18n/server";
import { common, roleBadges, usersAdmin as d } from "@/lib/i18n/dict/admin";

export async function generateMetadata() {
  const locale = await getLocale();
  return { title: tFor(locale)(d.meta) };
}

/* V2 §2.10 — every user; create with role/entity assignment; remove
   (deactivate, reversible); impersonate = open their account directly. */

export default async function UsersPage({
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
  );
  if (bsRoleOf(user) !== "bsystems_admin") redirect("/b-systems/crm");

  const users = await listUsers();
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
          <CreateUserForm />
        </div>
      </div>
      <div className="card card--flush0">
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>{t(common.thName)}</th>
                <th>{t(common.thEmailOrPhone)}</th>
                <th>{t(d.thPassword)}</th>
                <th>{t(d.thAccess)}</th>
                <th>{t(common.thCreated)}</th>
                <th>{t(d.thActions)}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} data-inactive={u.active ? undefined : ""}>
                  <td>
                    <span className="td-title">{u.name}</span>
                    {u.partner ? (
                      <span className="block text-xs text-brand-muted">{u.partner.companyName}</span>
                    ) : null}
                    {u.portalRep ? (
                      <span className="block text-xs text-brand-muted">{u.portalRep.speciality}</span>
                    ) : null}
                  </td>
                  <td>{u.email ?? u.phone ?? "—"}</td>
                  <td className="td-mono">
                    {/* founder: the admin sees every password. Accounts predating
                        the visibility column show — until their password is set */}
                    {u.passwordPlain ?? "—"}
                  </td>
                  <td>
                    <span className="flex gap-1 flex-wrap">
                      {u.roles.map((r) => (
                        <span key={r.role} className="badge badge--entity">
                          {roleBadges[r.role] ? t(roleBadges[r.role]) : r.role}
                        </span>
                      ))}
                      {/* ADR-066 — a module TAKEN AWAY says so on the row, so
                          the founder reads who is blocked without opening
                          anyone. Only ever shown for an admin: for anybody else
                          the flags mean nothing at all. */}
                      {u.roles.some((r) => r.role === "bsystems_admin") &&
                      !u.canAccessAccounting ? (
                        <span className="badge badge--archived">{t(d.badgeNoAccounting)}</span>
                      ) : null}
                      {u.roles.some((r) => r.role === "bsystems_admin") && !u.canAccessVault ? (
                        <span className="badge badge--archived">{t(d.badgeNoVault)}</span>
                      ) : null}
                    </span>
                  </td>
                  <td>{formatCairoDate(u.createdAt)}</td>
                  <td>
                    <span className="flex items-center gap-2 flex-wrap">
                      <EditUserButton
                        user={{
                          id: u.id,
                          name: u.name,
                          email: u.email,
                          phone: u.phone,
                          roles: u.roles.map((r) => r.role),
                          canAccessAccounting: u.canAccessAccounting,
                          canAccessVault: u.canAccessVault,
                        }}
                        isBootstrapAdmin={u.email === "admin@byteforce.com"}
                        isSelf={u.id === user.id}
                      />
                      {u.active && u.id !== user.id ? (
                        <form action={impersonate.bind(null, u.id)}>
                          <button type="submit" className="btn-ghost btn--sm">
                            {t(d.impersonate)}
                          </button>
                        </form>
                      ) : null}
                      {u.id !== user.id ? <ActiveToggle userId={u.id} active={u.active} /> : null}
                      {/* founder (ADR-049): a permanent delete beside the
                          reversible Remove. Never yourself, never the pinned
                          bootstrap admin — the server enforces both. */}
                      {u.id !== user.id && u.email !== "admin@byteforce.com" ? (
                        <DeleteUserButton userId={u.id} name={u.name} />
                      ) : null}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="u-footnote">{t(d.impersonateFootnote)}</p>
    </div>
  );
}
