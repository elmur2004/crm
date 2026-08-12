import Link from "next/link";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { NotificationsBell } from "@/components/bsystems/NotificationsBell";
import { ImpersonationBar } from "@/components/shared/ImpersonationBar";
import { EntitySwitch } from "@/components/shared/EntitySwitch";
import { ShellNav } from "@/components/shared/ShellNav";
import { logout } from "@/lib/auth/actions";
import { requirePageRole } from "@/lib/auth/page-guards";
import { bsRoleOf } from "@/lib/api/bsystems";

/* V2 §2 — ONE role-aware B-Systems app. Chrome per the approved prototype
   (spec §2.1): dark indigo header for admin + internal sales; agents/partners
   keep the deep-navy external identity (data-shell="external", spec R8).
   Guards stay server-side — the nav only mirrors them. */

const NAV: Record<string, Array<{ href: string; label: string }>> = {
  bsystems_admin: [
    { href: "/b-systems", label: "Home" },
    { href: "/b-systems/leads", label: "Leads" },
    { href: "/b-systems/crm", label: "CRM" },
    { href: "/b-systems/won-leads", label: "Won Leads" },
    { href: "/b-systems/partners-pipeline", label: "Partnership CRM" },
    { href: "/b-systems/partners", label: "Partners" },
    { href: "/b-systems/agents", label: "Agents" },
    { href: "/b-systems/registrations", label: "Registrations" },
    { href: "/b-systems/statements", label: "Statements" },
    { href: "/b-systems/users", label: "Users" },
  ],
  bsystems_sales: [
    { href: "/b-systems/crm", label: "CRM" },
    { href: "/b-systems/won-leads", label: "Won Leads" },
  ],
  bsystems_agent: [
    { href: "/b-systems/crm", label: "CRM" },
    { href: "/b-systems/won-leads", label: "Won Leads" },
    { href: "/b-systems/payments", label: "Payments" },
    { href: "/b-systems/profile", label: "Profile" },
  ],
  bsystems_partner: [
    { href: "/b-systems/crm", label: "CRM" },
    { href: "/b-systems/won-leads", label: "Won Leads" },
    { href: "/b-systems/payments", label: "Payments" },
    { href: "/b-systems/profile", label: "Profile" },
  ],
};

const ROLE_LABELS: Record<string, string> = {
  bsystems_admin: "Admin",
  bsystems_sales: "Internal sales",
  bsystems_agent: "Agent",
  bsystems_partner: "Partner",
};

export default async function BSystemsAppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requirePageRole(
    "/login",
    "bsystems_admin",
    "bsystems_sales",
    "bsystems_agent",
    "bsystems_partner",
  );
  const role = bsRoleOf(user);
  const external = role === "bsystems_agent" || role === "bsystems_partner";
  const initials = user.name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <>
      <ImpersonationBar />
      <header className="app-header" data-shell={external ? "external" : undefined}>
        {/* founder: the REAL B-Systems mark; clicking it goes to THIS app's
            landing for the current role — never the platform root */}
        <Link
          href={NAV[role]![0]!.href}
          className="shrink-0 flex items-center gap-3"
          aria-label="B-Systems home"
        >
          <BrandLogo brand="bsystems" variant="mark" height={40} />
          <span className="wordmark">B-Systems</span>
        </Link>
        <ShellNav
          items={NAV[role]}
          extras={
            <>
              <EntitySwitch roles={user.roles} current="bsystems" />
              <form action={logout.bind(null, "/login")}>
                <button type="submit" className="nav-item">
                  Log out
                </button>
              </form>
            </>
          }
        />
        <div className="user">
          <NotificationsBell />
          <EntitySwitch roles={user.roles} current="bsystems" />
          <span className="user-avatar" aria-hidden>
            {initials}
          </span>
          <span className="user-meta">
            <span className="user-name block">{user.name}</span>
            <span className="user-role block">{ROLE_LABELS[role]}</span>
          </span>
          <form action={logout.bind(null, "/login")}>
            <button type="submit" className="nav-item" title={user.name}>
              Log out
            </button>
          </form>
        </div>
      </header>
      <main className="page max-w-7xl mx-auto w-full">{children}</main>
    </>
  );
}
