"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { formatMsg, tFor, type Msg } from "@/lib/i18n/core";
import { useLocale } from "@/components/shared/LocaleProvider";
import { leadsImport as m } from "@/lib/i18n/dict/leads-import";
import { acctCompanies } from "@/lib/i18n/dict/accounting";
import { board, common } from "@/lib/i18n/dict/crm";
import type { CrmCompany } from "@/lib/crm/company";
import {
  MAX_IMPORT_BYTES,
  MAX_IMPORT_MB,
  MAX_IMPORT_ROWS,
  fileErrorMsgs,
  leadsImportHref,
  leadsImportTemplateHref,
  skipReasonsMsg,
  type ImportFileErrorBody,
  type ImportResultBody,
} from "@/lib/crm/leads-import";

/* ============================================================================
   IMPORT LEADS FROM EXCEL — the one button, its two-item menu, and the result.

   Founder, verbatim: "add import lead button when I click on it it gives me the
   option to download the import template or import the leads actually".

   ONE button per Leads page, for THAT page's company, naming it — the import
   lands in the company whose Leads page you are on. Whether it renders at all is
   decided on the SERVER by the page (`canImportLeads`, the same predicate the
   route enforces), so this can never offer an import the server would refuse.
   It is navigation; the wall is lib/api/leads-import-route.ts.

   THE MENU follows the WAI-ARIA menu-button pattern: a real <button> with
   aria-haspopup/aria-expanded; the menu opens on click, Enter, Space or Arrow
   Down; Arrow keys, Home and End move between the two items; Escape closes it
   and returns focus to the button; Tab closes it. Every target is ≥44px on a
   touch screen, and everything is placed with LOGICAL properties (start/end,
   text-start) so it mirrors in Arabic with no extra rule.

   THE RESULT SCREEN says the count imported, the count skipped, and EVERY
   skipped row with its row number and every reason — in the viewer's language,
   from codes the server sends — then refreshes the page so the new leads show.
   ========================================================================== */

type Phase =
  | { kind: "idle" }
  | { kind: "busy"; file: string }
  | { kind: "done"; result: ImportResultBody }
  | { kind: "refused"; lines: Msg[] };

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/* Touch targets: 44px tall on a phone or any coarse pointer, the house rule
   (design-system.css's sheet and accounting buttons). Utilities only, so no
   stylesheet is touched. */
const TOUCH = "max-sm:min-h-11 pointer-coarse:min-h-11";
const ITEM =
  "flex w-full min-h-11 items-center gap-2 px-4 py-2 text-start text-sm font-semibold " +
  "text-brand-ink hover:bg-brand-surface-tint focus-visible:bg-brand-surface-tint cursor-pointer";

