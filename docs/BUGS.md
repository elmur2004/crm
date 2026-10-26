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

## BUG-020 — 2026-09-26 — the company switch dropped you on the dashboard from the Calendar, and nothing could have caught it

- Severity: minor (a navigation surprise, no data and no access involved)
- Where: `src/components/shared/CompanySwitch.tsx` — `SHARED_PATHS` / `targetFor`,
  as shipped by ADR-067 and never updated by ADR-071.
- Repro: sign in as an account holding BOTH companies (the founder), open
  `/b-systems/calendar?company=bsystems`, press **ByteForce** on the company
  switch. You land on `/b-systems?company=byteforce` — the dashboard — instead of
  the ByteForce calendar. Same for any other shared screen added after ADR-067.
- Cause: `targetFor` keeps the path only for a path listed in `SHARED_PATHS`, and
  that list still read
  `["/b-systems", "/b-systems/todo", "/b-systems/leads", "/b-systems/crm"]`. The
  Calendar is a SHARED screen — one address, both companies, exactly like the
  To-Do — but adding it to the nav was not accompanied by adding it here.
- **Why no test failed: the list lived inside a `"use client"` component**, and
  nothing in the vitest suite imported either the list or `targetFor` (a grep for
  both names returned only their own declaration and their one call site). So the
  rule had no test, in a repo whose whole method is to make the directory the
  assertion. It sat wrong for a month.
- Fix (ADR-081): `SHARED_PATHS` and `targetFor` moved to `src/lib/crm/switch-target.ts`
  — pure, no React, importable — with the Calendar and the new Daily report both
  in the list.
- Regression test: `src/lib/crm/switch-target.test.ts` asserts the property rather
  than the list: **every href that appears in BOTH companies' navs must be in
  `SHARED_PATHS`**, derived from `crmNavFor` itself. A shared screen added
  tomorrow and forgotten here is a failing test instead of a silent bounce. Plus
  the three cases the list is actually for: a shared path keeps its path with the
  new company, a company-exclusive section and any deep link fall back to Home,
  and the Daily report — the one screen whose content is the same either way —
  keeps its path.
- Status: **fixed** (Run 096, ADR-081 §7).

## BUG-021 — 2026-10-08 — the backup never carried ADR-071's calendar, and a restore DELETED it

- Severity: **critical** (silent, unrecoverable data loss on the one operation
  whose entire job is not losing data)
- Where: `src/lib/services/backup.ts`, the `MODELS` array. `meetingAttendee` and
  `calendarEvent` were present in `src/tests/db-reset.ts` — which the array's own
  comment says to keep in sync with — and absent from the array itself. Shipped
  with ADR-071 (2026-09-26) and survived a feature, a phase gate and a production
  deploy.
- Symptom, in two halves, the second worse than the first:
  1. **The export omitted both tables.** `exportBackup` iterates `MODELS`, so a
     backup file contained no personal calendar entries and no meeting "also
     blocks" rosters at all.
  2. **The restore DELETED them.** `importBackup` wipes `[...MODELS].reverse()`
     and both of these cascade from parents that list DOES wipe —
     `MeetingAttendee` from `Meeting` and `User`, `CalendarEvent` from `User`. So
     a restore cleared every calendar entry and every roster in the live
     database, and then had nothing in the file to put back.

  Net effect: restoring a backup destroyed calendar data the backup had never
  saved. Nothing warned, nothing failed, and the counts the import returns never
  mentioned the two tables because they were not in the loop that builds them.
- Why nothing caught it: nothing could. The array carried a comment — *"Keep in
  sync with prisma/schema.prisma and src/tests/db-reset.ts"* — and a comment is
  not a mechanism. The round-trip integration test asserts the tables its own
  fixture populates, and its fixture had no calendar rows, so a missing table was
  invisible to it by construction. This is the second time a table has fallen out
  of this list: `undoEntry` was the first, found by hand during the ADR-053
  hardening, and its own comment in the file calls it "the exact failure mode
  INTEGRATION-PLAN §3 warns about".
- Fixed in ADR-084: both entries added in FK-safe order (`calendarEvent` after
  `user`, its only parent; `meetingAttendee` after `meeting` — deletes run
  reversed, so each clears before the rows it points at). Neither needs a restore
  twin: they are new tables with no legacy shape, and a pre-ADR-071 payload
  simply has no such key, which the existing `?? []` missing-table rule handles.
