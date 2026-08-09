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
      <h1 className="font-brand-display text-2xl font-bold text-brand-heading">Registrations</h1>
      <div className="overflow-x-auto border border-brand-border rounded-brand-card bg-brand-surface-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-brand-border">
              <th className="text-start p-3 font-bold">Name</th>
              <th className="text-start p-3 font-bold">Email / phone</th>
              <th className="text-start p-3 font-bold">Type</th>
              <th className="text-start p-3 font-bold">Registered</th>
              <th className="text-start p-3 font-bold">Status</th>
            </tr>
          </thead>
          <tbody>
            {registrations.map((u) => (
              <tr key={u.id} className="border-b border-brand-border last:border-0">
                <td className="p-3 font-medium">{u.name}</td>
                <td className="p-3">{u.email ?? u.phone ?? "—"}</td>
                <td className="p-3">
                  {u.roles.map((r) => ROLE_LABELS[r.role] ?? r.role).join(", ")}
                </td>
                <td className="p-3">{formatCairo(u.createdAt)}</td>
                <td className="p-3">
                  {u.active ? (
                    <span className="text-brand-success">Active</span>
                  ) : (
                    <span className="text-brand-danger">Deactivated</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
