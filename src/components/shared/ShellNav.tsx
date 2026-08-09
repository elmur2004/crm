"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/* Design-system nav items (spec §2.1) — client only for the active state. */

export function ShellNav({ items }: { items: Array<{ href: string; label: string }> }) {
  const pathname = usePathname();
  /* longest matching href wins so /b-systems doesn't stay active on /b-systems/crm */
  const active = items
    .filter((i) => pathname === i.href || pathname.startsWith(`${i.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  return (
    <nav className="app-nav">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="nav-item"
          aria-current={item.href === active ? "page" : undefined}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