- Regression: `src/lib/services/backup-lead-log.integration.test.ts` →
  *"exports and restores personal calendar entries and meeting rosters"* asserts
  both tables are in the exported file, that the import counts them, and that
  they come back attached to the same account and the same meeting with ADR-071's
  default-private `shared` still false.
- And the structural fix, so the CLASS of bug is closed rather than this instance
  of it: `src/lib/services/backup-models.test.ts` reads `prisma/schema.prisma`
  and the `MODELS` list and fails on any difference, names the missing models in
  the failure message, checks for duplicates, diffs both ways against the reset
  list, and includes a test proving the guard itself can fail. Verified by
  re-injecting this exact bug: removing `"calendarEvent"` turns it red twice and
  names the table in both messages.
- **Unrecoverable residue, stated plainly:** any restore performed before
  2026-10-08 destroyed the calendar entries and meeting rosters live at that
  moment, and no backup from before today contains them. They cannot be
  recovered by anything. What is in the database now is safe from here on.
  Flagged to the founder in PROGRESS rather than left to be discovered.

## BUG-022 — 2026-10-08 — a repeated `?q=` 500'd the CRM board

- Severity: minor (a 500 on a URL shape only hand-editing produces; no data at
  risk, no wall bypassed)
- Where: both board bodies — `src/components/internal/pages.tsx` and
  `src/components/bsystems/pages/BsCrmBoardBody.tsx` — each doing
  `const search = (params.q ?? "").trim()`, with `params` typed `{ q?: string }`.
- Symptom: Next hands a server page `string[]` for a REPEATED query parameter,
  so `/b-systems/crm?q=a&q=b` gave `params.q === ["a", "b"]`, which is not
  nullish, so `??` passed it straight to `.trim()` — a `TypeError` in a server
  component, i.e. a 500 on the board. The page's own type said `string`, so the
  compiler had no reason to object.
- Why it had lived: the filter form is a `method="get"` submit with ONE `q`
  field, so the product cannot produce the shape. It takes a hand-edited URL, a
  stale link, or a client that appends rather than replaces.
- Found by: ADR-085, while adding a THIRD reader of the same parameter — which
  is the honest reason it surfaced now rather than any new symptom.
- Fixed: `oneValue()` in `src/lib/crm/company.ts`, the general case of the array
  rule `parseCompany` already applies to `?company=`. A repetition reads as
  ABSENT rather than as `"a,b"` — guessing which of two values the person meant
  is worse than ignoring both, and it is the answer every other reader of a
  query parameter in this app already gives (BUG-019). Both board bodies, the
  hop and the arrival notice read through it, and the two `params` interfaces now
  declare `string | string[]`, so the compiler stops agreeing with the lie.
- Regression: `src/lib/crm/company.test.ts` → "oneValue — a repetition is not a
  value (ADR-085)", five cases, including one that asserts the UNGUARDED
  expression really does throw `TypeError`. A regression test that only proved
  the fixed version works would not have shown there was a bug.

## BUG-023 — 2026-10-16 — the accounting Undo/Redo pair parked the keyboard on the half it had just silenced

- Severity: minor (accessibility; no money consequence — nothing was mis-applied
  and focus was never lost from the control)
- Where: `src/components/accounting/AcctUndoRedoButtons.tsx`, the focus-restoration
  effect. Found by `e2e/accounting-undo-redo.spec.ts` on its first run, which is
  exactly why that spec was written before the push rather than after.
- Symptom: press Undo with the keyboard and focus landed on the Undo button —
  which the press had just turned into "Nothing to undo" — while the Redo it had
  lit up **in the same place** sat one Tab away. Mirror case after Redo. Measured
  with a real Enter press, identically across three runs:
  `Expected "Redo: Added income: E2E UR Focus" / Received "Nothing to undo"`.
- Root cause, and it is a timing bug rather than a logic one: the effect fires
  TWICE on a successful press. Once when `setBusy(null)` lands, and again a
  server round trip later when `router.refresh()` delivers the new offers. The
  first version cleared `pressed.current` on that FIRST pass, while the pressed
  half still carried its old live label — so it focused the pressed half and
  disarmed. When the refresh arrived and that half went quiet, the effect
  re-ran (`undoWhat`/`redoWhat` are in its deps for precisely this) and returned
  at `if (!was) return`. The partner branch the code's own comment promised was
  therefore **unreachable**.
- Why it cost nothing worse: the hide-vs-disable decision. Because the quiet half
  carries `aria-disabled` rather than the real `disabled` attribute, it keeps its
  slot in the tab order and an accessible name that explains itself — so the
  keyboard was left somewhere useless but never nowhere.
