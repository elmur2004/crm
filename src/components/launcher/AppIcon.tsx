import type { IconPalette } from "@/lib/launcher/apps";

/* ============================================================================
   The launcher's app icons — NEW artwork, drawn here as inline SVG.

   Not the logos (the ByteForce logo is never recoloured and the B-Systems mark
   never sits on a plate it was not drawn for — both rules stay untouched
   because neither logo is used), not an icon font, not emoji, not a raster,
   not a third-party pack, and not Odoo's drawings: the founder pointed at the
   PATTERN (rounded-square tiles, a bold flat glyph each, the name beneath) and
   these are this product's own glyphs in this product's palettes.

   NO COLOUR LIVES IN THIS FILE. Every shape carries a role class — lx-a (the
   glyph), lx-c (the one cue), lx-cut (a cut-out in the plate's own colour),
   lx-well (a soft well of the glyph colour) — and src/themes/launcher.css maps
   each role to a token per palette. The two CRM tiles re-stamp their brand's
   scope (data-brand) on the plate so those roles resolve to the brand files'
   own variables; the cross-company apps stay in the neutral scope and use the
   launcher's neutral-led palette.

   TWO KINDS OF PLATE. The two CRM icons are brand artwork — a solid brand
   plate under a light glyph — and, like the logos, do not re-skin with the
   theme: their contrast lives inside the icon. The five shared apps sit on the
   neutral card with an ink glyph, all tokens, so they turn with the page in
   dark mode. Every plate's EDGE follows the theme (launcher.css carries the
   measured table). The glyph is aria-hidden — the tile's accessible name is
   its visible label.

   DIRECTION. The board, the to-do list and the receipt read from the inline
   start (a pipeline's progress, a list's bullets, a line of text), so they
   mirror under dir="rtl" (`lx-glyph--flip`). The safe, the chart and the two
   people are objects with no reading direction and stay as drawn.
   ========================================================================== */

export type Glyph = "crm" | "accounting" | "vault" | "todo" | "reports" | "partners" | "pie";

const FLIPS: ReadonlySet<Glyph> = new Set<Glyph>(["crm", "todo", "accounting"]);

/** The brand scope a palette re-stamps on its plate (ADR-054's idiom: the
    nearest [data-brand] ancestor wins, so the brand files' own variables
    resolve inside this one element and nowhere else). */
const SCOPE: Record<IconPalette, string | undefined> = {
  byteforce: "byteforce",
  bsystems: "bsystems",
  neutral: undefined,
};

