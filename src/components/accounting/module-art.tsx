import type { ReactNode } from "react";

/* =============================================================================
   The MODULES' empty-state drawings (Accounting and the Data Vault — the vault
   imports them from here; see module-ui.tsx for why they live in this folder).

   Small inline SVGs, drawn in TOKENS ONLY: every shape carries one of the
   .ea-* classes in src/themes/modules.css (the card surface, the control
   border, the primary tint and its ink), so each picture re-colours with the
   company's brand and with the theme, and never carries a literal colour.
   aria-hidden: the sentence beside the drawing is the message. The pictures
   whose lines READ (a ledger page, a checklist, a timeline, lines under a
   magnifier) run the way the page reads — mirrored in Arabic (.ea-flow,
   modules.css); the rest are objects and stay as drawn.
   ========================================================================== */

export type ArtKind =
  | "coins"
  | "ledger"
  | "people"
  | "chart"
  | "target"
  | "folder"
  | "link"
  | "sheet"
  | "tasks"
  | "search"
  | "activity"
  | "archive";

const ground = <ellipse className="ea-ground" cx="60" cy="74" rx="42" ry="5" />;

const ART: Record<ArtKind, ReactNode> = {
  /* a stack of coins and one standing coin */
  coins: (
    <>
      {ground}
      <rect className="ea-paper" x="26" y="58" width="46" height="10" rx="5" />
      <rect className="ea-paper" x="30" y="47" width="46" height="10" rx="5" />
      <rect className="ea-paper" x="24" y="36" width="46" height="10" rx="5" />
      <circle className="ea-accent" cx="88" cy="50" r="15" />
      <circle className="ea-mark" cx="88" cy="50" r="8" />
    </>
  ),
  /* a ledger page with a total ticked off */
  ledger: (
    <>
      {ground}
      <rect className="ea-paper" x="32" y="10" width="56" height="60" rx="7" />
      <path className="ea-line" d="M42 24h36M42 34h28M42 44h32M42 54h20" />
      <circle className="ea-accent" cx="86" cy="60" r="11" />
      <path className="ea-mark" d="M81.5 60.5l3 3 6-6.5" />
    </>
  ),
  /* two people on the roster */
  people: (
    <>
      {ground}
      <circle className="ea-soft" cx="46" cy="30" r="10" />
      <path className="ea-soft" d="M26 66a20 18 0 0 1 40 0z" />
      <circle className="ea-accent" cx="76" cy="34" r="9" />
      <path className="ea-accent" d="M58 68a18 16 0 0 1 36 0z" />
    </>
  ),
  /* a card of bars, one of them the brand's */
  chart: (
    <>
      {ground}
      <rect className="ea-paper" x="26" y="12" width="68" height="58" rx="8" />
      <rect className="ea-soft" x="38" y="42" width="9" height="18" rx="2.5" />
      <rect className="ea-soft" x="52" y="32" width="9" height="28" rx="2.5" />
      <rect className="ea-accent" x="66" y="22" width="9" height="38" rx="2.5" />
      <path className="ea-line" d="M36 62h48" />
    </>
  ),
  /* a target and the arrow that has not landed yet */
  target: (
    <>
      {ground}
      <circle className="ea-paper" cx="56" cy="42" r="26" />
      <circle className="ea-soft" cx="56" cy="42" r="16" />
      <circle className="ea-accent" cx="56" cy="42" r="6" />
      <path className="ea-ink" d="M92 12L70 32M92 12v8M92 12h-8" />
    </>
  ),
  /* a folder with a document peeking out */
  folder: (
    <>
      {ground}
      <rect className="ea-accent" x="44" y="14" width="40" height="34" rx="5" />
      <path className="ea-line" d="M52 24h24M52 32h16" />
      <path className="ea-paper" d="M24 30a5 5 0 0 1 5-5h16l6 6h40a5 5 0 0 1 5 5v29a5 5 0 0 1-5 5H29a5 5 0 0 1-5-5z" />
    </>
  ),
  /* two chain links */
  link: (
    <>
      {ground}
      <rect className="ea-paper" x="20" y="34" width="44" height="22" rx="11" transform="rotate(-24 42 45)" />
      <rect className="ea-accent" x="56" y="22" width="44" height="22" rx="11" transform="rotate(-24 78 33)" />
      <path className="ea-ink" d="M50 44l22-10" />
    </>
  ),
  /* a sheet with a header row and its grid */
  sheet: (
    <>
      {ground}
      <rect className="ea-paper" x="24" y="12" width="72" height="58" rx="7" />
      <path className="ea-accent" d="M24 19a7 7 0 0 1 7-7h58a7 7 0 0 1 7 7v7H24z" />
      <path className="ea-line" d="M24 40h72M24 54h72M48 26v44M72 26v44" />
    </>
  ),
  /* a checklist with its first line done */
  tasks: (
    <>
      {ground}
      <rect className="ea-paper" x="28" y="10" width="64" height="60" rx="8" />
      <rect className="ea-accent" x="38" y="21" width="11" height="11" rx="3" />
      <path className="ea-mark" d="M40.5 26.5l2.4 2.4 4.2-4.6" />
      <path className="ea-line" d="M56 27h26M56 43h20M56 59h24" />
      <rect className="ea-soft" x="38" y="37" width="11" height="11" rx="3" />
      <rect className="ea-soft" x="38" y="53" width="11" height="11" rx="3" />
    </>
  ),
  /* a magnifier over the lines it found nothing in */
  search: (
    <>
      {ground}
      <path className="ea-line" d="M26 24h40M26 36h30M26 48h36M26 60h22" />
      <circle className="ea-accent" cx="76" cy="40" r="15" />
      <path className="ea-ink" d="M87 51l12 12" />
    </>
  ),
  /* a timeline waiting for its first entry */
  activity: (
    <>
      {ground}
      <path className="ea-line" d="M38 14v54" />
      <circle className="ea-accent" cx="38" cy="22" r="6" />
      <circle className="ea-soft" cx="38" cy="42" r="5" />
      <circle className="ea-soft" cx="38" cy="60" r="5" />
      <path className="ea-line" d="M52 22h36M52 42h28M52 60h32" />
    </>
  ),
  /* an archive box, its label in the brand */
  archive: (
    <>
      {ground}
      <rect className="ea-paper" x="28" y="32" width="64" height="38" rx="5" />
      <rect className="ea-soft" x="24" y="20" width="72" height="14" rx="4" />
      <rect className="ea-accent" x="48" y="42" width="24" height="10" rx="3" />
    </>
  ),
};

/** the drawings made of lines that read — they follow the page's direction */
const FLOWS: ReadonlySet<ArtKind> = new Set<ArtKind>(["ledger", "tasks", "search", "activity"]);

export function EmptyArt({ kind }: { kind: ArtKind }) {
  return (
    <svg className="mod-art" viewBox="0 0 120 84" aria-hidden="true" focusable="false">
      {FLOWS.has(kind) ? <g className="ea-flow">{ART[kind]}</g> : ART[kind]}
    </svg>
  );
}

/** The module's empty state: the drawing, then the sentence. The existing
    `.empty` class (dashed edge, centred muted text) is kept, so the words and
    their place are exactly what they were. */
export function ModEmpty({
  kind,
  children,
  className = "m-4",
}: {
  kind: ArtKind;
  children: ReactNode;
  /** the old <p className="empty m-4"> margin, by default */
  className?: string;
}) {
  return (
    <div className={`empty mod-empty${className ? ` ${className}` : ""}`}>
      <EmptyArt kind={kind} />
      <p className="m-0">{children}</p>
    </div>
  );
}