- Fixed: the press is now remembered together with the offer that half was
  showing at press time, and the ref is held until that offer actually CHANGES —
  the only honest signal that the refresh has landed. On that pass focus goes to
  the partner if the press is what silenced the pressed half. A refusal (where
  the offer never changes) keeps focus on the pressed half, stays armed for
  exactly one more render and then disarms **without touching focus again**, so a
  later unrelated refresh cannot steal it from wherever the person has tabbed to.
- Regression: `e2e/accounting-undo-redo.spec.ts` → "after a press, focus lands on
  the half that is still live". It failed before the change and passes after;
  the whole file plus `e2e/accounting.spec.ts` now reads `20 passed`,
  `test-results/.last-run.json` → `{"status":"passed","failedTests":[]}`.
- Worth keeping: the spec was deliberately ordered so this assertion ran LAST,
  because the file is serial and a failure skips everything after it. That is why
  the other eleven behaviours were still provable while this one was red.

## BUG-024 — 2026-10-25 — the B-Systems Home's money read tables B-Systems stopped writing in V2, so every win since counted as EGP 0

- Severity: major (a wrong money figure on the founder's Home, every day since
  V2; no stored record was wrong, but the sum read the wrong records)
- Where: `src/lib/services/metrics.ts`. **Won value** was Σ
  `WonInfo.estimatedValue` and **To be collected** was Σ `Client.toBeCollected`,
  for BOTH companies.
- Repro: on B-Systems, confirm a win through the milestone tab
  (`create_won_deal`, V2 §4) with an estimated value, then open the B-Systems
  Home. Won count goes up by one and Won value does not move. To be collected
  does not move either, whatever the milestones say.
- Symptom: a B-Systems win writes a `WonDeal` and its milestones and never a
  `WonInfo`, and B-Systems Clients were dropped in V2. So every B-Systems win
  confirmed since V2 counted as EGP 0, and To be collected stayed frozen at
  whatever legacy Client rows existed. Won value and Won count were counting
  different sets of leads.
- Why it had lived, two reasons:
  1. **The demo seed hid it.** It gives a B-Systems lead a ByteForce-style
     `WonInfo`, so the demo Home showed money.
  2. **No test covered B-Systems money**, so nothing failed when the sum read
     the wrong records.
  The rule itself had been on record since day one: ADR-012 names
  `WonDeal.estimatedValue` as the won record for portal deals. The code had
  drifted from a decision, not from an ambiguity.
- Fixed in ADR-089: a `WON_RECORD: Record<Brand, "wonInfo" | "wonDeal">` table,
  so the compiler demands an answer per company (ADR-073). B-Systems Won value is
  `WonDeal.estimatedValue` ?? (legacy) `WonInfo.estimatedValue` ?? 0 per won,
  non-archived lead, so a pre-V2 win keeps its value and no lead counts twice.
  B-Systems To be collected is the value of milestones not yet completed on the
  company's won deals (archived included, ADR-043), plus any legacy Client
  balance. The hint now reads "Open milestones on won deals". ByteForce is
  unchanged on both tiles.
- Regression: `src/lib/services/metrics.integration.test.ts`, 9 tests. The
  money ones: a milestone-tab win is counted; a pre-V2 `WonInfo` win is kept;
  one value per lead even with both records; open-milestone value falls 900k →
  600k → 0 as milestones are checked; a legacy Client balance is kept; archiving
  drops value and count but keeps open milestones; no cross-company leak.
  **Mutation-checked:** mapping B-Systems back to `WonInfo` turns 6 of 9 red;
  restored, 9 pass.
- Status: fixed (ref: ADR-089, Run 104)
- **The founder will see it:** B-Systems Won value jumps, because it starts
  counting wins it always missed. That jump is the fix. To be collected changes
  meaning to open milestone value.
- Still open, same family: the demo seed still gives a B-Systems lead a
  `WonInfo`, the exact shape that hid this bug (ADR-089 §5).

## BUG-025 — 2026-10-25 — Leads per stage omitted live stages, so a parked lead counted in Total leads and in no cell

- Severity: minor (a breakdown that did not add up; the total itself was right)
- Where: both Home pages hand-listed six stage cells:
  `src/app/(bsystems)/b-systems/(app)/page.tsx` (B-Systems) and
  `src/components/internal/pages.tsx` (ByteForce). `leadsPerStage` in
  `src/lib/services/metrics.ts` was filled the same way.
