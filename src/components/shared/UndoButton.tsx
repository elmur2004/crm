"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { tFor } from "@/lib/i18n/core";
import { useLocale } from "@/components/shared/LocaleProvider";
import { undoMsgs as m } from "@/lib/i18n/dict/undo";

/* Founder: "an undo button that undoes the last action I did on the system"
   (ADR-045). A snackbar-style pill pinned to the bottom start of the viewport,
   NOT a header item: both app headers are already full at 1440px (adding a chip
   there pushed nav links into the hidden overflow). Floating also lets it carry
   the full description — the label the SERVER stored when the action happened —
   so it always names exactly what it is about to revert.

   It asks nothing: an undo IS the confirmation. The outcome comes back through
   the shared toast, then router.refresh() re-renders the page (and the layout,
   which is what makes the pill disappear once the entry is consumed). */

export function UndoButton({ description }: { description: string }) {
  const t = tFor(useLocale());
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);

  async function run() {
    setBusy(true);
    setToast(null);
    const res = await fetch("/api/undo", { method: "POST" });
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    setBusy(false);
    if (!res.ok) {
      setToast({ text: data?.error ?? t(m.failed), ok: false });
      router.refresh(); // the entry may be gone — let the pill re-evaluate
      return;
    }
    setToast({ text: `${t(m.undone)}: ${description}`, ok: true });
    router.refresh();
  }

  return (
    <>
      <div className="undo-fab no-print">
        <button
          type="button"
          className="undo-btn"
          onClick={run}
          disabled={busy}
          title={`${t(m.undo)}: ${description}`}
          aria-label={`${t(m.undo)}: ${description}`}
        >
          <svg className="undo-icon" viewBox="0 0 16 16" aria-hidden focusable="false">
            {/* counter-clockwise arrow: the glyph is drawn, never a font emoji */}
            <path
              d="M3.4 6.4a5.2 5.2 0 1 1-.7 3.3"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
            <path d="M1.6 2.9v4h4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="undo-label">{busy ? t(m.working) : t(m.undo)}</span>
          <span className="undo-what" aria-hidden>
            {description}
          </span>
        </button>
      </div>
      {toast ? (
        <div className="toast-wrap">
          <p role="alert" className={toast.ok ? "toast toast--ok" : "toast"}>
            <span className="toast-icon" aria-hidden>
              !
            </span>
            {toast.text}
          </p>
        </div>
      ) : null}
    </>
  );
}
