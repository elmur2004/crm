"use client";

import { useEffect, useState } from "react";
import { msUntilNextCairoDay, utcToCairo } from "@/lib/datetime";

/* ============================================================================
   ADR-082 (review) — TODAY'S CAIRO DAY, FOR A SCREEN THAT STAYS OPEN.

   Three client surfaces divide their cards by today's Cairo day: the Fallen
   behind split on both lead boards, and the Today chip on three column heads.
   They all need the same three things, and getting any one of them wrong is
   invisible until the day it isn't.

     1. NOT AT RENDER. These boards are server-rendered, so a clock read during
        render disagrees with the HTML the server sent and hydration mismatches.
        The day is therefore `null` on the first paint and lands a beat later —
        which is honestly "not known yet" rather than a guess, and every caller
        has to say what it shows in the meantime.

     2. RE-SAMPLED AT THE NEXT CAIRO MIDNIGHT. `useEffect(…, [])` samples ONCE
        PER MOUNT, and `router.refresh()` re-renders the tree without
        remounting: a tab left open across midnight kept yesterday's division
        for ever, while the SERVER had already moved on. On the board that meant
        an overdue card still sitting in Following Up, where pressing "Didn't
        answer" books nothing (the auto-log needs the live follow-up to be due
        TODAY) and the Today chip beside it counts a different day — three
        surfaces disagreeing on one screen. The re-arm is computed from the
        Cairo day's own end (`msUntilNextCairoDay`), never a fixed 24 hours,
        because Egypt's 23- and 25-hour days would otherwise drift it an hour
        off on the two days a wrong answer is hardest to notice.

     3. RE-SAMPLED WHEN THE TAB COMES BACK. A background tab's timers are
        throttled and, when the machine sleeps, not fired at all — so the timer
        alone is not enough. `visibilitychange` covers the phone picked up in
        the morning, which is the actual way this is used. Both paths call the
        same sampler, and the sampler re-arms itself, so there is one code path
        and it cannot be left un-armed.

   `setToday` with the SAME string is a no-op in React, so a spurious wake (an
   early timer, a tab focused twice) costs nothing and renders nothing.
   ========================================================================== */
export function useCairoToday(): string | null {
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let live = true;
    const sample = () => {
      if (!live) return;
      const now = new Date();
      setToday(utcToCairo(now).date);
      if (timer !== undefined) clearTimeout(timer);
      /* +1s past the boundary: a timer that fires a hair EARLY would re-sample
         the same day, and then wait another whole day to notice the new one. */
      timer = setTimeout(sample, msUntilNextCairoDay(now) + 1_000);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") sample();
    };
    sample();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      live = false;
      if (timer !== undefined) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return today;
}