- Repro: put a lead in Postpone / Not answering (T-11) on either company, or in
  Negotiation on B-Systems, and open that Home. Total leads counts it, and no
  cell does.
- Symptom: B-Systems left out Negotiation and Postpone; ByteForce left out
  Postpone (ADR-072). The cells summed to less than Total leads by exactly the
  parked and negotiating leads.
- Why it had lived: the hand list matches SPEC §6.5's "Leads per stage" row,
  which still lists six cells and predates both stages, and DESIGN-BRIEF §4.1
  lists the same six. Both stages reached the pipeline config and never reached
  the Home.
- Fixed in ADR-089: `leadsPerStage` is keyed by `configForBrand(brand).stages`,
  and both pages render one cell per key, with labels from `stageLabel` ("new"
  keeps "New / not actioned") and colours from `stageKey`. B-Systems now shows
  8 cells and ByteForce 7, and the cells sum to Total leads.
- Regression: `metrics.integration.test.ts`: B-Systems has a cell for every
  stage, Negotiation and Postpone included, and its cells sum to Total.
  ByteForce has Postpone and no Negotiation, and its cells sum to Total.
- Status: fixed (ref: ADR-089, Run 104)
- Doc drift left open: SPEC §6.5 and DESIGN-BRIEF §4.1 still say six cells
  (ADR-089 §2). A smaller cousin also stays open: `metrics.ts` and the two Home
  pages still type `"won"`, `"lost"` and `"new"` by hand (ADR-089 §5).

## BUG-026 — 2026-10-25 — every dashboard number flashed to 0 on load and climbed back

- Severity: minor (a visual glitch on every visit; the figures were right once
  settled)
- Where: `src/components/shared/AnimatedValue.tsx`, used by the dashboard KPI
  tiles through `StatCard.tsx`.
- Repro: open either Home. The server's real figure paints, the next frame shows
  0, and the number climbs back to the real figure over about 700 ms. It happens
  again on every visit. When a figure really changed, it also restarted from 0
  instead of moving from the old value.
