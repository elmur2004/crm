import { redirect } from "next/navigation";
import { requirePageRole } from "@/lib/auth/page-guards";
import { bsRoleOf } from "@/lib/api/bsystems";
import { impersonate } from "@/lib/auth/actions";
import { listUsers } from "@/lib/services/users";
import { formatCairoDate } from "@/lib/datetime";
import { ActiveToggle, CreateUserForm } from "@/components/bsystems/users";

export const metadata = { title: "Users — B-Systems CRM" };

/* V2 §2.10 — every user; create with role/entity assignment; remove
   (deactivate, reversible); impersonate = open their account directly. */

const ROLE_LABELS: Record<string, string> = {
  bsystems_admin: "Admin",
  bsystems_sales: "Internal sales",
  bsystems_agent: "Agent",
  bsystems_partner: "Partner",
  byteforce_staff: "ByteForce",
};

export default async function UsersPage() {
  const user = await requirePageRole(
    "/login",
    "bsystems_admin",
    "bsystems_sales",
    "bsystems_agent",
    "bsystems_partner",
  );
  if (bsRoleOf(user) !== "bsystems_admin") redirect("/b-systems/crm");

  const users = await listUsers();

  return (
    <div className="space-y-6">
      <div className="page-head">
        <div>
          <p className="u-eyebrow">B-SYSTEMS · USERS</p>
          <h1 className="u-h1">Users</h1>
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
                <th>Name</th>
                <th>Email / phone</th>
                <th>Access</th>
                <th>Created</th>
                <th>Actions</th>
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
                  <td>
                    <span className="flex gap-1 flex-wrap">
                      {u.roles.map((r) => (
                        <span key={r.role} className="badge badge--entity">
                          {ROLE_LABELS[r.role] ?? r.role}
                        </span>
                      ))}
                    </span>
                  </td>
                  <td>{formatCairoDate(u.createdAt)}</td>
                  <td>
                    <span className="flex items-center gap-2 flex-wrap">
                      {u.active && u.id !== user.id ? (
                        <form action={impersonate.bind(null, u.id)}>
                          <button type="submit" className="btn-ghost btn--sm">
                            Impersonate
                          </button>
                        </form>
                      ) : null}
                      {u.id !== user.id ? <ActiveToggle userId={u.id} active={u.active} /> : null}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="u-footnote">
        Impersonating signs you into that account — log out and sign back in to return to your
        admin account. Every impersonation is recorded in the activity log.
      </p>
    </div>
  );
}
