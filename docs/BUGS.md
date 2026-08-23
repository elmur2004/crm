# Bug register — append-only

Format: `project-logging` skill (BUG-### | severity | where | repro | status). File bugs
the moment a failure is found; close them with a reference to the fixing commit/entry.

## BUG-001 — 2026-08-09 — vitest intermittently collects "no tests" via npm test
- Severity: minor (tooling flake, not product)
- Where: `npm test` / `npx vitest run` on Windows; roughly 1 run in 10 reports
  "Tests: no tests" with 0ms import and exits 1; the immediate rerun passes with
  the full suite. Correlates with vitest's `configLoader: 'native'` CJS/ESM warning
  on vitest.config.ts.
- Repro: run the suite repeatedly; non-deterministic.
- Status: open (workaround: rerun; every gate verdict in TESTING.md is from a run
  that actually collected the suite)

## BUG-002 — 2026-08-09 — dnd-kit hydration mismatch on portal boards
- Severity: minor (console error; no functional impact)
- Where: DealBoard — dnd-kit's auto-incremented `aria-describedby` id differed
  between SSR and client, logging a React hydration-mismatch console error on
  every board render (found by the Phase 5 QA sweep).
- Repro: open /portal/crm with the console open.
- Status: fixed (stable `id="deal-board"` on DndContext; QA sweep asserts clean
  consoles — TESTING Run 013)

## BUG-003 — 2026-08-09 — header nav overflows horizontally at 390px
- Severity: minor
- Where: AppNav (6 items under B-Systems: 156px overflow) and PortalNav (5px) at
  390px width — horizontal page scroll (found by the Phase 5 QA sweep).
- Repro: open /b-systems at 390px viewport.
- Status: fixed (flex-wrap on header + nav; sweep asserts ≤1px overflow at
  1440/1024/768/390 on every screen — TESTING Run 013)

## BUG-004 — 2026-08-11 — uploaded files lost on redeploy (proof link → "File missing from storage")
- Severity: critical (production data loss — every redeploy wiped ALL
  uploaded files: payment proofs, CVs, recordings, proposal/contract PDFs)
- Where: production hosting — uploads stored in `<cwd>/uploads` inside the
  app container. Found by the founder: a statement's proof link returned
  {"error":"File missing from storage"}.
- Repro: upload any file in production → redeploy → open the file's link →
  "File missing from storage".
- Root cause: the hosting platform rebuilds the app container on every
  deploy, wiping the container-local `<cwd>/uploads` directory, while the
  EXTERNAL Postgres keeps the attachment rows — DB and blob lifecycles
  diverged, so the UI kept linking files that no longer existed.
- Status: fixed (code — Entry 018, TESTING Run 021, ADR-035:
  UPLOADS_DIR-selected storage root; per-proof fileOk probes with
  missing-file UI states on Statements/Payments/printable document/
  prospect recordings; admin re-upload/replace path for paid statements;
  styled missing-file page for browser hits; /api/health uploads
  diagnostics). Durability itself is MITIGATION PENDING FOUNDER HOST
  ACTION: attach a persistent volume and set UPLOADS_DIR to its mount
  path (ADR-035). Already-lost blobs are unrecoverable unless an ADR-032
  backup export holds them — re-upload via Statements → Re-upload proof.

## BUG-005 — 2026-08-12 — Log out emits an http:// redirect behind a proto-misreporting proxy
- Severity: major (scheme downgrade on one action; found by the
  2026-08-12 SSL audit round, not by a user report)
- Where: src/lib/auth/actions.ts logout() — signOut({redirectTo:
  "/login"}): next-auth 5 beta absolutizes redirectTo against the
  proxy-reported x-forwarded-proto, so behind a misreporting proxy
  (e.g. Cloudflare "Flexible" SSL) clicking Log out responded with
  Location: http://<domain>/login. The only code-reachable downgrade
  path found by the audit — everything else the browser loads is
  same-origin relative.
- Repro: deploy behind a proxy reporting x-forwarded-proto: http, sign
  in, click Log out, inspect the redirect response's Location header.
- Status: fixed (signOut({redirect: false}) + a relative redirect() —
  commit ce5ff36, Entry 021, TESTING Run 024)

## BUG-006 — 2026-08-14 — Arabic text cannot be stored or searched: local Postgres clusters are WIN1252
- Severity: major (the platform is bilingual; found while verifying the new
  Leads search in Arabic, not by a user report)
- Where: scripts/local-postgres.ts — `embedded-postgres` initdb ran with no
  flags, so on Windows the cluster inherited English_United States.1252 and
  every database (template0/1, postgres, crm) was created WIN1252. Any
  non-Latin-1 character raised SQLSTATE 22P05 `character with byte sequence
  0xd8 0xaf in encoding "UTF8" has no equivalent in encoding "WIN1252"` —
  on INSERT (an Arabic lead name) and on SELECT (an Arabic search query),
  surfacing as a 500 "This page couldn't load" on /b-systems/leads?q=<arabic>.
- Repro: `SELECT pg_encoding_to_char(encoding) FROM pg_database` on a cluster
  created before the fix → WIN1252; then insert any Arabic string.
- Status: fixed (ADR-044 — initdb `-E UTF8 --locale=C` on every local
  cluster, plus a start-up warning naming any pre-existing non-UTF8 data dir;
  Entry 033, TESTING Run 036 — unit: an Arabic lead name is found by
  listBsLeads search; e2e: an Arabic lead is created through the API and
  found through the Leads search box). The founder's existing .pgdata/dev
  cluster must be deleted and recreated (or migrated via an ADR-032 backup
  export/import) to accept Arabic locally; managed Postgres is UTF8 by
  default and was never affected.

## BUG-007 — 2026-08-19 — board cards kill every scroll on a phone
- Severity: major (the whole CRM is unusable on the founder's phone: "I cannot
  reach the leads under the column because I cannot scroll")
- Where: `src/components/{bsystems/BsBoard,internal/InternalBoard,partners/PartnersBoard}.tsx`
  — each card div spread dnd-kit's `{...listeners}` AND carried Tailwind's
  `touch-none` (`touch-action: none`), which forbids any pan from starting on
  the element. Cards cover essentially the whole board, so `.col-cards`
  `overflow-y`, `.board` `overflow-x` and page-scroll chaining all died at once
  and every gesture became a card drag.
- Repro: on a touch device open /byteforce/crm (or either B-Systems board) with
  more than five leads in one stage and swipe with a finger starting on a card —
  nothing scrolls; the card is dragged instead.
- Status: fixed (ADR-056 part A — a dedicated `.bcard-grip` button owns
  `touch-action: none`, the card takes `manipulation`, and the card shell's
  dnd-kit listeners are gated to `pointerType === "mouse"`; commit "board cards
  get a drag handle so touch can scroll the columns", Entry 050, TESTING Run
  053. Pinned by e2e/board-touch.spec.ts, which was seen RED first: with
  `touch-action: none` back on the card the column's scrollTop measured 0.)

## BUG-008 — 2026-08-19 — the board overflows the page and jumps sideways at browser zoom
- Severity: major (founder: "when I zoom in and out the UI gets so scattered")
- Where: `src/themes/design-system.css` `.board` —
  `margin-inline: calc(50% - 50vw + 8px)` with a matching `-8px` on the padding.
  `100vw` includes the classic scrollbar; the usable width does not; and in CSS
  px that scrollbar is `15 / zoom`, so the `+8px` cancelled it at exactly 100%
  zoom and nowhere else. Measured page overflow `SB/2 − 8` = +22px at 25% zoom,
  +7 at 50%, +2 at 80%, +1 at 90%; board start edge `8 − SB/2` = −22px at 25%,
  −7 at 50%. Independently, the scrollbar exists only while the page scrolls, so
  the whole board slid 15.0px sideways at 50% zoom (7.5 at 100%, 5.0 at 150%)
  whenever content crossed the fold.
- Repro: real Chrome (NOT headless — see below), a board page long enough to
  scroll, browser zoom 50%: the page gains a horizontal scrollbar and the
  board's left edge is 7px off-screen. Then filter the board short enough that
  the page stops scrolling: the board jumps 15px sideways.
- Note on why the suite never saw it: headless Chromium launches with
  `--hide-scrollbars`, so `100vw === clientWidth` and the existing overflow
  assertions in qa-sweep.spec.ts and nav-slider.spec.ts passed for the wrong
  reason. e2e/zoom.spec.ts opts out of that flag, scoped to itself.
- Status: fixed (ADR-056 part B — `.shell-body` query container + `cqw`
  arithmetic, ±8px deleted; measured 0 overflow / 0 left / 0 jump at 25% → 300%;
  commit "the layout survives browser zoom", Entry 050, TESTING Run 053)

## BUG-009 — 2026-08-19 — the "about five cards" column cap collapses to one card at high zoom
- Severity: major (the founder's stated requirement was never actually met, and
  degrades to unusable for anyone who zooms)
- Where: `src/themes/design-system.css` `.col-cards { max-height: min(62vh, 510px) }`
  — the cap in viewport units against a fixed-px card. Measured against the card
  that shipped: 2.54 whole cards at 100% zoom, 2.03 at 125%, 1.26 at 200%, 0.83
  at 300% — at 300% a column cannot display ONE whole card.
- Repro: put more than five leads in one stage, set browser zoom to 200%: the
  column shows one card and a sliver.
- Status: fixed (ADR-056 part C — `clamp(2 TALL cards + gap + padding, 62vh,
  5 REFERENCE cards + 4 gaps + padding)`, derived from `--bcard-h-max` /
  `--bcard-h` / `--bcard-gap` / `--col-cards-pad-b`; floor **429px**, ceiling
  928px. e2e/zoom.spec.ts A6 asserts ≥2 whole cards AND that the cap still caps,
  deriving the card height from a live rect — and now seeds names that WRAP to
  the 2-line clamp, because the first cut of the fix used ONE 176px constant for
  both ends while the real B-Systems card measures 186.3px unwrapped and 202.4px
  at its worst, so the floor delivered 1.94 cards and the short seeded names hid
  it. The cap SIZE at ordinary zoom is flagged for founder confirmation in
  PROGRESS Entry 050.)

## BUG-010 — 2026-08-19 — the header pushes the page sideways between ~400px and ~555px
- Severity: minor (a band no test sampled; reachable by 300% zoom on a 1440
  monitor, or a narrow window)
- Where: `src/themes/design-system.css` — `.app-header .user > .switcher` only
  hid at `max-width: 400px`, but the module switcher is a rigid ~307px strip
  inside `.user { flex: none }`. At a 480px viewport the `.user` cluster
  measured 429.7px wide with its right edge at 522.8px against a 475px page:
  +48px of horizontal page overflow on the B-Systems shells, +64px on ByteForce
  (which also carries the notifications bell).
- Repro: any signed-in shell at a viewport width between roughly 400px and
  555px — `document.scrollingElement.scrollWidth - clientWidth` is positive.
  qa-sweep samples 1440 / 1024 / 768 / 560 / 390 and steps over the band.
- Status: fixed (the switcher now leaves the header at ≤600px, riding down with
  Log out — both already live in the burger sheet at every width below 820px;
  ADR-056 consequences, Entry 050. e2e/zoom.spec.ts A1 covers 480px as the 300%
  zoom model.)

## BUG-011 — 2026-08-19 — the nav slider's chevron disappears at fractional browser zoom
- Severity: minor (the founder's original "Registrations → Regi" screenshot,
  returning quietly at in-between zoom steps)
- Where: `src/components/shared/ShellNav.tsx` `measure()` — the overflow test
  was `el.scrollWidth - el.clientWidth`, both integer-rounded DOM metrics, with
  a `> 1` guard. At a fractional zoom a label clipped by up to 1 CSS px measured
  as 0 or 1, so no chevron and no fade appeared and the section was silently
  truncated.
- Repro: sign in as B-Systems admin at a width just above the point where the
  eleven sections stop fitting, then step the browser zoom by 5%: at some steps
  a section is visibly cut with no arrow to reach it.
- Status: fixed (measured off the items' fractional `getBoundingClientRect()`
  against the strip's box, with a 0.5px threshold and logical start/end derived
  from `direction` instead of the sign of `scrollLeft`; ADR-056 consequences,
  Entry 050. Pinned by the A9 test appended to e2e/nav-slider.spec.ts, which
  walks 85% → 125% layout zoom and a fractional CSS-zoom pass.)

## BUG-012 — 2026-08-21 — the accounting e2e sampled a settled ✓'s green MID-FADE
- Severity: minor (test-only; the product paints correctly)
- Where: `e2e/accounting.spec.ts` — the cross-brand paint comparison. The
  ByteForce sample was taken after three intervening assertions and had settled
  to `rgb(230, 244, 236)`; the B-Systems sample was taken the instant
  `toHaveClass(SETTLED)` resolved, and `.row-toggle` carries
  `transition: background-color .15s ease` (design-system.css), so it caught the
  fade and serialised as `rgba(230, 244, 236, 0.97)` — a DIFFERENT alpha every
  run (0.925 and 0.97 observed), making `expect(bsBg).toBe(settledBg)` fail.
- Repro: `npx playwright test e2e/accounting.spec.ts -g "the row"` on a clean
  tree at 43b6098 (verified by stashing the ADR-058 work and re-running: the
  spec was already red before it).
- Status: fixed (a `settledPaint()` helper polls
  `getComputedStyle().backgroundColor` until it matches `/^rgb\(/`, i.e. until
  the transition has stopped moving. The assertion the sampling exists for is
  preserved: an undeclared token leaves `rgba(0, 0, 0, 0)`, which is not an
  `rgb()`, so the missing-token case still fails — as a timeout rather than a
  mismatch. ADR-058, Entry 052.)

## BUG-013 — 2026-08-23 — undoing a DELAYED meeting reschedule leaves `outcome: "delayed"` on the meeting
- Severity: minor (pre-existing, found while adjudicating the ADR-062 review —
  not introduced by it; no data loss, and the meeting's date is restored
  correctly)
- Where: `src/lib/services/leads.ts` `applyLeadEvent` + `src/lib/services/undo.ts`
  `restoreUpdated`. A T-7 (`meeting_outcome: delayed`) event pushes **two**
  `UpdatedRef`s for the SAME meeting row: the `meeting_outcome` pre-write
  captures the state before it (`outcome: null`), then `persistGroup`'s
  `meeting_reschedule` handler captures the state it finds (`outcome:
  "delayed"`, the value the pre-write just set) before nulling it. `restoreUpdated`
  replays the refs in FORWARD order, so the second one wins and the undone
  meeting ends up with `outcome: "delayed"` and its original datetime — a state
  the forward path can never produce (T-7 always nulls the outcome in the same
  transaction).
- Repro (verified on the embedded test Postgres): move a lead to Meeting
  Setting with a meeting; apply `{ type: "meeting_outcome", outcome: "delayed" }`
  with a `meeting_reschedule` group; then `performUndo`. Observed:
  `afterReschedule = { outcome: null, datetime: 2026-09-09T13:30Z }`,
  `afterUndo = { outcome: "delayed", datetime: 2026-09-02T11:00Z }` — expected
  `outcome: null`.
- Consequence for ADR-062: this is the one state in which the To-Do's
  `doneMeetingDelayed` label renders (a meeting dated today carrying
  `outcome: "delayed"` is not live, so the Done section labels it "Meeting
  delayed"). The branch is therefore kept, not dead code — see the note in
  `TodoBody.tsx`. On the normal path a delayed meeting is a MOVED task, not a
  completed one (SPEC §5.8).
- Status: **open** — out of scope for the ADR-062 commits (it lives in the undo
  snapshot's ref ordering, not in the To-Do). Fix shape: de-duplicate
  `UpdatedRef`s per (model, id) keeping the FIRST capture, or replay
  `restoreUpdated` in reverse.
