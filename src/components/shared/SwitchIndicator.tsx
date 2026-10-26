"use client";

import { useLayoutEffect, useRef } from "react";

/* The SLIDING ACTIVE PILL of a segmented switch (.switcher) — language,
   theme, module, company. One aria-hidden span, the switcher's last child;
   it measures the active segment and glass.css paints one pill behind the
   segments at that place, which motion.css slides (under reduced motion it
   simply jumps).

   PROGRESSIVE, and robust by construction:
   · Server-rendered HTML has no indicator — the active segment paints its own
     background exactly as before. Only once this island has measured does it
     set [data-indicator] on the switcher, which hands the paint to the pill.
     No JavaScript, no pill: nothing is ever missing.
   · It reads LAYOUT (offsetLeft / offsetWidth), never getBoundingClientRect,
     so an entrance transform on an ancestor can never skew it; it converts
     to a LOGICAL offset from the inline start, so Arabic needs no second
     code path (the CSS multiplies by the direction).
   · It re-measures when the active segment changes (aria-current /
     aria-pressed — the theme toggle flips in place, the language toggle after
     router.refresh), and when anything resizes (a late font swap, the
     breakpoint where a switch becomes a full-width bar).
   · It is NEVER active inside the sign-in's toolbar (.lg-top): ADR-092's
     login keeps its own pills and must render exactly as it shipped.
   · It renders nothing a person can reach: aria-hidden, no role, no name —
     every accessible name and every segment count stays what the e2e suite
     knows. */

const ACTIVE = ':scope > .switcher-seg:is([aria-current="true"], [aria-current="page"], [aria-pressed="true"])';

export function SwitchIndicator() {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const ind = ref.current;
    const sw = ind?.parentElement;
    if (!ind || !sw || sw.closest(".lg-top")) return;

    let raf = 0;
    const place = () => {
      raf = 0;
      const active = sw.querySelector<HTMLElement>(ACTIVE);
      if (!active || active.offsetWidth === 0) {
        sw.removeAttribute("data-indicator");
        return;
      }
      const rtl = getComputedStyle(sw).direction === "rtl";
      const x = rtl ? sw.clientWidth - active.offsetLeft - active.offsetWidth : active.offsetLeft;
      ind.style.setProperty("--ind-x", `${x}px`);
      ind.style.setProperty("--ind-y", `${active.offsetTop}px`);
      ind.style.setProperty("--ind-w", `${active.offsetWidth}px`);
      ind.style.setProperty("--ind-h", `${active.offsetHeight}px`);
      if (!sw.hasAttribute("data-indicator")) sw.setAttribute("data-indicator", "");
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(place);
    };

    place();
    const ro = new ResizeObserver(schedule);
    ro.observe(sw);
    for (const seg of sw.querySelectorAll(":scope > .switcher-seg")) ro.observe(seg);
    const mo = new MutationObserver(schedule);
    mo.observe(sw, { subtree: true, attributes: true, attributeFilter: ["aria-current", "aria-pressed"] });
    /* the direction flips on <html> when the language changes */
    const dirMo = new MutationObserver(schedule);
    dirMo.observe(document.documentElement, { attributes: true, attributeFilter: ["dir"] });

    return () => {
      ro.disconnect();
      mo.disconnect();
      dirMo.disconnect();
      if (raf) cancelAnimationFrame(raf);
      sw.removeAttribute("data-indicator");
    };
  }, []);

  return <span ref={ref} className="switch-ind" aria-hidden="true" />;
}
