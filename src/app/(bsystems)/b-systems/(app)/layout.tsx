import { AppNav } from "@/components/internal/AppNav";
import { requirePageRole } from "@/lib/auth/page-guards";

/* §7.1 — App B navigation: Home | Leads | CRM | Clients | Partners Pipeline | Partners */

export default async function BSystemsAppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requirePageRole("/b-systems/login", "bsystems_staff");
  return (
    <>
      <AppNav
        brand="bsystems"
        basePath="/b-systems"
        userName={user.name}
        extraItems={[
          { href: "/b-systems/partners-pipeline", label: "Partners Pipeline" },
          { href: "/b-systems/partners", label: "Partners" },
        ]}
      />
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
    </>
  );
}
