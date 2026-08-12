# Changelog — user-visible changes per phase/release

## Logo fixes (2026-08-12)
- The printable statement document now shows the real B-Systems logo
  mark instead of the placeholder "S" gradient square.
- Header logos now link to the current app's home instead of the
  platform root: the B-Systems logo+wordmark goes to your first nav
  page (/b-systems for admins, /b-systems/crm for everyone else); the
  ByteForce logo goes to /byteforce. Both links have aria-labels.

## Uploads durability incident fix (2026-08-11)
- Fixed the production incident "uploaded files lost on redeploy": links
  to payment proofs, CVs, recordings, and proposal/contract PDFs no
  longer dead-end after a redeploy wipes the container disk.
- Missing files are now clearly flagged everywhere: the admin Statements
  page shows "proof file missing" with a Re-upload proof control (and a
  Replace proof control when the file is fine — paid statements only);
  the closer Payments page says "proof file missing — ask the admin to
  re-upload it" instead of a dead link; the printable statement omits
  its "Payment proof on file" line when the file is gone; prospect
  detail shows "Recording file missing" instead of a broken player.
- Opening a missing file in the browser now shows a styled explanation
  page (what happened, how to fix) instead of a raw error message.
- /api/health now reports uploads diagnostics: storage path, whether a
  persistent directory is configured, a writable check, and how many
  attachment files are missing from storage.
- Durable storage requires a one-time host setup: attach a persistent
  volume and set UPLOADS_DIR to its mount path (ADR-035) — until then,
  every redeploy wipes uploads again.

## Founder V4 round — Partnership CRM (2026-08-11)
- Partnership CRM board is now draggable like the main CRM: dropping a card
  opens the target stage's form in a modal (numbers, follow-up, meeting,
  Won completeness gate, lost reason); cancel reverts; dropping back onto
  Lead commits directly; Won and Lost cards can no longer be moved (toast).
- Admins can edit and delete pipeline cards and directory partners:
  deleting a card removes its stage records and recordings (incl. stored
  files) and, for converted cards, the directory Partner — attributed
  leads remain with attribution cleared; deleting a partner keeps the
  login account (removable in Users).
- Wide-screen layout fix: full-bleed board columns now start at the
  centered content edge instead of crowding the right; prospect and
  partner detail pages use the standard page-head layout.

## Founder V3 round (2026-08-10)
- Founder V3: two-way impersonation, agent-registration approval cycle,
  won-deal math barriers, printable statements, animated dashboard,
  full-bleed boards.

## PostgreSQL switch (2026-08-09)
- PostgreSQL everywhere (ADR-033): fresh init migration, embedded local
  Postgres for dev/tests, dev data carried over via the backup system.

## V2 — Unified role-aware B-Systems CRM (2026-08-09)
- Portal merged into the role-aware B-Systems CRM: negotiation stage,
  milestone-tab confirm-win, won leads/statements/payments, users +
  impersonation, agents/registrations sections, colored draggable board.
- Design system applied from the approved Claude Design prototype (ADR-031):
  new token sheet, dark B-Systems chrome, entity switcher, redesigned
  login/hub.
- Full admin backup/restore (ADR-032), animated UI motion layer, root now
  opens sign-in directly.

## Phase 5 — Hardening & handover (2026-08-09)
- Final demo seed: both brands populated across every stage, a converted partner
  with an attributed lead, and a won portal deal with a 3-milestone plan.
- Security proofs at the API level (rep/admin/staff walls); responsive + clean-
  console sweep at 1440/1024/768/390 across every screen; nav wraps on small
  viewports; B-Systems favicon (the S-mark).
- README with cold-start setup, demo accounts, test and deploy instructions.

## Phase 4 — Portal admin layer (2026-08-09)
- Admin dashboard (total leads, total estimated value, won deals, commissions).
- CRM with "All reps combined" / per-rep views; admin can move deals to Won.
- Won Deals management: estimated value + commission, milestone plans (any count),
  check/uncheck with sequential order; milestone sum warning (never blocking).
- Sales Team table: per-rep totals, per-stage counts, won value, commission.
- Reps see milestone unlocks live (≤5 s) without reloading.

## Phase 3 — Partnership Portal, rep layer (2026-08-09)
- Landing page with the B-Systems signature gradient; sign-up with CV (instantly
  active, lands in the portal); phone login.
- Rep CRM: six-column Trello-style board — drag between stages opens the stage's
  form, cancel reverts; Won is admin-only (blocked with a clear message).
- Won Deals view: auto-recorded wins, milestone values disclosed one at a time.
- Profile: view/edit basics, replace CV, change password.

## Phase 2 — B-Systems CRM + Partners (2026-08-09)
- Full B-Systems CRM (leads, pipeline, clients, dashboard) in the B-Systems brand.
- Partners Pipeline: six stages, cold-call recordings (mp3/mp4, playable inline),
  Didn't-Answer number slots with automatic return to Lead, Won completeness gate.
- Partners directory with date joined and each partner's live-stage leads table.
- Partner-sourced leads flow into the CRM with a permanent "Partner: {Company}" badge.

## Phase 1 — ByteForce CRM (2026-08-09)
- Leads: rep cards, per-rep tables, full lead detail with conditional stage forms.
- CRM board (five columns) driven by Next Actions and automatic transfers
  (proposal sent, meeting outcomes); History panel on every card.
- Clients: auto-created on Won with collection tracking; Home dashboard with all
  §6.5 numbers.

## Phase 0 — Foundation (2026-08-08/09)
- Both brand themes wired (ByteForce / B-Systems) with per-app login; shared
  pipeline engine; auth with roles; seed accounts.

## [0.0.0] — 2026-08-08
- Project starter: master specification, process tooling, brand token files for both
  companies. No application features yet.
