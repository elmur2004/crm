import { PortalNav } from "@/components/portal/PortalNav";
import { requirePageRole } from "@/lib/auth/page-guards";

/* §8.5 — admin layer shell: Dashboard | CRM | Won Deals | Sales Team. */

export default async function PortalAdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requirePageRole("/login", "portal_admin");
  return (
    <>
      <PortalNav
        userName={user.name}
        homeHref="/portal/admin"
        items={[
          { href: "/portal/admin", label: "Dashboard" },
          { href: "/portal/admin/crm", label: "CRM" },
          { href: "/portal/admin/won-deals", label: "Won Deals" },
          { href: "/portal/admin/sales-team", label: "Sales Team" },
        ]}
      />
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
    </>
  );
}
