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
## BUG-014 — 2026-08-29 — `prospect-stages-migration` compares two activity logs whose row ORDER is not pinned
- Where: `src/lib/services/prospect-stages-migration.integration.test.ts:466`
  (and one sibling assertion in the same file).
- Symptom: `expect(tsWorld).toEqual(sqlWorld)` fails with a diff in which every
  row is present on both sides and only their ORDER differs — e.g. the
  `agent won` and `partner following_up` entries swapped. Both sides carry the
  same trigger (`PP-3`) and the same from/to stages.
- Found: the BASELINE run taken before ADR-067's first line of code, on the
  UNCHANGED tree — **494 passed / 2 failed**. It is recorded here so nobody reads
  a later green run as a fix, and so nobody hunts this in the merge.
- Every run since (four full `npx vitest run` passes across ADR-067) has been
  green, which makes it an ordering flake rather than a break: the two activity
  rows are written inside one transaction and come back in whatever order
  Postgres returns them when no `orderBy` disambiguates a tie.
- Fix shape (not done — untouched by ADR-067, which changes no service and no
  query in that file): give the comparison a deterministic sort, or add a
  tie-breaking `orderBy` to the two reads, rather than relying on insertion order.
- Status: **open** — pre-existing, unrelated to the merge, low severity (a test
  ordering assumption, not product behaviour).

## BUG-015 — 2026-08-29 — the merge's anti-hole guard test carried BACKSPACE bytes where it meant `\b`, so it tested nothing
- Severity: major (a permission guard whose test could not fail; no product
  behaviour was wrong)
- Where: `src/lib/crm/page-company-guards.test.ts`, four backspace bytes across
  exactly **two** regexes, both inside the single check "a page that only
  resolves the company still narrows its ROLES" — its filter
  `/\brequireCompanyPage\b/` (line 88) and its assertion `/\bnarrowRoles\b/`
  (line 93). Each `\b` was a literal U+0008 BACKSPACE character rather than the
  two characters backslash-b, so each regex carried two of them.
  (Corrected in review, Run 080: an earlier draft of this entry named
  `/\brequireBsAdminPage\b/` and `/\brequirePageRole\b/` instead. Those two —
  in the neighbouring "does not reach for a guard that cannot see the company"
  check, current lines 73-74 — were CORRECT all along and never broke, and the
  draft never named `narrowRoles`, which is the half whose failure is the whole
  point of the bug. `git show 0b2fca8:src/lib/crm/page-company-guards.test.ts |
  cat -A | grep '\^H'` returns those two lines and no others, and they are
  precisely the two lines commit `55ffe2a` changed.)
- Symptom: none visible. The suite reported 51 passing tests. But the check
  "a page that only resolves the company still narrows its ROLES" opens with
  `if (!/\brequireCompanyPage\b/.test(src)) continue;` — with a backspace in the
  pattern that matched no file, so the loop `continue`d over every page and the
  assertion never ran.
- Why it matters: that assertion is what keeps ADR-051's add-only data-entry
  account out of the four screens both companies share. The first draft of
  ADR-067's section guard let that account into Won Leads, Statements and the
  board; this test was written to make sure that could not come back — and it
  had stopped being able to notice.
- Repro: `python -c "print(open(path,encoding='utf-8').read().count(chr(8)))"` →
  `4`. `grep -P '[\x00-\x08]'` did NOT find it, which is part of why it survived
  review. Reading the bytes is what found it.
