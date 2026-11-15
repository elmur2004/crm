import { listUsers } from "@/lib/services/users";
import { formatCairoDate } from "@/lib/datetime";
import {
  ActiveToggle,
  CreateUserForm,
  DeleteUserButton,
  EditUserButton,
} from "@/components/users/admin-controls";
import Link from "next/link";
import { tFor } from "@/lib/i18n/core";
import { getLocale } from "@/lib/i18n/server";
import { common, roleBadges, usersAdmin as d } from "@/lib/i18n/dict/admin";
import { massAssign } from "@/lib/i18n/dict/users-app";
import { massAssignCompaniesFor } from "@/lib/services/mass-assign";
import { USERS_PATH } from "@/lib/launcher/apps";
import type { Role } from "@/lib/pipeline-engine/constants";

/* V2 §2.10 — every user; create with role/entity assignment; remove
   (deactivate, reversible); impersonate = open their account directly.

   ADR-103 — the "All users" view of the Users app (/users), the B-Systems
   admin's alone. Every type of account is on it — admins, internal sales,
   agents, partners, data entry and ByteForce staff — because the app is the
   platform's, not one company's. It used to be a page of the B-Systems CRM
   (UsersBody); the page around it now draws the heading, the tabs and the
   launcher's own bar, so this is the table and its one action.

   ADR-075 made this body take a SURFACE so two administrators could share one
   screen; ADR-080 removed the second administrator and the surface stays, minus
   its `scope`. What it still carries is real: the API namespace the writes go to
   and the roles this administrator may grant, both passed in rather than assumed.

   Every wall here is a courtesy. The SERVICE refuses an ungrantable role on its
   own (`assertGrantable`), and every write is `requireBsAdmin`, which is what
   makes the screen safe rather than merely tidy. */

export interface UsersSurface {
  apiBase: string;
  assignableRoles: readonly string[];
  /** the accounts the bootstrap pins, which may never be deleted and whose
      identity the editor protects — read from the bootstrap itself so this
      screen and the healer cannot disagree about who is undeletable. */
  bootstrapAdminEmails: readonly string[];
  /** the impersonation server action, when this surface has one. */
  impersonate?: (targetUserId: string) => Promise<void>;
}

export async function AllUsersBody({
  ctx,
  viewerId,
  viewerRoles,
}: {
  ctx: UsersSurface;
  viewerId: string;
  /** ADR-105 — whose companies' leads this admin may hand out (the row's
      "Assign leads" shows only where both sides allow it) */
  viewerRoles: readonly Role[];
}) {
  const users = await listUsers();
  const locale = await getLocale();
  const t = tFor(locale);

  return (
    <div className="space-y-4">
      <div className="lx-section-actions">
        <CreateUserForm apiBase={ctx.apiBase} assignableRoles={ctx.assignableRoles} />
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
                      {/* ADR-105 — founder: "I can choose them in the users
                          section and select mass assign". Only on a live
                          account that can own a lead of a company this admin
                          runs; the view re-checks, the write re-checks again. */}
                      {massAssignCompaniesFor(
                        { ...u, roles: u.roles.map((r) => r.role) },
                        { roles: viewerRoles },
                      ).length > 0 ? (
                        <Link
                          href={`${USERS_PATH}?assign=${u.id}`}
                          prefetch={false}
                          className="btn-ghost btn--sm"
                        >
                          {t(massAssign.rowButton)}
                        </Link>
                      ) : null}
                      {/* ADR-075 — impersonation is offered only where the
                          surface has an action for it. B-Systems has had one
                          since V2 §2.10; a surface with nobody
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
        {/* inside the card (solid data), not on the glass ground below it:
            plain muted text on the ground's glow falls under 4.5:1 (the
            brand audit, 2026-11-14) */}
        {ctx.impersonate ? <p className="panel-hint">{t(d.impersonateFootnote)}</p> : null}
      </div>
    </div>
  );
}
