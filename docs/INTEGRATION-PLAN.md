# Integration Plan — Accounting & Data Vault (DRAFT — pending founder approval)

> Produced 2026-08-17 from a six-agent deep analysis (5 analyzers + 1 synthesizer,
> ~567k tokens over every file of both projects and the CRM's integration surface).
> Status: AWAITING FOUNDER DECISIONS (§6). No implementation has started.

## 1. What you have

**Data Vault** (`D:\CRM\Data Managment System\`, app name "Vault"). A finished, acceptance-passed internal registry: Forms, Sheets, Documents, and Tasks with a result-gated completion rule and automatic late calculation. This is real, production-grade software — 10,027 lines, 136 automated tests, all 17 acceptance criteria passing, a genuinely strong file pipeline (magic-byte content inspection, versioning, 5-minute signed download links, archive-never-delete, append-only activity log). Its data lives in its own Postgres database (`database_app` on port 55432) with files on local disk under `storage/` — all on your machine; it has never been deployed. It is a separate git repo nested inside the CRM repo, built on Next 15 / Prisma 6 / **Better Auth** — one major version behind the CRM on both framework and ORM, and a completely different login system. It documents its own two standalone release blockers: no real malware scanner wired (`MALWARE_SCAN=off` marks everything clean) and no scheduler for deadline-reminder emails.

**Accounting** (`D:\CRM\Accounting\`). One 2,422-line HTML file: CSS, persistence, and a React SPA compiled by Babel **in the browser on every page load**, deployed as a Cloudflare Worker. To be blunt about the data: it is *not* browser-local, but it is the next most fragile thing — each company's entire books are **one JSON blob in Cloudflare Workers KV** (a live production namespace, `45ebb81c…`), protected by **a single shared password** compared with plain `===`, written whole-document, last-writer-wins. localStorage only caches the password and keeps a recovery mirror. Two people editing at once silently overwrite each other; there are no users, no audit trail, no versioning. Functionally it is impressive and clearly in daily use — cash-basis P&L, approval-gated expenses, effective-dated payroll with auto-generated salary rows, media pass-through accounting, loans, treasury, full EN/AR with RTL. Structurally it is a one-bookkeeper pet system, untracked in this repo and deployed from a separate GitHub repo.

## 2. Integration approach per module

### Data Vault — recommendation: **merge into the CRM as an admin route group, executed as a port** (take the server brain, re-skin the UI, delete its auth)

The three realistic options:

- **Linked separate deployment** (keep it on port 3001, link from the CRM). Zero build cost today, but: a second login and password for you, a second database and deployment to babysit forever, its two release blockers (ClamAV, cron scheduler) still need solving before it can go live at all, and "admin-only" would be enforced by a different auth system than the CRM's. It also leaves the nested-git-repo mess in place.
- **Full code merge (drop the codebase in as-is).** Not actually available. The Prisma schemas collide head-on: both define `User` and `ActivityLog` incompatibly, and Vault's `UserRole` is an *enum* while the CRM's is a *model* — Prisma won't compile both in one schema. Better Auth's tables can't be read by the CRM's auth. Add Next 15 vs 16, Prisma 6 vs 7, real Postgres enums vs the CRM's string-union doctrine, next-intl vs `Msg {en, ar}`, uuid vs cuid. A verbatim merge is a fight on every axis.
- **Port (recommended).** "Only the admin will have access" is the unlock: because only you sign in, Vault's entire hardest layer — Better Auth, employee accounts, invitations, activation tokens, session revocation, per-employee scoping — is **deleted, not migrated**. `Employee` becomes a plain record (a task-assignee card with name/title/company), not a login. What remains to port is exactly the valuable part: ~10 domain models (renamed to fit house conventions), the file inspection and versioning logic, the tasks completion gate and the unit-tested lateness math (`complete.ts`, `lateness.ts` — both pure and portable), the archive service, and four list screens whose patterns (server page → DTO → client table, URL-state filters) already match the CRM's idioms.

### Accounting — recommendation: **rebuild on top of the CRM** (port the engine functions, new Prisma models, rewrite the UI), with an export-first, read-only cutover of the KV data

- **Linked satellite** (keep the Worker, link to it). Keeps the shared password guarding both companies' full financials — directly against your "admin only" rule and the CRM's server-side-permissions rule 7 — keeps the last-writer-wins clobber risk, keeps clients as free-text names forever, and keeps the books outside the CRM's backup.
- **Full merge.** There is no code to merge: Babel-in-browser, UMD React, and inline `C.*` styles violate the CRM's zero-hardcoded-colors rule the moment any of it enters `src/`. The view layer is a rewrite under any plan.
- **Rebuild-on-top (recommended).** The accounting *rules* live in ~500 lines of pure, framework-free functions (`autoPayroll`, `treasuryThrough`, `liveTreasury`, `clientAccounts`, `loanTotals`, `memberAt`/`memberUpsert` effective dating) that port nearly verbatim into a typed `src/lib/accounting/` library. The `migrate()` function is an executable schema spec, and the app's own Excel/JSON export (including "Export ALL companies") gives a lossless extraction path for the production KV data. Money is integer EGP today, so converting to the CRM's Int-piasters convention is a lossless ×100. The ~300-entry Arabic dictionary is directly reusable content for the mandatory bilingual pass.

## 3. The unified shape

- **Nav:** two new items in the `bsystems_admin` array in `src/app/(bsystems)/b-systems/(app)/layout.tsx` — **Accounting** and **Data Vault**. No other role sees them; `src/proxy.ts` needs zero changes.
- **Routes:** `src/app/(bsystems)/b-systems/(app)/accounting/` (dashboard, income, expenses, clients, roster, media, loans, treasury, reports/targets) and `.../vault/` (forms, sheets, documents, tasks, archive). Every page opens with `requireBsAdminPage()`; every API route lives under `src/app/api/b-systems/accounting/` and `.../vault/`, wrapped in `handleRoute` + `requireBsAdmin()`. All pages `force-dynamic` (no build-time DB reads).
- **Schema — prefixed models, one database.** All in the single `prisma/schema.prisma`, following house conventions (cuid ids, String pseudo-enums validated by Zod, Int piasters, declared relations, denormalised actor labels):
  - Vault: `VaultEmployee`, `VaultForm`, `VaultSheet`, `VaultDocument`, `VaultTask`, `VaultTaskAttachment`. Vault's 9 Postgres enums become String unions in constants; the sheet link-XOR-file invariant moves from a DB CHECK into the Zod discriminated union + service assertion (already two of its three layers today).
  - Accounting: `AcctIncome`, `AcctExpense`, `AcctRosterMember`, `AcctRosterSegment`, `AcctPayrollPayment` (the `payrollPaid` map as rows), `AcctTreasuryMove`, `AcctLoan`, `AcctLoanPayment`, `AcctMediaEntry`, `AcctTarget`, `AcctSettings` (opening balance).
  - Company stays a tag column (`"BYTEFORCE" | "BSYSTEMS"`) — one admin screen per module with a company filter/switcher replaces the two-tenant setup.
- **Auth:** your existing CRM login is the *only* login. Better Auth's User/Session/Account/Verification/Invitation tables are not migrated at all; the accounting shared password dies with the Worker. Every wall is `bsystems_admin` by name, per the CRM's build-by-construction rule.
- **Files:** everything through the CRM's storage abstraction and `Attachment` rows so `/api/files` auth, health checks, and backup capture apply automatically. Extend the `UploadKind` union with `vault_sheet | vault_document | vault_attachment` and port Vault's stronger magic-byte inspection (OOXML ZIP discrimination, CSV sniffing) into `RULES`/`sniffOk` — a security upgrade for the whole platform. Vault's HMAC signed-URL scheme is retired; the authenticated `/api/files` route replaces it.
- **Backup:** every new model is appended in FK-safe order to `MODELS` in `src/lib/services/backup.ts` **and** to `resetDb()` in `src/tests/db-reset.ts` in the same PR as its migration — this contract fails silently (the `UndoEntry` omission proves it), so each phase's gate includes a restore drill.
- **i18n:** two new dict modules, `src/lib/i18n/dict/vault.ts` and `accounting.ts`, with `Msg {en, ar}` for every string from day one. Vault's 318-string `en.json` is the extraction source (needs an Arabic translation pass); the accounting SPA's AR dictionary seeds the accounting module's Arabic.
- **Migrations** are additive and ride `prisma migrate deploy` at boot, like everything else.

## 4. Phased build plan

Accounting goes first: your live books sit in the most fragile system, and Vault runs fine standalone in the meantime.

**Phase 0 — Safety & hygiene (light).**
Export both tenants' accounting data (Excel *and* JSON) using the app's own export menu; store dated archives; verify they re-import. Snapshot Vault's `database_app` and its `storage/` directory. Decide repo handling: the Vault folder and Accounting folder remain *reference sources to port from* — they are never `git add`-ed into the CRM repo. Log the plan's ADRs (module names, prefixes, auth decision).
*Done when:* archives verified restorable; ADRs logged; zero code changes in the CRM tree.

**Phase 1 — Accounting engine + schema (heavy).**
Prisma models + migration + backup/reset registration. Port the pure functions into `src/lib/accounting/` as piaster-based TypeScript with unit tests encoding the business rules: cash-basis (income counts when collected), approval-gates-cash (on-hold expenses never touch profit), auto-payroll derivation including the linked-manual-row replacement rule, media pass-through (client budget never touches profit), loan settlement epsilon (0.5 EGP → 50 piasters). Build the importer (KV JSON → rows); payroll stays *derived* by the engine exactly as the SPA derives it, so the importer never materialises salary rows and cannot under-count.
*Done when:* the importer, run against the real export, reproduces the old app's dashboard numbers — treasury balance, month net, A/R, A/P, committed salary — exactly, in automated tests.

**Phase 2 — Accounting UI (heavy).**
Screens under `/b-systems/accounting`, composed from existing design-system classes and B-Systems tokens (no green, pink as cue only), month picker + company switcher, `Msg` i18n with Arabic seeded from the old dictionary, ActivityLog on every mutation. rbac 403-matrix e2e spec, qa-sweep entries for each page, `/brand-audit` pass.
*Done when:* a full month of bookkeeping is doable in the CRM against a test DB; vitest + Playwright green; brand audit passes.

**Phase 3 — Accounting cutover (light, careful).**
Agree a freeze day; final export; import into production; reconcile totals side by side; demote the Cloudflare Worker to read-only archive (or retire it); retire the shared password.
*Done when:* production balances match the old app to the piaster; the old app can no longer accept writes.

**Phase 4 — Vault schema + services port (heavy).**
Prefixed models; enums → String unions; files re-homed onto `Attachment` + the storage abstraction with the extended sniffing rules; port services: forms (duplicate-URL handshake), sheets (row-count heuristics), documents, tasks (`complete.ts` single completion path, `lateness.ts` computed-once-and-stored), archive service. Delete all Better Auth / invitation / scoping code. Backup/reset registration.
*Done when:* ported integration tests green — including 422 on completion without a result and lateness never recomputed after deadline edits.

**Phase 5 — Vault UI (heavy).**
Forms, Sheets, Documents, Tasks, Archive under `/b-systems/vault`, re-skinned from Vault's dense ByteForce styling onto the CRM design system; all ~318 strings translated to Arabic; admin-only views (employee cards remain, employee *logins* do not). rbac + qa-sweep + brand audit.
*Done when:* all four sections usable end-to-end; suites green.

**Phase 6 — Vault data migration + decommission (light).**
If keeping existing data (the app is weeks old — likely mostly demo): scripted Postgres→Postgres copy plus file copy into `UPLOADS_DIR` as Attachments. Optionally wire task-assignment/deadline emails (needs production SMTP + a scheduler) — or drop them. Retire the port-3001 app; final restore drill covering every new model.
*Done when:* old app off; restore drill passes; docs and PROGRESS updated.

## 5. Risks & mitigations

1. **Live books in KV.** The wrangler config points at a real production namespace. Mitigation: export-first (Phase 0), edit freeze at cutover, numeric reconciliation as a hard gate, and no new code ever writes to KV.
2. **Last-writer-wins clobbering during transition.** Single-operator rule + freeze window until cutover completes.
3. **Derived auto-payroll ETL trap.** Salaries exist only at render time; naively importing `expenses` drops all payroll. Mitigation: the ported engine keeps deriving payroll; Phase 1's definition of done is numeric equality with the old dashboard.
4. **Schema collisions and convention clashes.** Nothing is dropped in; every model is re-authored with a `Vault`/`Acct` prefix under host conventions, mechanically checked against the CRM's 22 reserved model names.
5. **Silent backup/reset omission.** `MODELS` and `resetDb()` are hand-maintained and fail silently. Mitigation: registration in the same PR as each migration + a restore drill in every phase gate.
6. **Admin-only holes.** `proxy.ts` admits *every* B-Systems role into `/b-systems/*`; one forgotten `requireBsAdmin` exposes a page to sales/agents/partners. Mitigation: an rbac 403-matrix e2e spec ships with each phase, refusing real requests per role.
7. **Bilingual mandate.** Arabic is required at ship time, and English strings become e2e-asserted literals immediately. Budget the 318-string Vault translation; use `.u-ltr` for Latin runs in Arabic prose.
8. **Brand audit rejection.** Vault's arbitrary-px density and the SPA's inline colors will fail `/brand-audit` if copied. Mitigation: re-tokenize onto semantic vars; compose existing design-system classes rather than porting classnames.
9. **Money conversion.** Integer EGP ×100 to piasters is lossless, but every formula and threshold must be re-tested at piaster scale.
10. **Free-text client names.** Accounting clients are strings; CRM clients are entities. Import as strings, add an optional mapping table later — do not block cutover on reconciliation.
11. **Nested git repo.** `Data Managment System/.git` inside the CRM repo (plus the space and typo in the name): never commit the folder into the CRM tree; treat both source folders as archives.
12. **Vault's standalone release blockers mostly dissolve** (its signing, cron, and scan stack are retired in favour of host mechanisms), but if reminder emails are kept, production SMTP and a scheduler become new deployment dependencies that must be explicitly owned.

## 6. Decisions needed from the founder

1. **Is Vault truly admin-only forever?** Today employees complete their own tasks through the result gate. If only you log in, you record results on their behalf and employee logins are deleted — this is what makes the merge cheap. If employees must keep self-service, that is a new CRM role (touches `proxy.ts`, `landingFor`, NAV, the roles dict) and materially more work. Which is it?
2. **Vault data: migrate or start fresh?** The app is weeks old — is there real data in it worth a migration script, or do you re-enter?
3. **Placement and brand:** both modules live under the B-Systems admin area with the B-Systems look, and "ByteForce vs B-Systems" becomes a filter. Acceptable, or must Vault keep its ByteForce skin?
4. **Accounting cutover:** pick the freeze/cutover date, and decide the Worker's fate — read-only archive or fully retired. Also confirm which copy is master: `D:\CRM\Accounting` or the separate GitHub repo.
5. **Does B-Systems still hide Media Buying** (the current `media:false` rule), and does the department list stay as-is or align with the CRM's service taxonomy?
6. **Client linking:** connect accounting client names to CRM `Client` records now, later, or never?
7. **Task emails:** keep assignment/deadline-reminder emails to employees (requires production SMTP + a scheduler) or drop them since employees no longer log in?
8. **The design bundle** (`Vault.dc.html` / `Sales Platform.dc.html`): do those designs *restyle* what gets built here (affecting Phases 2 and 5), or are they documentation of the current look?
