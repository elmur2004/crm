"use client";

import { useEffect } from "react";

/* The sign-in's one bit of pointer magic, and the only JavaScript the glass
   needs: on a desktop with a mouse, the ground's two depths drift gently
   against the pointer (parallax) and a soft specular light follows it across
   the glass card.

   It renders nothing. It writes four custom properties — --lg-mx / --lg-my
   (-1…1, on the shell) and --lg-sx / --lg-sy (px inside the card, on the
   light) — at most once per animation frame, and login.css turns them into
   transforms (the CSS smooths them with a transition). It never reads layout
   inside the frame: the card's box is measured on resize/scroll only.

   INERT unless BOTH hold, re-checked whenever either media query changes:
   · (hover: hover) and (pointer: fine) — no touch screen ever runs it;
   · not (prefers-reduced-motion: reduce) — and the transforms it feeds live
     inside the reduced-motion fence in the CSS as well.
   Only decorative, aria-hidden, pointer-events:none layers move; nothing a
   person (or a test) clicks is ever displaced by it. */

export function LoginAmbient() {
  useEffect(() => {
    const shell = document.querySelector<HTMLElement>(".lg-shell");
    const card = document.querySelector<HTMLElement>(".lg-card");
    const light = document.querySelector<HTMLElement>(".lg-light");
    if (!shell || !card || !light) return;

    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)");

    let raf = 0;
    let px = 0;
    let py = 0;
    let rect = card.getBoundingClientRect();
    let live = false;

    const measure = () => {
      rect = card.getBoundingClientRect();
    };
    const frame = () => {
      raf = 0;
      const w = window.innerWidth || 1;
      const h = window.innerHeight || 1;
      shell.style.setProperty("--lg-mx", ((px / w) * 2 - 1).toFixed(3));
      shell.style.setProperty("--lg-my", ((py / h) * 2 - 1).toFixed(3));
      light.style.setProperty("--lg-sx", `${Math.round(px - rect.left)}px`);
      light.style.setProperty("--lg-sy", `${Math.round(py - rect.top)}px`);
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      px = e.clientX;
      py = e.clientY;
      if (!shell.hasAttribute("data-live")) shell.setAttribute("data-live", "");
      if (!raf) raf = requestAnimationFrame(frame);
    };
    const onLeave = () => {
      shell.removeAttribute("data-live");
      shell.style.setProperty("--lg-mx", "0");
      shell.style.setProperty("--lg-my", "0");
    };

    const start = () => {
      measure();
      window.addEventListener("pointermove", onMove, { passive: true });
      window.addEventListener("resize", measure, { passive: true });
      window.addEventListener("scroll", measure, { passive: true });
      document.documentElement.addEventListener("pointerleave", onLeave);
    };
    const stop = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      shell.removeAttribute("data-live");
      for (const p of ["--lg-mx", "--lg-my"]) shell.style.removeProperty(p);
      for (const p of ["--lg-sx", "--lg-sy"]) light.style.removeProperty(p);
    };
    const sync = () => {
      const want = fine.matches && !calm.matches;
      if (want === live) return;
      live = want;
      if (want) start();
      else stop();
    };

    sync();
    fine.addEventListener("change", sync);
    calm.addEventListener("change", sync);
    return () => {
      fine.removeEventListener("change", sync);
      calm.removeEventListener("change", sync);
      if (live) stop();
    };
  }, []);

  return null;
}
