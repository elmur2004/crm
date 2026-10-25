"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/* Refresh on return (dashboard spec §5.3). The founder leaves the Home for the
   board, moves a deal, and comes back to a tab that was rendered before the
   move. When the tab becomes visible again and the last refresh is more than a
   minute old, ask the server for the page again: `router.refresh()` keeps the
   DOM, so nothing re-draws — the numbers that changed count to their new
   values and the bars ease to their new lengths. Renders nothing. */

const STALE_MS = 60_000;

export function DashboardRefresh() {
  const router = useRouter();
  const last = useRef(Date.now());

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - last.current < STALE_MS) return;
      last.current = Date.now();
      router.refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [router]);

  return null;
}
