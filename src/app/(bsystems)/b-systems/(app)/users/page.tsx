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
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="font-brand-display text-2xl font-bold text-brand-heading">Users</h1>
        <CreateUserForm />
      </div>
      <div className="overflow-x-auto border border-brand-border rounded-brand-card bg-brand-surface-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-brand-border">
              <th className="text-start p-3 font-bold">Name</th>
              <th className="text-start p-3 font-bold">Email / phone</th>
              <th className="text-start p-3 font-bold">Access</th>
              <th className="text-start p-3 font-bold">Created</th>
              <th className="text-start p-3 font-bold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className={`border-b border-brand-border last:border-0 ${u.active ? "" : "opacity-60"}`}>
                <td className="p-3">
                  <span className="font-medium">{u.name}</span>
                  {u.partner ? (
                    <span className="block text-xs text-brand-muted">{u.partner.companyName}</span>
                  ) : null}
                  {u.portalRep ? (
                    <span className="block text-xs text-brand-muted">{u.portalRep.speciality}</span>
                  ) : null}
                </td>
                <td className="p-3">{u.email ?? u.phone ?? "—"}</td>
                <td className="p-3">
                  <span className="flex gap-1 flex-wrap">
                    {u.roles.map((r) => (
                      <span
                        key={r.role}
                        className="text-xs bg-brand-surface-tint border border-brand-border rounded-brand-control px-1.5 py-0.5"
                      >
                        {ROLE_LABELS[r.role] ?? r.role}
                      </span>
                    ))}
                  </span>
                </td>
                <td className="p-3">{formatCairoDate(u.createdAt)}</td>
                <td className="p-3">
                  <span className="flex items-center gap-2 flex-wrap">
                    {u.active && u.id !== user.id ? (
                      <form action={impersonate.bind(null, u.id)}>
                        <button
                          type="submit"
                          className="border border-brand-border text-brand-link rounded-brand-control px-3 py-1.5 text-xs font-medium hover:bg-brand-surface-tint"
                        >
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
      <p className="text-xs text-brand-muted">
        Impersonating signs you into that account — log out and sign back in to return to your
        admin account. Every impersonation is recorded in the activity log.
      </p>
    </div>
  );
}
