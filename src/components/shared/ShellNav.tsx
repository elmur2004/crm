"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "@/components/shared/LocaleProvider";
import { tFor } from "@/lib/i18n/core";
import { shell } from "@/lib/i18n/dict/auth";

/* Design-system nav (spec §2.1) — desktop: inline items; small screens (≤820px):
   a menu button opening a full-width sheet with tap-friendly rows. `extras`
   (entity switcher, log out) render inside the sheet too, so every control
   stays reachable however tight the screen gets. */

export function ShellNav({
  items,
  extras,
}: {
  items: Array<{ href: string; label: string }>;
  extras?: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const t = tFor(useLocale());

  /* longest matching href wins so /b-systems doesn't stay active on /b-systems/crm.
     Module navs carry ?company=&month= on every item (the view survives
     navigation) — match on the PATH alone. */
  const pathOf = (href: string) => href.split("?")[0]!;
  const active = items
    .filter((i) => pathname === pathOf(i.href) || pathname.startsWith(`${pathOf(i.href)}/`))
    .sort((a, b) => pathOf(b.href).length - pathOf(a.href).length)[0]?.href;

  useEffect(() => setOpen(false), [pathname]); // navigating closes the sheet

  return (
    <>
      <nav className="app-nav nav-desktop">
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

      <button
        type="button"
        className="nav-burger"
        aria-label={open ? t(shell.closeMenu) : t(shell.openMenu)}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          {open ? (
            <>
              <line x1="5" y1="5" x2="19" y2="19" />
              <line x1="19" y1="5" x2="5" y2="19" />
            </>
          ) : (
            <>
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </>
          )}
        </svg>
      </button>

      {open ? (
        <>
          <div className="nav-sheet-backdrop" onClick={() => setOpen(false)} aria-hidden />
          <div className="nav-sheet" role="menu">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="nav-sheet-link"
                aria-current={item.href === active ? "page" : undefined}
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            {extras ? <div className="nav-sheet-extras">{extras}</div> : null}
          </div>
        </>
      ) : null}
    </>
  );
}
