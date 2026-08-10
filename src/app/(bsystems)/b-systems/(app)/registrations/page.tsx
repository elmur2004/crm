import { redirect } from "next/navigation";
import { requirePageRole } from "@/lib/auth/page-guards";
import { bsRoleOf } from "@/lib/api/bsystems";
import { listRegistrations } from "@/lib/services/users";
import { formatCairo } from "@/lib/datetime";
import { RegistrationActions } from "@/components/bsystems/registrations";

export const metadata = { title: "Registrations — B-Systems CRM" };

/* V2 §2.8 + founder V3: Registrations is the APPROVAL CYCLE — new agent
   sign-ups arrive here as pending requests; the admin approves or declines
   them. Below that, the registry of everyone on the system. */

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
  const pending = registrations.filter((u) => u.registrationStatus === "pending");

  return (
    <div className="space-y-6">
      <div className="page-head">
        <div>
          <p className="u-eyebrow">B-SYSTEMS · REGISTRATIONS</p>
          <h1 className="u-h1">Registrations</h1>
        </div>
      </div>

      <section className="card card--flush0">
        <div className="card-head">
          <h2 className="u-h3">Awaiting approval</h2>
          <span className="count-pill" data-stage-key="won">
            {pending.length}
          </span>
        </div>
        {pending.length === 0 ? (
          <p className="empty m-4">No pending requests — new sign-ups land here for review.</p>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Requested</th>
                  <th>Decision</th>
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
          <h2 className="u-h3">Everyone on the system</h2>
        </div>
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
                <tr key={u.id} data-inactive={u.active ? undefined : ""}>
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
                    {u.registrationStatus === "pending" ? (
                      <span className="badge badge--entity badge--entity-both">Pending</span>
                    ) : u.registrationStatus === "rejected" ? (
                      <span className="badge badge--danger">Declined</span>
                    ) : u.active ? (
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
      </section>
    </div>
  );
}
