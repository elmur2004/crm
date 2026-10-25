"use client";

import { useEffect } from "react";

/* The printed commission statement is ALWAYS light — it is a document that
   leaves the building, and nobody prints a dark page on purpose.

   The first wall is the CSS: every dark token block is scoped to
   `@media screen`, so print media never matches one. This is the second,
   independent of how any stylesheet is written: for as long as the browser is
   printing, the document's theme IS light. It covers every way into the print
   dialog — the page's Print button, Ctrl/Cmd+P, the browser menu, Save as
   PDF — because all of them fire beforeprint/afterprint, and it restores the
   reader's own theme the moment the dialog closes. Renders nothing. */
export function PrintLight() {
  useEffect(() => {
    const html = document.documentElement;
    let saved: string | null = null;
    const before = () => {
      saved = html.getAttribute("data-theme");
      html.setAttribute("data-theme", "light");
    };
    const after = () => {
      if (saved === null) return;
      html.setAttribute("data-theme", saved);
      saved = null;
    };
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
      after();
    };
  }, []);
  return null;
}
