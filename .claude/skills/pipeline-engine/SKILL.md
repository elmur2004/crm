---
name: pipeline-engine
description: Normative contract for the shared pipeline engine - stages, next actions, conditional field groups, automatic transfers, attribution, and the activity log. Use when implementing or changing any pipeline, kanban board, stage transition, next-action behavior, dashboard metric, or when writing tests for SPEC section 10 rows.
---

# Pipeline engine — the heart of the product

One shared, parameterized module (suggested home: `src/lib/pipeline-engine/`). All four
pipelines run on it. SPEC.md §5 defines the mechanics; **§10's transition tables are
normative — every row implemented and unit/integration tested.** Do not fork per-app
copies; do not scatter stage strings through components.

## Contract

1. **Pure transition core.** `transition(card, event, ctx) → { nextStage, requiredGroup,
   sideEffects[] } | REJECT`. Pipeline configs declare: stage set, terminal stages,
   allowed next-actions per stage/role, and which events auto-move (proposal-sent,
   meeting-attended, new-number-added, admin-won).
2. **Field groups are child records, not columns** — FollowUp (with `context`:
   `initial` / `after_proposal` / `after_meeting`), Meeting, Proposal, LostInfo, WonInfo.
   History accumulates; nothing is overwritten (SPEC §5.2, A-2).
3. **Side effects run atomically with the move** and each writes an ActivityLog entry
   (actor, from → to, trigger, timestamp): client auto-creation (T-9), partner directory
   creation (PP-4), partner-lead attribution into the CRM (PP-5), WonDeal creation (P-6),
   milestone unlock (P-8).
4. **Permissions inside the engine**, not only the UI: a `portal_rep` event targeting
   Won is rejected server-side (P-2); milestone checks accept `portal_admin` only.

## Pipeline configs

| Pipeline | Stages | Notes |
|---|---|---|
| A/B internal CRM | Following Up · Meeting Setting · Sending Proposals · Won · Lost (+ New in Leads) | Action-driven only (A-7) |
| B Partners & Agents | Lead · Contacted · Didn't Answer · Meeting Setting · Waiting · Qualified · Lost | ONE stage set for both card kinds (ADR-059). PP-2 auto-return on new number; PP-4 the partner's Qualified completeness gate; PP-6 the agent's credential-free Qualified |
| C Portal | Leads · Following Up · Meeting Setting · Proposal Sending · Won · Lost | Drag & drop; Won admin-only |

## Non-negotiable rows (memorize; full tables in SPEC §10)

- T-5 / P-4: Proposal `Sent` ✓ → auto-move to Following Up, open follow-up with context
  `after_proposal`, proposal data retained.
- T-6 / P-5: Meeting `Attended` → destination choice is mandatory (rep destinations
  exclude Won); Following-up destination gets context `after_meeting`.
- T-7/T-8: Delayed → new datetime, stays; Cancelled → Following Up or Lost (A-3).
- PP-2: non-empty Number 2/3 saved while in Didn't Answer → auto-return to Lead, logged.
- PP-3: Contacted and Waiting open NO field group — the move commits immediately, both kinds.
- PP-4: a PARTNER's Qualified is savable only when the §7.2 gate fields are complete → Partner
  created, `date_joined = now`. Never an email, never a password.
- PP-6: an AGENT's Qualified is a pure move; the login is PP-4a, a separate admin-only action.
- PP-8: no stage implies a follow-up — only the explicit "Record a follow-up" writes one.
- PP-5: partner lead's next action → CRM card with permanent "Partner: {Company}" badge.
- P-6: admin → Won auto-creates the WonDeal with the six auto-filled fields.
- P-7/P-8: milestone 1 visible; milestone *i+1* locked (value hidden) until admin checks
  *i*; unlock is real-time for the rep and logged.

## Metrics

Dashboard formulas are in SPEC §6.5 and §8.5 — implement as tested queries (fixtures with
known expected numbers). Pipeline value excludes Won and Lost; missing money values
count as 0.

## Testing obligation

Every §10 row = at least one test named after it (e.g. `T-5`, `PP-2`, `P-6`), plus
illegal-move rejections. Log every run via `/log-test`.
