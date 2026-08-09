import Link from "next/link";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { NotificationsBell } from "@/components/bsystems/NotificationsBell";
import { logout } from "@/lib/auth/actions";
import { requirePageRole } from "@/lib/auth/page-guards";
import { bsRoleOf } from "@/lib/api/bsystems";

/* V2 §2 — ONE role-aware B-Systems app (the portal is gone). Navigation per role:
   admin the ten sections; sales CRM + Won Leads; agents/partners CRM + Won Leads +
   Payments + Profile. Guards stay server-side — the nav only mirrors them. */

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
  const items = NAV[role];
  return (
    <>
      <header className="border-b border-brand-border bg-brand-surface-card">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-x-4 gap-y-2 flex-wrap">
          <Link href={items[0].href} className="shrink-0">
            <BrandLogo brand="bsystems" variant="mark" height={36} />
          </Link>
          <nav className="flex gap-1 flex-1 flex-wrap">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="px-2.5 py-1.5 rounded-brand-control text-sm font-medium text-brand-link hover:bg-brand-surface-tint"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <NotificationsBell />
          <form action={logout.bind(null, "/login")}>
            <button
              type="submit"
              className="text-sm text-brand-muted hover:text-brand-ink"
              title={user.name}
            >
              Log out
            </button>
          </form>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
    </>
  );
}