- Root cause, worth knowing because it can recur: a tool layer between the agent
  and the shell collapses `\\` to `\` inside heredocs; Python then reads `\b` in
  a non-raw string as the backspace escape and writes 0x08 to the file. Any test
  regex authored that way is suspect. If a pattern "just never matches", check
  the bytes before checking the logic.
- Fix: the four bytes replaced with real `\b`, in its own commit ahead of the
  ADR-068 work, and mutation-checked — renaming `narrowRoles` in
  `b-systems/(app)/todo/page.tsx` now turns the revived assertion red. The whole
  repo was then swept for control characters; the only other hits are two
  DELIBERATE ones (the `"PK\x03\x04"` ZIP magic in `vault.integration.test.ts`,
  already documented in IMPLEMENTATION).
- Status: **fixed** (commit `55ffe2a`, Run 079).

## BUG-016 — 2026-08-29 — `setTodoDone` ignored its `brand` on the UNCHECK path, so half the To-Do endpoint had no company wall
- Severity: major (a documented server-side wall that did not exist for
  `done: false`; no escalation reachable today)
- Where: `src/lib/services/todo-done.ts`, the early return at the top of
  `setTodoDone` — `if (!opts.done)` deleted the mark with
  `db.todoDone.deleteMany({ where: key })` and returned. `key` is
  `keyFor(kind, recordId)`, a bare `{ followUpId }` / `{ meetingId }` /
  `{ statementId }` / `{ milestoneId }`, so the mark was deleted by RECORD ID
  ALONE and `opts.brand` was never read. Every `done: true` path below it does
  `if (!f?.lead || f.lead.brand !== opts.brand) throw new ApiError(404)`.
- Symptom: none visible in the product. Proved against real Postgres in the
  regression test: a mark created with `brand: "bsystems"` was deleted by a
  `brand: "byteforce"` uncheck of the same record id, and the mirror case
  deleted a B-Systems MILESTONE mark under `brand: "byteforce"`.
- Why it matters even though nothing escalated: both To-Do routes lean on this
  service in their own header comments — `/api/byteforce/todo/done` says
  "setTodoDone 404s a lead of the other brand — the brand comes from the ROUTE,
  never from input" — which was true for one half of the endpoint and false for
  the other. Today the routes' `requireLeadAccess` has already proved the caller
  may touch that lead (and the ByteForce route's enum carries no money kinds),
  so there is no reachable cross-company effect. The next caller placed in front
  of this service would have inherited an unguarded cross-brand delete.
- Repro (before the fix): check a B-Systems follow-up with
  `setTodoDone({ brand: "bsystems", kind: "follow_up", done: true })`, giving
  `todoDone.count()` = 1; then the same record id with `brand: "byteforce"` and
  `done: false` gave count 0, no error.
- Fix: the uncheck path now runs the SAME brand wall as the check path before it
  deletes — money kinds refuse any brand but `bsystems`, lead-backed kinds
  resolve `lead.brand` through the new `leadBrandOfTodoRecord` and 404 on a
  mismatch. A record that is simply GONE still deletes nothing and refuses
  nothing (marks cascade with their record), so the uncheck stays idempotent.
- Regression test: `src/lib/services/todo-company-scope.integration.test.ts` —
  "refuses to UNCHECK the other company's record, by id" and "refuses to UNCHECK
  a MONEY mark under the other company". The pre-existing cross-company case
  only ever exercised `done: true`, which is why this survived. Mutation-checked:
  with the wall removed both go red, with it restored both go green.
- Status: **fixed** (Run 081, the access audit).

## BUG-017 — 2026-08-29 — the merge's anti-hole sweep lied about the walls it checks, twice more (BUG-015's family)
- Severity: major (a permission sweep that could not pass, and one that could be
  satisfied by a comment; no product behaviour was wrong)
- Where: `src/lib/crm/page-company-guards.test.ts` — the same file BUG-015 came
  out of, from the same batch.
  1. **The `bsRoleOf` assertion could never pass on this checkout.** It matched a
     needle carrying a literal line feed (the guard call broken across lines)
     against bytes read straight off disk. `git config core.autocrlf` is `true`
     and the repo has no `.gitattributes`, so every merged page is CRLF in the
     working tree (`agents/page.tsx`: 183 CRLFs) while the committed blob is LF.
     All ten pages that reach the assertion failed it; because it threw inside a
     `for` loop it aborted on the first, so the other nine were never examined
     either. Running that file alone at `4239dfa` on a clean tree gave
     `Tests 1 failed | 50 passed (51)`. A check that fails identically whether
     the code is right or wrong gives zero signal, and an always-red suite is a
     suite people stop reading. It also means Run 080's "682 passed / 0 failed"
     was recorded from an in-session LF worktree that had not round-tripped
     through a checkout — Run 081 carries the reproducible numbers.
  2. **A page could satisfy the sweep by NAMING a guard in a comment.** The
     per-page check filtered the guard names with a plain `src.includes(...)` on
     the raw source. A `page.tsx` holding an unguarded `db.lead.findMany` and the
     prose "see requireCompanySection / narrowRoles in lib/auth/page-guards.ts"
     passed both per-page assertions AND the `narrowRoles` loop; so did a page
     that imports a guard and never awaits it. The one mechanical net protecting
     the merge's central weakness — the company living in a query parameter —
     could be satisfied without calling a guard at all.
- Also: the directory walk collected only `page.tsx`, so a `route.ts` dropped
  into the merged shell's route group would have been a live endpoint the sweep
  never saw. None exist today.
- Fix: every read goes through a `codeOf(file)` that normalises CRLF and strips
  comments; the per-file check matches the CALL shape (an awaited
  `requireCompanyPage` / `requireCompanySection` / `requireBsAdminCompanyPage`)
  rather than the name; the `bsRoleOf` check uses a whitespace-insensitive
  regular expression; both loops COLLECT every offender and assert on the list,
  so one bad page cannot hide the ones behind it; the walk now collects
  `route.ts` as well.
- Mutation-checked — six probes, six reds, each restored afterwards with
  `git status` confirmed clean: (a) a page with no guard at all; (b) the
  comment-only page above; (c) a page importing a guard without awaiting it;
  (d) an unguarded `route.ts`; (e) `narrowRoles` removed from `todo/page.tsx`;
  (f) the company pin repointed from bsystems to byteforce in `agents/page.tsx`
  — which is the proof the dead assertion is alive again, since it now passes on
  the correct code on this same CRLF tree and fails when the pin is dropped.
- Not done, deliberately: adding `.gitattributes` (`* text=auto eol=lf`) would
  make every byte-level assertion checkout-proof, but it rewrites the whole
  working tree on the founder's machine mid-week. Recorded here as the standing
  recommendation; the honest fix for a test is to stop asserting on bytes.
- Status: **fixed** (Run 081, the access audit).

## BUG-018 — 2026-08-29 — a tapped notification could land the founder on the other company
- Severity: major (wrong-company screen from a push; no data exposed that the
  account does not already hold)
- Where: `public/sw.js`, the `notificationclick` handler compared
  `here.pathname` with `target.pathname` before deciding to navigate. When the
  pathnames matched, the branch was skipped and control fell through to
  `client.focus()`, which returns without navigating.
- Why it broke now: before this batch every `deepLinkFor` output had its own
  pathname (`/byteforce`, `/b-systems`, `/b-systems/registrations`,
  `/b-systems/crm/lead/<id>`, `/byteforce/leads/lead/<id>`). ADR-067 moved the
  company into the QUERY STRING, so `src/lib/services/push/payload.ts` now emits
  `/b-systems?company=byteforce` for a ByteForce mention and `/b-systems` for the
  fallback — three notification targets collapsed onto one pathname.
  `public/sw.js` was untouched by the batch, so nothing re-examined it when the
  URL shape changed underneath it.
- Symptom: the installed app is sitting on `/b-systems?company=bsystems`; a
  ByteForce mention push arrives; he taps it; the worker focuses the window he
  already has and he is reading B-Systems while the notification named ByteForce.
- Fix: compare `here.pathname + here.search` with
  `target.pathname + target.search`, so a query-only difference still triggers
  `client.navigate(target.href)`.
- Regression test: `src/lib/services/push/sw-deep-link.test.ts` — it loads the
  REAL `public/sw.js` into a fake `self` and drives the real handler, so nothing
  is duplicated. Mutation-checked: restoring the pathname-only comparison turns
  the first case red, while "already on the very address, so just focus" and "no
  window, so openWindow" stay green either way — which is what proves the fix
  did not simply make it always navigate.
- Status: **fixed** (Run 081, the access audit).

## BUG-019 — 2026-08-29 — a repeated `?company=` was read one way by the server and another by the chrome
- Severity: minor (company CONFUSION, not access — it fails closed)
- Where: `src/lib/crm/company.ts`. `parseCompany` took `string | undefined | null`,
  but Next hands a server page `string[]` for a repeated parameter; an array is
  not one of the two literals, so it read as junk and `resolveCompany` fell back
  to the account's DEFAULT company. Meanwhile `CompanySwitch.tsx` and the three
  `params.get("company")` reads in `CrmShellNav.tsx` took the FIRST value. Probed
  with roles `[bsystems_admin, byteforce_staff]` and a doubled
  `company=byteforce`: the server said `bsystems`, the chrome said `byteforce`.
  The page rendered B-Systems rows under a ByteForce nav, a ByteForce
  "Company · …" label and a bell polling `/api/byteforce`.
- It is NOT an access hole and never was: the fallback is by construction a
  company the account holds, so no unheld company can be surfaced. It breaks the
  invariant `resolveCompany`'s own comment states — "never render the other one's
  data under the label they asked for" — and the founder's "there is no confusion
  in it", which is the whole reason the switch exists.
- Second half, same root: `withCompany(href, company)` appended `company=`
  unconditionally, so calling it on an href that already named a company
  manufactured the duplicate itself. It has no production call site today (the
  one `withCompany` grep hit outside its own tests is an unrelated boolean prop
  in `components/bsystems/dataEntry.tsx`) — but it is exported, unit-tested and
  documented as the way to keep the company across a navigation, so the next
  caller inherits the trap.
- Fix: `parseCompany` accepts `string | readonly string[]` and treats anything
  that is not exactly ONE value as junk; a new `companyInParams(params)` wraps
  `params.getAll("company")` through the same predicate and is what the switch,
  the nav, the home link and the bell now call; the three page guards are typed
  `string | readonly string[]`; `withCompany` rebuilds the query through
  `URLSearchParams`, whose `set` REPLACES an existing `company`.
- Regression test: `src/lib/crm/company.test.ts` — "a REPEATED `?company=` reads
  the same on the server and in the chrome" asserts the two halves side by side
  (junk both ways, identical for every single value), plus "withCompany REPLACES
  a company already on the href, never doubles it". Mutation-checked: reverting
  either half of the fix turns three of the four new cases red.
- Status: **fixed** (Run 081, the access audit).
