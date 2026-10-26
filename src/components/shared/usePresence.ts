"use client";

import { useEffect, useState } from "react";

/* Keeps a closing pop-up mounted for its exit animation (motion.css:
   [data-closing] plays --duration-short of mo-out, then the element goes).

   `mounted` — render it; `closing` — it is on its way out: stamp
   data-closing on it, and make it inert (motion.css also removes its pointer
   events), so for those few frames nobody can click it, tab into it or find
   it by role. Under prefers-reduced-motion there is no exit: it unmounts on
   the next commit, exactly as before this hook. Opening is never delayed —
   `mounted` is true on the very render that opens it.

   For any component that renders a pop-up conditionally:
     const { mounted, closing } = usePresence(open);
     {mounted ? <div className="…" data-closing={closing ? "" : undefined}
                     inert={closing} aria-hidden={closing || undefined}>…</div> : null} */

const EXIT_MS = 140; // --duration-short

export function usePresence(open: boolean, exitMs: number = EXIT_MS) {
  const [kept, setKept] = useState(open);

  useEffect(() => {
    if (open) {
      setKept(true);
      return;
    }
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (calm || exitMs <= 0) {
      setKept(false);
      return;
    }
    const id = window.setTimeout(() => setKept(false), exitMs);
    return () => window.clearTimeout(id);
  }, [open, exitMs]);

  return { mounted: open || kept, closing: !open && kept };
}
