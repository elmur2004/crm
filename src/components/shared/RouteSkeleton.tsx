import { LoadingLabel } from "./LoadingLabel";

/* ============================================================================
   ROUTE LOADING SKELETONS — what RoutePending shows the instant a link to
   another screen is followed, so navigation feels immediate (the founder's
   motion pass: "every screen gets the sign-in's motion"). Not a loading.tsx:
   see RoutePending for why the server must keep rendering the whole page.

   · Structurally close to the real page, so nothing jumps when it lands: the
     page head (eyebrow, title, actions), then the screen's own shape — the
     Home's KPI row and panels, the board's columns, a list's filter column and
     table, a lead's identity card and panels.
   · sk-* classes ONLY (glass.css), never a real component class: no test,
     script or style that looks for `.board`, `.page-head`, `.table`,
     `[data-metric]` or an <h1> can ever mistake a skeleton for the page.
   · The shapes are aria-hidden; ONE sentence is spoken (role=status). The
     shimmer is motion.css's, inside the reduced-motion fence; RoutePending
     waits 120 ms before showing it, so a fast navigation never flashes it.
   · No data and no hooks: it renders before anything is fetched.
   ========================================================================== */

export type SkeletonKind =
  | "home"
  | "board"
  | "list"
  | "table"
  | "todo"
  | "lead"
  | "call"
  | "page"
  | "accounting"
  | "vault";

const n = (count: number) => Array.from({ length: count }, (_, i) => i);

function Head({ actions = 1 }: { actions?: number }) {
  return (
    <div className="sk-head">
      <div className="sk-head-text">
        <span className="sk sk-eyebrow" />
        <span className="sk sk-title" />
      </div>
      {actions > 0 ? (
        <div className="sk-actions">
          {n(actions).map((i) => (
            <span key={i} className="sk sk-pill" />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Card({ lines = 3, figure = false }: { lines?: number; figure?: boolean }) {
  return (
    <div className="sk-card">
      <span className="sk sk-line sk-line--short" />
      {figure ? <span className="sk sk-figure" /> : null}
      {n(lines - 1).map((i) => (
        <span key={i} className={`sk sk-line${i % 2 ? " sk-line--mid" : ""}`} />
      ))}
    </div>
  );
}

function Rows({ count = 7 }: { count?: number }) {
  return (
    <div className="sk-card sk-card--flush">
      <div className="sk-rows">
        {n(count).map((i) => (
          <div key={i} className="sk-row">
            <span className="sk sk-line" />
            <span className="sk sk-line sk-line--mid" />
            <span className="sk sk-line sk-line--short" />
          </div>
        ))}
      </div>
    </div>
  );
}

function Body({ kind }: { kind: SkeletonKind }) {
  switch (kind) {
    case "home":
      return (
        <>
          <Head actions={1} />
          <div className="sk-grid">
            {n(4).map((i) => (
              <Card key={i} lines={2} figure />
            ))}
          </div>
          <div className="sk-grid sk-grid--panels">
            {n(4).map((i) => (
              <div key={i} className="sk-card sk-panel">
                <span className="sk sk-line sk-line--short" />
                <span className="sk sk-line" />
                <span className="sk sk-line sk-line--mid" />
                <span className="sk sk-line" />
              </div>
            ))}
          </div>
        </>
      );
    case "board":
      return (
        <>
          <Head actions={2} />
          <span className="sk sk-bar" />
          <div className="sk-cols">
            {n(6).map((c) => (
              <div key={c} className="sk-col">
                <span className="sk sk-col-title" />
                {n(c % 3 === 0 ? 3 : 2).map((i) => (
                  <Card key={i} lines={3} />
                ))}
              </div>
            ))}
          </div>
        </>
      );
    case "list":
      return (
        <>
          <Head actions={2} />
          <div className="sk-split sk-split--side">
            <Card lines={6} />
            <Rows count={8} />
          </div>
        </>
      );
    case "table":
      return (
        <>
          <Head actions={1} />
          <Rows count={8} />
        </>
      );
    case "todo":
      return (
        <>
          <Head actions={0} />
          <Rows count={5} />
          <Rows count={3} />
        </>
      );
    case "lead":
      return (
        <>
          <span className="sk sk-line sk-back" />
          <div className="sk-card">
            <span className="sk sk-title" />
            <span className="sk sk-line sk-line--mid" />
            <span className="sk sk-line sk-line--short" />
          </div>
          <div className="sk-split sk-split--detail">
            <div className="sk-stack">
              <Card lines={5} />
              <Card lines={4} />
            </div>
            <Card lines={6} />
          </div>
        </>
      );
    case "call":
      return (
        <div className="sk-stack sk-narrow">
          <div className="sk-card">
            <span className="sk sk-title" />
            <span className="sk sk-line sk-line--mid" />
            <span className="sk sk-bar sk-bar--cta" />
          </div>
          <Card lines={4} />
          <Card lines={4} />
        </div>
      );
    case "accounting":
      return (
        <>
          <Head actions={2} />
          <span className="sk sk-hero" />
          <div className="sk-grid">
            {n(4).map((i) => (
              <Card key={i} lines={2} figure />
            ))}
          </div>
          <Rows count={5} />
        </>
      );
    case "vault":
      return (
        <>
          <Head actions={1} />
          <div className="sk-grid">
            {n(6).map((i) => (
              <Card key={i} lines={4} />
            ))}
          </div>
        </>
      );
    case "page":
    default:
      return (
        <>
          <Head actions={1} />
          <Card lines={5} />
          <Card lines={4} />
        </>
      );
  }
}

export function RouteSkeleton({ kind = "page" }: { kind?: SkeletonKind }) {
  return (
    <div className="sk-page" aria-busy="true" data-skeleton={kind}>
      <LoadingLabel />
      <div className="sk-body" aria-hidden="true">
        <Body kind={kind} />
      </div>
    </div>
  );
}
