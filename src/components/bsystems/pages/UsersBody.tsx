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
import type { UserScope } from "@/lib/services/user-tenancy";

/* V2 §2.10 — every user; create with role/entity assignment; remove
   (deactivate, reversible); impersonate = open their account directly.

   ADR-075 — ONE screen, TWO administrators. Founder: "mindoo user should appear
   in mindoo system not in bsystems systems separate their users." That is a
   statement about WHOSE PEOPLE each administrator sees, not about having two
   different screens — so the body is shared and what varies is passed in:

     scope     whose accounts are listed, and the only ones the writes may touch
     apiBase   the namespace those writes go to (the company is derived from the
               ROUTE on the server, so the namespace IS the company)
     roles     what this administrator may grant

   Every wall here is a courtesy. The SERVICE refuses a crossing on its own
   (assertUserInScope, assertGrantable), which is what makes the shared screen
   safe rather than merely tidy. */

export interface UsersSurface {
  scope: UserScope;
  apiBase: string;
  assignableRoles: readonly string[];
  /** the accounts the bootstrap pins, which may never be deleted and whose
      identity the editor protects — read from the bootstrap itself so this
      screen and the healer cannot disagree about who is undeletable. */
  bootstrapAdminEmails: readonly string[];
  /** the impersonation server action, when this surface has one. Mindoo passes
      none: one staff role means nobody to impersonate. */
  impersonate?: (targetUserId: string) => Promise<void>;
}

export async function UsersBody({ ctx, viewerId }: { ctx: UsersSurface; viewerId: string }) {
  const users = await listUsers(ctx.scope);
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
          <CreateUserForm apiBase={ctx.apiBase} assignableRoles={ctx.assignableRoles} />
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
                  <td>{formatCairoDate(u.createdAt, locale)}</td>
                  <td>
                    <span className="flex items-center gap-2 flex-wrap">
                      <EditUserButton
                        apiBase={ctx.apiBase}
                        assignableRoles={ctx.assignableRoles}
                        user={{
                          id: u.id,
                          name: u.name,
                          email: u.email,
                          phone: u.phone,
                          roles: u.roles.map((r) => r.role),
                          canAccessAccounting: u.canAccessAccounting,
                          canAccessVault: u.canAccessVault,
                        }}
                        isBootstrapAdmin={ctx.bootstrapAdminEmails.includes(u.email ?? "")}
                        isSelf={u.id === viewerId}
                      />
                      {/* ADR-075 — impersonation is offered only where the
                          surface has an action for it. B-Systems has had one
                          since V2 §2.10; Mindoo has one staff role and nobody
                          to impersonate, so it passes none and the button
                          simply is not there. */}
                      {ctx.impersonate && u.active && u.id !== viewerId ? (
                        <form action={ctx.impersonate.bind(null, u.id)}>
                          <button type="submit" className="btn-ghost btn--sm">
                            {t(d.impersonate)}
                          </button>
                        </form>
                      ) : null}
                      {u.id !== viewerId ? (
                        <ActiveToggle userId={u.id} active={u.active} apiBase={ctx.apiBase} />
                      ) : null}
                      {/* founder (ADR-049): a permanent delete beside the
                          reversible Remove. Never yourself, never the pinned
                          bootstrap admin — the server enforces both. */}
                      {u.id !== viewerId && !ctx.bootstrapAdminEmails.includes(u.email ?? "") ? (
                        <DeleteUserButton userId={u.id} name={u.name} apiBase={ctx.apiBase} />
                      ) : null}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {ctx.impersonate ? <p className="u-footnote">{t(d.impersonateFootnote)}</p> : null}
    </div>
  );
}
