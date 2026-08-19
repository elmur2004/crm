"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "@/components/shared/LocaleProvider";
import { tFor } from "@/lib/i18n/core";
import { shell } from "@/lib/i18n/dict/auth";

/* Design-system nav (spec §2.1) — desktop: inline items; small screens (≤820px):
   a menu button opening a full-width sheet with tap-friendly rows. `extras`
   (entity switcher, log out) render inside the sheet too, so every control
   stays reachable however tight the screen gets.

   Founder (screenshot: "Registrations" cut to "Regi"): the desktop strip used
   to scroll with NO affordance — clipped items were invisible in practice. It
   is now a proper slider: when (and only when) the strip overflows, chevrons
   appear over its ends and the clipped edge fades out (a mask, so it works on
   every header ground — white, indigo, the module brands). All the math is
   LOGICAL start/end — |scrollLeft| is the distance from the inline start in
   both directions — so Arabic works unchanged. The active item is brought
   into view on navigation: the page you are ON is never the hidden one. */

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
  const stripRef = useRef<HTMLElement | null>(null);
  const [fade, setFade] = useState({ start: false, end: false });

  /* longest matching href wins so /b-systems doesn't stay active on /b-systems/crm.
     Module navs carry ?company=&month= on every item (the view survives
     navigation) — match on the PATH alone. */
  const pathOf = (href: string) => href.split("?")[0]!;
  const active = items
    .filter((i) => pathname === pathOf(i.href) || pathname.startsWith(`${pathOf(i.href)}/`))
    .sort((a, b) => pathOf(b.href).length - pathOf(a.href).length)[0]?.href;

  useEffect(() => setOpen(false), [pathname]); // navigating closes the sheet

  /* Measured off the ITEMS' fractional rects, never off scrollWidth/clientWidth:
     those are integer-rounded, so at a fractional browser zoom (90%, 110%) a
     label clipped by up to 1px yielded max = 0 — no chevron, no fade, silently
     truncated text. That is exactly the founder's "Registrations → Regi"
     screenshot coming back at a zoom step. getBoundingClientRect is sub-pixel,
     and comparing the content's edges with the strip's box also removes the
     scrollLeft sign handling that RTL needed. */
  const measure = useCallback(() => {
    const el = stripRef.current;
    if (!el) return;
    const kids = [...el.children].map((c) => c.getBoundingClientRect());
    if (kids.length === 0) return setFade({ start: false, end: false });
    const box = el.getBoundingClientRect();
    const hiddenLeft = box.left - Math.min(...kids.map((r) => r.left));
    const hiddenRight = Math.max(...kids.map((r) => r.right)) - box.right;
    const rtl = getComputedStyle(el).direction === "rtl";
    setFade({
      start: (rtl ? hiddenRight : hiddenLeft) > 0.5,
      end: (rtl ? hiddenLeft : hiddenRight) > 0.5,
    });
  }, []);

  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    /* a late font swap changes item widths without resizing the strip */
    document.fonts?.ready.then(measure).catch(() => undefined);
    return () => ro.disconnect();
  }, [measure, items.length]);

  /* the current page's tab must never be the hidden one */
  useEffect(() => {
    stripRef.current
      ?.querySelector('[aria-current="page"]')
      ?.scrollIntoView({ behavior: "instant", block: "nearest", inline: "nearest" });
    measure();
  }, [active, measure]);

  /* dir is LOGICAL (+1 toward the inline end); under RTL the same motion is a
     negative scrollLeft. A press pages by 70% of the visible strip — with a
     160px FLOOR: on a shell whose header squeezes the strip down to a sliver,
     70% of almost-nothing would crawl, and the arrows must still move you. */
  function slide(dir: 1 | -1) {
    const el = stripRef.current;
    if (!el) return;
    const rtl = getComputedStyle(el).direction === "rtl";
    const page = Math.max(el.clientWidth * 0.7, 160);
    el.scrollBy({ left: dir * (rtl ? -1 : 1) * page, behavior: "smooth" });
  }

  const chevron = (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="9 6 15 12 9 18" />
    </svg>
  );

  return (
    <>
      <div
        className="nav-strip nav-desktop"
        data-fade={
          fade.start && fade.end ? "both" : fade.start ? "start" : fade.end ? "end" : undefined
        }
      >
        {fade.start ? (
          <button
            type="button"
            className="nav-scroll nav-scroll--start"
            aria-label={t(shell.navScrollBack)}
            onClick={() => slide(-1)}
          >
            {/* the glyph points toward the LOGICAL start */}
            <span className="inline-block -scale-x-100 rtl:scale-x-100">{chevron}</span>
          </button>
        ) : null}
        <nav className="app-nav" ref={stripRef} onScroll={measure}>
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
        {fade.end ? (
          <button
            type="button"
            className="nav-scroll nav-scroll--end"
            aria-label={t(shell.navScrollForward)}
            onClick={() => slide(1)}
          >
            <span className="inline-block rtl:-scale-x-100">{chevron}</span>
          </button>
        ) : null}
      </div>

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