export function LeadsImportMenu({ company }: { company: CrmCompany }) {
  const locale = useLocale();
  const t = tFor(locale);
  const router = useRouter();
  const id = useId();
  const buttonId = `${id}-button`;
  const menuId = `${id}-menu`;
  const titleId = `${id}-title`;
  const hintId = `${id}-hint`;

  const [open, setOpen] = useState(false);
  /* px to slide the open menu so it stays on screen (see the layout effect) */
  const [shift, setShift] = useState(0);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [skippedUrl, setSkippedUrl] = useState<string | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const label = t(formatMsg(m.button, { company: acctCompanies[company]! }));

  const items = () =>
    Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
  const focusItem = (index: number) => {
    const list = items();
    list[(index + list.length) % list.length]?.focus();
  };

  /* KEEP THE MENU ON SCREEN. It hangs from the button's inline START, which is
     right wherever the button sits at the start of its row — but on a phone
     the Leads page's actions wrap, and the button can land mid-row, where a
     menu wider than the space after it would run off the edge (the right edge
     in English, the left in Arabic). So it is measured once open and slid back
     inside a 16px gutter. Measuring is the only honest way: the row's wrapping
     depends on the language and on which other buttons the account is shown. */
  useLayoutEffect(() => {
    if (!open || !menuRef.current) {
      setShift(0);
      return;
    }
    const gutter = 16;
    const rect = menuRef.current.getBoundingClientRect();
    const width = document.documentElement.clientWidth;
    let dx = 0;
    if (rect.right > width - gutter) dx = width - gutter - rect.right;
    if (rect.left + dx < gutter) dx = gutter - rect.left;
    setShift(dx);
  }, [open]);

  /* open → focus moves into the menu; a click anywhere else closes it, and so
     does a resize or a rotation (the on-screen shift above was measured for
     the old width — reopening measures afresh) */
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) setOpen(false);
    };
    const onResize = () => setOpen(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  /* the dialog takes focus when it appears, and Escape closes it (not while a
     file is in flight — the answer must not be thrown away unseen) */
  useEffect(() => {
    if (phase.kind === "idle") return;
    dialogRef.current?.focus();
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape" && phase.kind !== "busy") closeDialog();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [phase.kind]);

  /* the skipped-rows download is a Blob URL, released when it is replaced */
  useEffect(() => {
    if (phase.kind !== "done" || !phase.result.skippedFile) return;
    const bytes = Uint8Array.from(atob(phase.result.skippedFile.base64), (c) => c.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: XLSX_MIME }));
    setSkippedUrl(url);
    return () => {
      URL.revokeObjectURL(url);
      setSkippedUrl(null);
    };
  }, [phase]);

  function openMenu(focus: "first" | "last") {
    setOpen(true);
    requestAnimationFrame(() => focusItem(focus === "first" ? 0 : -1));
  }

  function closeMenu(returnFocus: boolean) {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  }

  function closeDialog() {
    setPhase({ kind: "idle" });
    buttonRef.current?.focus();
  }

  function onButtonKey(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openMenu("first");
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      openMenu("last");
    }
  }

  function onMenuKey(e: KeyboardEvent<HTMLDivElement>) {
    const list = items();
    const at = list.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      focusItem(at + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focusItem(at - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      focusItem(0);
    } else if (e.key === "End") {
      e.preventDefault();
      focusItem(-1);
    } else if (e.key === "Escape") {
      e.preventDefault();
      closeMenu(true);
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  }

  /* from the MENU, focus goes back to the button first, so cancelling the
     system file chooser leaves the keyboard where it started; from the
     dialog's "Import another file", the dialog keeps it */
  function chooseFile(from: "menu" | "dialog") {
    closeMenu(from === "menu");
    if (fileRef.current) {
      fileRef.current.value = "";
      fileRef.current.click();
    }
  }

  async function upload(file: File) {
    /* the server refuses all of these too; saying so before the upload is
       only a kindness */
    if (!/\.xlsx$/i.test(file.name)) {
      setPhase({ kind: "refused", lines: [m.errorNotXlsx] });
      return;
    }
    if (file.size > MAX_IMPORT_BYTES) {
      setPhase({
        kind: "refused",
        lines: [formatMsg(m.errorTooLarge, { mb: String(MAX_IMPORT_MB) })],
      });
      return;
    }
    setPhase({ kind: "busy", file: file.name });
    const body = new FormData();
    body.append("file", file);
    try {
      const res = await fetch(leadsImportHref(company), { method: "POST", body });
      const data = (await res.json().catch(() => null)) as
        | ImportResultBody
        | ImportFileErrorBody
        | { error?: string }
        | null;
      if (res.ok && data && "imported" in data) {
        setPhase({ kind: "done", result: data });
        if (data.imported > 0) router.refresh();
        return;
      }
      if (data && "code" in data) {
        setPhase({ kind: "refused", lines: fileErrorMsgs(data, company) });
        return;
      }
      const message = (data as { error?: string } | null)?.error;
      setPhase({
        kind: "refused",
        lines: [message ? { en: message, ar: message } : common.somethingWentWrong],
      });
    } catch {
      setPhase({ kind: "refused", lines: [m.errorFailed] });
    }
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        id={buttonId}
        type="button"
        className={`btn-ghost ${TOUCH}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        data-import-company={company}
        onClick={() => (open ? closeMenu(false) : openMenu("first"))}
        onKeyDown={onButtonKey}
      >
        {label}
      </button>

      {open ? (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-labelledby={buttonId}
          aria-describedby={hintId}
          onKeyDown={onMenuKey}
          style={shift ? { transform: `translateX(${shift}px)` } : undefined}
          /* the frame's dense glass (glass.css .glass-menu): the surface, rim,
             frost and float shadow; the spring drop is motion.css */
          className={
            "glass-menu absolute start-0 top-full z-50 mt-2 flex w-max min-w-full " +
            "max-w-[min(20rem,calc(100vw-2rem))] flex-col overflow-hidden py-1"
          }
        >
          <a
            role="menuitem"
            tabIndex={-1}
            href={leadsImportTemplateHref(company)}
            download
            className={ITEM}
            onClick={() => closeMenu(true)}
          >
            {t(m.downloadTemplate)}
          </a>
          <button
            role="menuitem"
            tabIndex={-1}
            type="button"
            className={ITEM}
            onClick={() => chooseFile("menu")}
          >
            {t(m.importLeads)}
          </button>
          {/* not an item: presentation only, and read to a screen reader as
              the menu's DESCRIPTION (aria-describedby above) */}
          <p id={hintId} role="presentation" className="u-muted px-4 pb-2 pt-1">
            {t(
              formatMsg(m.menuHint, { rows: String(MAX_IMPORT_ROWS), mb: String(MAX_IMPORT_MB) }),
            )}
          </p>
        </div>
      ) : null}

      <input
        ref={fileRef}
        type="file"
        accept={`.xlsx,${XLSX_MIME}`}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        data-import-input={company}
        onChange={(e) => {
          const file = e.currentTarget.files?.[0];
          if (file) void upload(file);
        }}
      />

      {phase.kind !== "idle" ? (
        <div className="modal-overlay">
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            className="modal w-full max-w-2xl"
            data-import-result={phase.kind}
          >
            <div className="modal-head">
              <div>
                <p className="modal-eyebrow">{label}</p>
                <p id={titleId} className="modal-title">
                  {phase.kind === "busy"
                    ? t(formatMsg(m.importing, { file: phase.file }))
                    : phase.kind === "done"
                      ? t(m.resultTitle)
                      : t(m.failedTitle)}
                </p>
              </div>
            </div>

            <div className="modal-body space-y-4" aria-live="polite">
              {phase.kind === "busy" ? <p className="u-muted">{t(m.importingHint)}</p> : null}

              {phase.kind === "refused" ? (
                <div className="alert-error" role="alert">
                  <div className="space-y-1">
                    {phase.lines.map((line, i) => (
                      <p key={i}>{t(line)}</p>
                    ))}
                  </div>
                </div>
              ) : null}

              {phase.kind === "done" ? (
                <ImportResult
                  result={phase.result}
                  company={company}
                  skippedUrl={skippedUrl}
                />
              ) : null}
            </div>

            <div className="modal-foot">
              <div className="flex flex-wrap gap-2">
                {phase.kind !== "busy" ? (
                  <>
                    <button
                      type="button"
                      className={`btn-primary ${TOUCH}`}
                      onClick={() => chooseFile("dialog")}
                    >
                      {t(m.importAnother)}
                    </button>
                    <button type="button" className={`btn-ghost ${TOUCH}`} onClick={closeDialog}>
                      {t(board.close)}
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ImportResult({
  result,
  company,
  skippedUrl,
}: {
  result: ImportResultBody;
  company: CrmCompany;
  skippedUrl: string | null;
}) {
  const locale = useLocale();
  const t = tFor(locale);
  return (
    <>
      <div className="tile-grid">
        <div className="tile" data-import-count="imported" aria-hidden>
          <span className="tile-label">{t(m.importedLabel)}</span>
          <span className="tile-value">{result.imported}</span>
        </div>
        <div className="tile" data-import-count="skipped" aria-hidden>
          <span className="tile-label">{t(m.skippedLabel)}</span>
          <span className="tile-value">{result.skipped.length}</span>
        </div>
      </div>
      {/* the counts again as one sentence, so a screen reader hears them whole */}
      <p className="sr-only">
        {t(formatMsg(m.importedCount, { n: String(result.imported) }))}.{" "}
        {t(formatMsg(m.skippedCount, { n: String(result.skipped.length) }))}.
      </p>

      {/* WHERE the new leads are, said in words. No "Show the unassigned
          leads" link (one way to each page): Leads is in the CRM menu, and the
          sentence names the bucket to open there. */}
      {result.imported > 0 ? (
        <div className="space-y-2">
          <p className="u-sub">
            {t(company === "bsystems" ? m.unassignedBsystems : m.unassignedByteforce)}
          </p>
        </div>
      ) : null}

      {result.restored.length > 0 ? (
        <section className="space-y-1" aria-label={t(m.restoredTitle)}>
          <p className="u-h3">{t(m.restoredTitle)}</p>
          <p className="u-muted">{t(m.restoredNote)}</p>
          <ul className="u-muted list-disc ps-5">
            {result.restored.map((r) => (
              <li key={r.row}>
                {t(
                  formatMsg(m.restoredRow, {
                    row: String(r.row),
                    from: `⁦${r.from}⁩`,
                    to: `⁦${r.to}⁩`,
                  }),
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-2" aria-label={t(m.skippedTitle)}>
        <p className="u-h3">{t(m.skippedTitle)}</p>
        {result.skipped.length === 0 ? (
          <p className="u-muted">{t(m.noneSkipped)}</p>
        ) : (
          <>
            {result.skippedFile && skippedUrl ? (
              <p className="u-muted">
                <a
                  href={skippedUrl}
                  download={result.skippedFile.filename}
                  className={`btn-ghost inline-flex items-center ${TOUCH}`}
                >
                  {t(m.downloadSkipped)}
                </a>{" "}
                {t(m.skippedFileHint)}
              </p>
            ) : null}
            <div className="card card--flush0">
              <div className="table-scroll">
                <table className="table table--wrap" data-import-skipped>
                  <thead>
                    <tr>
                      <th scope="col">{t(m.thRow)}</th>
                      <th scope="col">{t(common.name)}</th>
                      <th scope="col">{t(common.number)}</th>
                      <th scope="col">{t(m.thReason)}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.skipped.map((s) => (
                      <tr key={s.row} data-row={s.row}>
                        <td className="td-mono td-nowrap">{s.row}</td>
                        <td>{s.values.name}</td>
                        <td className="td-nowrap">
                          <span className="u-ltr">{s.values.number}</span>
                        </td>
                        <td data-reason-codes={s.reasons.map((r) => r.code).join(" ")}>
                          {t(skipReasonsMsg(s.reasons, company))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </section>
    </>
  );
}
