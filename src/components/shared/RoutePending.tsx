"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { RouteSkeleton, type SkeletonKind } from "./RouteSkeleton";

/* ============================================================================
   THE INSTANT ANSWER TO A CLICK — route skeletons without a Suspense boundary.

   The motion pass asked that navigation feel instant: the moment a person
   follows a link to another screen, the page shows that screen's shape
   (RouteSkeleton), shimmering, until the real one lands.

   WHY NOT loading.tsx. A loading.tsx is a Suspense boundary, and Next streams
   every request through it — the document load included: the skeleton is
   sent first and the real page arrives later inside a hidden <div>, revealed
   by an inline script. With JavaScript off the page NEVER reveals (the board
   stays a skeleton — e2e/fallen-behind.spec proves the no-JS paint), and with
   it on React 19.2 batches the reveal a beat after `load`, so for a frame the
   real page exists but is hidden. Both break promises this product keeps:
   every page complete without JavaScript, and the first byte already the
   page. So the server renders exactly as before, and the skeleton is this
   client island's job, on CLIENT navigations only.

   HOW. One capture-phase click listener: a plain left click on a same-origin
   link into the app (/b-systems, /accounting, /vault) whose PATH differs from
   the current one. After 120 ms — a fast navigation never flashes anything —
   the old page is hidden (kept mounted: Next's router owns that subtree) and
   the target's skeleton shows in its place. The moment the new URL commits
   (a layout effect, so before the paint) it is the real page again. Same-path
   changes (a filter, a period, the company) keep the old page on screen, as a
   transition should — and their charts do not redraw. A navigation that
   never commits (a refused redirect, a download) gives up after 8 s.

   Nothing here is reachable by a person: the skeleton is aria-hidden but for
   one role=status sentence, and every accessible name on the real page is
   untouched. Without JavaScript this renders the page and nothing else. */

const DELAY_MS = 120;
const GIVE_UP_MS = 8000;
const APP_PATH = /^\/(b-systems|accounting|vault)(\/|$)/;

/** The skeleton that matches the screen a path opens. */
export function skeletonFor(pathname: string): SkeletonKind {
  const p = pathname.replace(/\/+$/, "");
  if (p === "/b-systems") return "home";
  if (/\/call$/.test(p)) return "call";
  if (/^\/b-systems\/(crm|leads)\/lead\/[^/]+$/.test(p)) return "lead";
  if (/^\/b-systems\/(partners-pipeline|won-leads|partners)\/[^/]+$/.test(p)) return "lead";
  if (p === "/b-systems/crm" || p === "/b-systems/partners-pipeline") return "board";
  if (p === "/b-systems/leads") return "list";
  if (p === "/b-systems/todo") return "todo";
  if (/^\/b-systems\/(won-leads|clients|users|registrations|statements|payments|leads\/rep\/[^/]+)$/.test(p)) return "table";
  if (p === "/accounting") return "accounting";
  if (p === "/accounting/import") return "page";
  if (p.startsWith("/accounting/")) return "table";
  if (p === "/vault") return "vault";
  if (p.startsWith("/vault/")) return "table";
  return "page";
}

/** The destination of a click, when it is an in-app navigation to another path. */
function destination(e: MouseEvent): URL | null {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return null;
  const target = e.target as Element | null;
  const a = target?.closest?.("a[href]") as HTMLAnchorElement | null;
  if (!a || a.hasAttribute("download")) return null;
  if (a.target && a.target !== "_self") return null;
  let url: URL;
  try {
    url = new URL(a.href, window.location.href);
  } catch {
    return null;
  }
  if (url.origin !== window.location.origin || !APP_PATH.test(url.pathname)) return null;
  if (url.pathname === window.location.pathname) return null;
  return url;
}

export function RoutePending({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [pending, setPending] = useState<SkeletonKind | null>(null);
  const timers = useRef<number[]>([]);

  const clear = () => {
    for (const id of timers.current) window.clearTimeout(id);
    timers.current = [];
  };

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const url = destination(e);
      if (!url) return;
      clear();
      const kind = skeletonFor(url.pathname);
      timers.current.push(
        window.setTimeout(() => setPending(kind), DELAY_MS),
        window.setTimeout(() => setPending(null), GIVE_UP_MS),
      );
    };
    const reset = () => {
      clear();
      setPending(null);
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", reset);
    window.addEventListener("pageshow", reset);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", reset);
      window.removeEventListener("pageshow", reset);
      clear();
    };
  }, []);

  /* the new URL has committed: the real page, before the browser paints */
  useLayoutEffect(() => {
    clear();
    setPending(null);
  }, [pathname, search]);

  return (
    <>
      {pending ? <RouteSkeleton kind={pending} /> : null}
      <div className="route-host" data-pending={pending ? "" : undefined}>
        {children}
      </div>
    </>
  );
}
