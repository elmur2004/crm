import Link from "next/link";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { logout } from "@/lib/auth/actions";

/* §8.1 — rep navigation: CRM | Won Deals | Profile (admin gets its own nav in
   Phase 4). */

export function PortalNav({
  userName,
  items,
  homeHref = "/portal/crm",
}: {
  userName: string;
  items: Array<{ href: string; label: string }>;
  homeHref?: string;
}) {
  return (
    <header className="border-b border-brand-border bg-brand-surface-card">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-x-6 gap-y-2 flex-wrap">
        <Link href={homeHref} className="shrink-0">
          <BrandLogo brand="bsystems" variant="mark" height={32} />
        </Link>
        <nav className="flex gap-1 flex-1 flex-wrap">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="px-3 py-1.5 rounded-brand-control text-sm font-medium text-brand-link hover:bg-brand-surface-tint"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <form action={logout.bind(null, "/portal")}>
          <button type="submit" className="text-sm text-brand-muted hover:text-brand-ink" title={userName}>
            Log out
          </button>
        </form>
      </div>
    </header>
  );
}
