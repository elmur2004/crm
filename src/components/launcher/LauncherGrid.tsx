import Link from "next/link";
import type { CSSProperties } from "react";
import type { AppId, IconPalette } from "@/lib/launcher/apps";
import { AppIcon, type Glyph } from "./AppIcon";

/* The icon grid itself (founder: "little icons opening each section").

   Each tile is ONE real link — the icon and the name together are the target,
   so the whole 44px-plus square is clickable on a phone — and its accessible
   name is the visible name (the icon is aria-hidden). Keyboard order is DOM
   order is the founder's order; under dir="rtl" the flex row runs from the
   right on its own, so Arabic reads the same order mirrored, with no second
   list to keep in step.

   No JavaScript: a server component rendering plain anchors, so the grid is
   on screen and usable before (or without) hydration. The entrance is CSS
   only, and only under prefers-reduced-motion: no-preference (launcher.css). */

const GLYPH: Record<AppId, Glyph> = {
  "crm-byteforce": "crm",
  "crm-bsystems": "crm",
  accounting: "accounting",
  vault: "vault",
  todo: "todo",
  reports: "reports",
  partners: "partners",
};

export interface GridItem {
  id: AppId;
  href: string;
  label: string;
  palette: IconPalette;
}

export function LauncherGrid({ items, labelledBy }: { items: GridItem[]; labelledBy: string }) {
  return (
    <ul className="lx-grid" role="list" aria-labelledby={labelledBy}>
      {items.map((item, i) => (
        <li key={item.id} style={{ "--lx-i": i } as CSSProperties}>
          <Link href={item.href} prefetch={false} className="lx-tile" data-app={item.id}>
            <AppIcon glyph={GLYPH[item.id]} palette={item.palette} />
            <span className="lx-name">{item.label}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
