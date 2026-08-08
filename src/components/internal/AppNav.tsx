import Link from "next/link";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { logout } from "@/lib/auth/actions";
import type { Brand } from "@/lib/pipeline-engine/constants";

/* Internal CRM navigation (§6: Home | Leads | CRM | Clients; App B appends
   Partners Pipeline | Partners in Phase 2). Logical properties only (RTL, A-12). */

export function AppNav({
  brand,
  basePath,
  userName,
  extraItems = [],
}: {
  brand: Brand;
  basePath: string;
  userName: string;
  extraItems?: Array<{ href: string; label: string }>;
}) {
  const items = [
    { href: basePath, label: "Home" },
    { href: `${basePath}/leads`, label: "Leads" },
    { href: `${basePath}/crm`, label: "CRM" },
    { href: `${basePath}/clients`, label: "Clients" },
    ...extraItems,
  ];
  const logoutTo = `${basePath}/login`;
  return (
    <header className="border-b border-brand-border bg-brand-surface-card">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-6">
        <Link href={basePath} className="shrink-0">
          <BrandLogo brand={brand} variant={brand === "bsystems" ? "mark" : "horizontal"} height={36} />
        </Link>
        <nav className="flex gap-1 flex-1">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="px-3 py-1.5 rounded-brand-control text-sm font-medium text-brand-secondary hover:bg-brand-surface-tint"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <form action={logout.bind(null, logoutTo)}>
          <button
            type="submit"
            className="text-sm text-brand-muted hover:text-brand-ink"
            title={userName}
          >
            Log out
          </button>
        </form>
      </div>
    </header>
  );
}
