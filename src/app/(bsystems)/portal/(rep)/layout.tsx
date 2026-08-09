import { PortalNav } from "@/components/portal/PortalNav";
import { requirePageRole } from "@/lib/auth/page-guards";

/* §8.1 — rep portal shell: CRM | Won Deals | Profile. */

export default async function PortalRepLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requirePageRole("/login", "portal_rep", "portal_admin");
  return (
    <>
      <PortalNav
        userName={user.name}
        items={[
          { href: "/portal/crm", label: "CRM" },
          { href: "/portal/won-deals", label: "Won Deals" },
          { href: "/portal/profile", label: "Profile" },
        ]}
      />
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
    </>
  );
}