- Root cause: the component counted from 0 on every mount by design. That was
  the original "count up on load" behaviour (IMPLEMENTATION.md, "AnimatedValue
  count-up vs E2E numeric reads"). With a server-rendered first paint, the first
  animation frame overwrote a correct number with a wrong one.
- Fixed in ADR-089: the component animates only on CHANGE. The first frame is the
  server's figure, with no mount animation. A later change eases from the number
  on screen to the new one (600 ms, ease-out cubic), and reduced motion snaps.
- Regression: **none automated.** No test targets `AnimatedValue`; the datetime
  sweep only allowlists its `toLocaleString`. Recorded as a gap in Run 104.
- Status: fixed (ref: ADR-089, Run 104)
- Known follow-up, not fixed: the count-up's number regex ignores a leading
  minus sign, so a negative ByteForce To be collected crossing zero can show the
  wrong sign mid-animation before it settles correctly (ADR-089 §5).

## BUG-027 — 2026-10-25 — a background prefetch could undo a sign-out or a "Back to admin"

- Severity: **major, security-relevant.** A sign-out could be silently reversed,
  so a session came back after logout (fixation-like resurrection). The session
  that came back was always one the same browser had held a moment before; no
  account reached anyone else's data. But "I signed out" stopped being a
  promise, and an admin snapping back from impersonation could be put back
  inside the agent's account.
- Where: `src/proxy.ts`. The NextAuth wrapper (`auth(...)`) re-issues
  `authjs.session-token` on **every** request it handles, because the session
  is a sliding 24-hour JWT (`session: { strategy: "jwt", maxAge: 24 * 60 * 60 }`,
  `src/lib/auth/config.ts`). That includes Next's background prefetches
  (`Next-Router-Prefetch: 1`, `RSC: 1`).
- Repro:
  1. **Impersonation.** Sign in as the admin, impersonate an agent, open a
     screen whose links get prefetched (the board), press "Back to admin", then
     navigate. You land on the agent's board, still impersonating.
  2. **Sign-out.** The same shape: sign out while prefetches are still in
     flight, and one that lands late signs the person back in. Likeliest on a
     slow phone connection.
- Root cause, read from the Playwright trace's network log: a prefetch carries
  the session it **started** with. About **20 prefetches** started under the
  impersonated agent's session landed **after** the "Back to admin" server
  action had set the admin's cookie. Each one's `Set-Cookie` wrote the agent's
  session back over the admin's, so the next page load went to the agent's
  board.
- Why it had lived: **it is pre-existing, not introduced by this push.** The old
  impersonation spec never navigated after snapping back, so nothing ever read
  the cookie the late prefetches had rewritten. ADR-090 made the spec land on
  the launcher and then open the admin's page, and the full e2e run caught it.
- Found by: the full Playwright run after ADR-090, on
  `e2e/impersonation.spec.ts`.
- Fixed: `src/proxy.ts` now wraps the auth gate. For a **GET fetched in the
  background** — recognised by the browser's own `Sec-Fetch-Dest: empty` — it
  strips every `Set-Cookie` for `authjs.session-token` from the response,
  including the `__Secure-` prefix and the chunked `.N` variants
  (`/^(__Secure-)?authjs\.session-token(\.\d+)?=/`), and keeps any other cookie.
  **Page loads (`Sec-Fetch-Dest: document`) and server actions (POST) keep the
  sliding refresh.** Router prefetches and RSC client navigations (both fetch()
  GETs) lose it — so with the 24h `maxAge`, the session now slides on every full
  page load and every action rather than on every click; an account that opens
  the app at least once a day sees no difference.
- **The first fix did not work, and why (recorded so nobody repeats it):** it
  keyed on `Next-Router-Prefetch`. The proxy adapter strips Next's router
  headers (`RSC`, `Next-Router-Prefetch`, `Next-Router-State-Tree`,
  `Next-Router-Segment-Prefetch`) and the `_rsc` parameter before the proxy runs
  (`node_modules/next/dist/server/web/adapter.js`, FLIGHT_HEADERS), so the check
  never fired; the regression spec caught it. `Sec-Fetch-Dest` is a browser
  header Next leaves alone. A request without it (plain-http LAN, where browsers
  do not send `Sec-Fetch-*`) keeps the old behaviour.
- Regression: **`e2e/session-prefetch.spec.ts`**, 3 tests, pinned at the HTTP
  level so the race needs no timing to reproduce:
  - a prefetch response carries no session cookie;
  - a real page load still refreshes it (the sliding 24h stays);
  - a late prefetch carrying the pre-sign-out cookie cannot undo a sign-out:
    it gets no session cookie back, and the next page load goes to `/login`.

  `e2e/impersonation.spec.ts`, which now navigates after "Back to admin", is the
  end-to-end witness.
- Status: **fixed over HTTPS and localhost; still open over plain-http LAN and
  on browsers without Fetch Metadata (Safari before 16.4).** Browsers send
  `Sec-Fetch-*` only to secure origins, so where the header is absent the
  proxy keeps the old behaviour and a late prefetch can still undo a sign-out.
  Production (crm.byteforceinc.com) is HTTPS, so it is covered. Ships with
  ADR-090–092 (ref: Run 105). Needs founder confirmation: whether anyone uses
  the app over plain-http LAN — if so, the full fix is server-side session
  state (see the stateless-JWT note below).
- **Remaining shapes of the same race, recorded (spec-guardian):** a server
  action already in flight, or a page load in another tab, that started under
  the old session still refreshes it (POSTs and document loads keep the slide
  by design); and a late prefetch's page DATA, rendered under the old session,
  can still land in the router's client cache — the cookie is fixed, that
  cached payload is not, until the next navigation re-fetches it.
- **Known, out of scope, recorded:** a JWT session is stateless, so a token
  issued before a sign-out **remains valid until its own expiry** (up to 24
  hours). Signing out clears the cookie in that browser; it does not revoke a
  copy of the token held elsewhere. ADR-017's per-request database re-read means
  a **deactivated** account still loses access on its next request; it is only
  sign-out that does not revoke. Closing that would need server-side session
  state (a revocation list or a token version on the User row), which is a
  decision of its own.

## BUG-028 — 2026-10-26 — done To-Do tasks were never visibly struck through

- Severity: minor (visual). ADR-062 promises that done rows are "struck through
  + muted". The Done section, its label and the muting still set them apart,
  so nothing was lost or mis-recorded.
- Where: the To-Do's done-row title link. It carried both of Tailwind's
  `underline` and `line-through` utilities. They set the same property,
  `text-decoration-line`, so the later of the two in the utilities layer won.
  That was `underline`, so the strike never rendered.
- Repro: tick a task on the To-Do. It moves under Done with "Done · <name>",
  and its title is underlined, not struck through.
- Why it had lived: `e2e/todo-done.spec.ts` asserts the link
  `toHaveClass(/line-through/)`. That checks the class, not the computed style,
  so the test passed while the strike never showed.
- Found by: the CRM body agent, on the ADR-097 pass.
- Fixed: `src/themes/crm.css`, in the To-Do section, now declares the strike in
  the body layer: `.todo-row--done .todo-title { text-decoration-line: line-through; }`.
  A manual completion being restored lifts the strike while its row moves.
- Regression: **none that reads the computed style.** The e2e still asserts
  the class (grep at writing time). This is recorded as a gap in Run 107.
- Status: fixed (ref: ADR-097, Run 107)

## BUG-029 — 2026-10-26 — the Calendar was inset 26px further than every other page

- Severity: minor (layout)
- Where: `src/components/shared/CalendarPageBody.tsx`. It wrapped its body in
  a second `.page` inside the shell's `<main class="page">`, which already pads
  the screen. That inset the calendar 26px further than every other page and
  narrowed it by 52px.
- Repro: open the Calendar and compare its heading's inline-start edge with
  the board's or the Leads page's.
- Found by: the CRM body agent, on the ADR-097 pass.
- Fixed: a plain `cal-page` wrapper replaces the nested `.page` (the comment at
  line 164).
- Regression: none reported.
- Status: fixed (ref: ADR-097, Run 107)

## BUG-030 — 2026-10-26 — the won-deal page scrolled sideways by 32px at 390px

- Severity: minor. It broke SPEC §15's "responsive and usable at … 390 px"
  (line 713) on one screen.
- Where: `src/components/bsystems/pages/BsWonDealBody.tsx`. On a phone the
  page's grid had an implicit `auto` track, which grew to its widest child, so
  the upload row pushed the page 32px sideways at 390px.
- Repro: at 390px wide, open a B-Systems won deal (Won Leads → a deal). The
  page scrolls sideways.
- Why it had lived: Run 105's device sweep walks 13 screens, and the won deal
  is not one of them. The 320px sweep in Run 107 covers the 22 Accounting and
  Vault URLs, not the CRM.
- Found by: the CRM body agent, on the ADR-097 pass.
- Fixed: `grid-cols-1` (= `minmax(0, 1fr)`) under `md:grid-cols-2`, so the one
  phone column can shrink to the screen (lines 55–58).
- Regression: none reported.
- Status: fixed (ref: ADR-097, Run 107)

## BUG-031 — 2026-10-26 — the Ready-to-close badge and "Mark ready to close" were below text contrast

- Severity: minor (accessibility: text contrast under WCAG AA)
- Where:
  - **The Ready-to-close badge** (`.badge--accent`) was white on Signal Pink,
    **3.12:1**.
  - **"Mark ready to close"** (`.crm-ready`, on the lead's Next-action card)
    was pink text on the card. Its contrast was too low; the figure was not
    reported.
- Repro: on the B-Systems board, look at a card marked ready to close and at
  its badge. On a B-Systems lead page, look at the "Mark ready to close"
  action.
- Found by: the CRM body agent and its brand audit, on the ADR-097 pass.
- Fixed in `src/themes/crm.css` (lines 281–287):
  - the badge carries `--frame-on-accent`, which is Indigo Deep on pink at
    5.84:1, ADR-093's pair;
  - the action carries `--color-stage-won-chip-ink`, a dark rose, on the card
    with a pink edge. The CSS comment records it as AA on the card in both
    themes.
- Regression: none reported beyond the brand audit.
- Status: fixed (ref: ADR-097, Run 107). The restyle is on the founder's list
  in ADR-097 (item 9).

## BUG-032 — 2026-10-26 — the chat bubble's tail and the milestone date arrow did not mirror in Arabic

- Severity: minor (RTL, cosmetic)
- Where:
  - the lead chat's message bubbles, whose corners are now logical
    (`border-end-start-radius` and `border-end-end-radius` in `crm.css`, around
    line 277);
  - the won deal's milestone date arrow. The docs-keeper did not trace it to a
    line; this is as the agent reported it.
- Repro: switch to Arabic. In a lead's chat, the bubble's tail points the
  English way. On a won deal, the milestone date arrow points the English way.
- Found by: the CRM body agent, on the ADR-097 pass.
- Fixed: both now flip in Arabic.
- Regression: none reported. `crm.test.ts` requires logical properties
  throughout `crm.css`, which covers the bubble's corners but not the arrow.
- Status: fixed (ref: ADR-097, Run 107)