function Shapes({ glyph }: { glyph: Glyph }) {
  switch (glyph) {
    case "crm":
      /* a pipeline board: three columns, the deals thinning as they move on,
         and the one that made it to the last column in the cue colour */
      return (
        <>
          <rect className="lx-well" x="4" y="5" width="12" height="38" rx="3.5" />
          <rect className="lx-well" x="18" y="5" width="12" height="38" rx="3.5" />
          <rect className="lx-well" x="32" y="5" width="12" height="38" rx="3.5" />
          <rect className="lx-a" x="5.5" y="7.5" width="9" height="8" rx="2" />
          <rect className="lx-a" x="5.5" y="18" width="9" height="8" rx="2" />
          <rect className="lx-a" x="5.5" y="28.5" width="9" height="8" rx="2" />
          <rect className="lx-a" x="19.5" y="7.5" width="9" height="8" rx="2" />
          <rect className="lx-a" x="19.5" y="18" width="9" height="8" rx="2" />
          <rect className="lx-c" x="33.5" y="7.5" width="9" height="8" rx="2" />
        </>
      );
    case "accounting":
      /* a receipt with a torn foot, and a coin laid over its corner */
      return (
        <>
          <path
            className="lx-a"
            d="M10 5h21a3 3 0 0 1 3 3v33l-3.4-2.4-3.4 2.4-3.4-2.4-3.4 2.4-3.4-2.4-3.4 2.4L7 38.6V8a3 3 0 0 1 3-3z"
          />
          <rect className="lx-cut" x="12" y="12" width="15" height="3.4" rx="1.7" />
          <rect className="lx-cut" x="12" y="19" width="10" height="3.4" rx="1.7" />
          <rect className="lx-cut" x="12" y="26" width="12.5" height="3.4" rx="1.7" />
          <circle className="lx-cut" cx="34" cy="33" r="11" />
          <circle className="lx-c" cx="34" cy="33" r="8.6" />
          <circle className="lx-cut-line" cx="34" cy="33" r="4.6" />
        </>
      );
    case "vault":
      /* a safe: body, hinges, a dial with its mark, two feet */
      return (
        <>
          <rect className="lx-a" x="6" y="6" width="36" height="31" rx="5" />
          <rect className="lx-a" x="10" y="36" width="7" height="6" rx="1.5" />
          <rect className="lx-a" x="31" y="36" width="7" height="6" rx="1.5" />
          <rect className="lx-cut" x="10" y="11.5" width="3" height="7" rx="1.5" />
          <rect className="lx-cut" x="10" y="24.5" width="3" height="7" rx="1.5" />
          <circle className="lx-cut" cx="26" cy="21.5" r="10.4" />
          <circle className="lx-c" cx="26" cy="21.5" r="8" />
          <circle className="lx-cut" cx="26" cy="21.5" r="2.8" />
          <rect className="lx-cut" x="24.9" y="12.6" width="2.2" height="4.6" rx="1.1" />
        </>
      );
    case "todo":
      /* a list of three: the first one done (the cue), two still open */
      return (
        <>
          <circle className="lx-c" cx="11.5" cy="12.5" r="6" />
          <g className="lx-noflip">
            <path className="lx-cut-line" d="M8.6 12.7l2 2 3.8-4.1" />
          </g>
          <rect className="lx-a" x="21" y="10" width="21" height="5" rx="2.5" />
          <circle className="lx-a-line" cx="11.5" cy="24" r="4.4" />
          <rect className="lx-a" x="21" y="21.5" width="16" height="5" rx="2.5" />
          <circle className="lx-a-line" cx="11.5" cy="35.5" r="4.4" />
          <rect className="lx-a" x="21" y="33" width="18.5" height="5" rx="2.5" />
        </>
      );
    case "reports":
      /* a bar chart on its baseline, the tallest bar in the cue colour */
      return (
        <>
          <rect className="lx-a" x="7" y="25" width="8" height="14" rx="2" />
          <rect className="lx-a" x="17.5" y="17" width="8" height="22" rx="2" />
          <rect className="lx-c" x="28" y="8" width="8" height="31" rx="2" />
          <rect className="lx-well" x="38.5" y="20" width="4" height="19" rx="2" />
          <rect className="lx-a" x="5" y="40.5" width="38" height="3" rx="1.5" />
        </>
      );
    case "pie":
      /* a share of the whole — department profitability */
      return (
        <>
          <path className="lx-a" d="M22 10A16 16 0 1 0 38 26H22z" />
          <path className="lx-c" d="M25.5 6.5A16 16 0 0 1 41.5 22.5H25.5z" />
        </>
      );
    case "partners":
      /* two people: the partner behind, the agent in front (one pipeline,
         two kinds of card — ADR-059) */
      return (
        <>
          <circle className="lx-c" cx="31" cy="14" r="6.5" />
          <path className="lx-c" d="M19 38a12 12 0 0 1 24 0v1.5a1.5 1.5 0 0 1-1.5 1.5h-21A1.5 1.5 0 0 1 19 39.5z" />
          <circle className="lx-a lx-sep" cx="18" cy="19" r="7.5" />
          <path
            className="lx-a lx-sep"
            d="M4 41.5a14 14 0 0 1 28 0v.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"
          />
        </>
      );
  }
}

/** One app icon: the rounded-square plate and its glyph. `tone` names the
    neutral palette's cue (one per app); the brand palettes carry their own. */
export function AppIcon({
  glyph,
  palette,
  tone,
  size = "tile",
}: {
  glyph: Glyph;
  palette: IconPalette;
  tone?: Glyph;
  size?: "tile" | "small";
}) {
  const classes = [
    "lx-icon",
    `lx-icon--${palette}`,
    `lx-tone--${tone ?? glyph}`,
    size === "small" ? "lx-icon--small" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <span className={classes} data-brand={SCOPE[palette]} aria-hidden="true">
      <svg
        viewBox="0 0 48 48"
        className={FLIPS.has(glyph) ? "lx-glyph lx-glyph--flip" : "lx-glyph"}
        focusable="false"
      >
        <Shapes glyph={glyph} />
      </svg>
    </span>
  );
}
