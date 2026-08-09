import { redirect } from "next/navigation";
import { requirePageRole } from "@/lib/auth/page-guards";
import { bsRoleOf } from "@/lib/api/bsystems";
import { listRegistrations } from "@/lib/services/users";
import { formatCairo } from "@/lib/datetime";

export const metadata = { title: "Registrations — B-Systems CRM" };

/* V2 §2.8 — the registry of everyone who signed up / was registered on the
   system: internal sales, agents, partners (admins shown too, labeled). */

const ROLE_LABELS: Record<string, string> = {
  bsystems_admin: "Admin",
  bsystems_sales: "Internal sales",
  bsystems_agent: "Agent",
  bsystems_partner: "Partner",
  byteforce_staff: "ByteForce staff",
};

export default async function RegistrationsPage() {
  const user = await requirePageRole(
    "/login",
    "bsystems_admin",
    "bsystems_sales",
    "bsystems_agent",
    "bsystems_partner",
  );
  if (bsRoleOf(user) !== "bsystems_admin") redirect("/b-systems/crm");

  const registrations = await listRegistrations();

  return (
    <div className="space-y-6">
      <div className="page-head">
        <div>
          <p className="u-eyebrow">B-SYSTEMS · REGISTRATIONS</p>
          <h1 className="u-h1">Registrations</h1>
        </div>
      </div>
      <div className="card card--flush0">
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email / phone</th>
                <th>Type</th>
                <th>Registered</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {registrations.map((u) => (
                <tr key={u.id}>
                  <td>
                    <span className="td-title">{u.name}</span>
                  </td>
                  <td className="td-mono">{u.email ?? u.phone ?? "—"}</td>
                  <td>
                    <span className="chip-outline">
                      {u.roles.map((r) => ROLE_LABELS[r.role] ?? r.role).join(", ")}
                    </span>
                  </td>
                  <td>{formatCairo(u.createdAt)}</td>
                  <td>
                    {u.active ? (
                      <span>Active</span>
                    ) : (
                      <span className="badge badge--danger">Deactivated</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
