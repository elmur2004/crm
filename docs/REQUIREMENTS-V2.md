# Requirements V2 — founder revision of 2026-08-09 (normative)

Source: founder's voice-note brief (Arabic), translated into technical requirements
against the shipped v1. Where v1's SPEC.md conflicts with this file, **this file
wins** (founder-directed; umbrella ADR-030). Ambiguities resolved here are marked
**[A]** and flagged for founder confirmation.

## 0. Structural change — TWO apps, portal merged away

- The standalone Portal (`/portal`, `/portal/admin`) is **removed**. Its users and
  flows merge into the **B-Systems CRM** (`/b-systems`). Two apps remain:
  - **ByteForce CRM** (`/byteforce`) — unchanged from v1.
  - **B-Systems CRM** (`/b-systems`) — role-aware; everything below.
- B-Systems user types (roles): **admin**, **internal sales**, **agent** (was
  "portal rep"), **partner** (partner companies now get logins). Role mapping from
  v1: `portal_admin → bsystems_admin`, `bsystems_staff → bsystems_sales`,
  `portal_rep → bsystems_agent`, new `bsystems_partner`.
- One consolidated `/login` (ADR-028) stays. Agent sign-up stays exactly as today
  (self-registration with CV → profile). Sales accounts use email+password.
  Partner accounts are auto-provisioned (see §8).

## 1. Unified lead model (the big migration)

- v1's `PortalDeal` is **merged into `Lead`**. Every B-Systems lead lives in ONE
  pipeline with an **owner bucket**: `internal` (assigned to an internal rep),
  `agent` (owned by an agent account), `partner` (owned by a partner account),
  `admin` (created by an admin). ByteForce leads unchanged (`internal` only).
- Lead keeps its v1 fields; agent/partner-owned leads also carry the old deal
  fields (position, company name, industry, requirements) **[A]** as optional
  fields on Lead.
- **Stages (B-Systems)**: `new → following_up → meeting_setting →
  sending_proposal → negotiation → won | lost`. **`negotiation` is a NEW stage.**
  ByteForce keeps its v1 stage set **[A]**.
- **`ready_to_close` flag** (not a stage): available from ANY active stage to
  agents (and sales **[A]**); sets a visible marker on the card and notifies
  admins. Admin "Confirm win" is the only path into `won` for agent/partner-owned
  leads (v1 P-2/P-6 semantics preserved).

## 2. Admin's B-Systems CRM — ten sections

`Home | Leads | CRM | Won Leads | Partnership CRM | Partners | Agents |
Registrations | Statements | Users`

1. **Home** — v1 dashboard + below "Pipeline by stage": count of agents, count of
   partners, and a bar/tint chart of THEIR leads by stage (brand tints only).
2. **Leads** — top filter `Internal / Agents / Partners / Admins / Any` replacing
   the rep-cards-first view; admin sees every lead in every bucket; **admin can
   add a lead** (lands in the `admin` bucket); open any lead to **edit**, **copy
   data** (clipboard), or **delete** **[A: soft-delete]**.
3. **CRM (board)** — same filter incl. `admins`; **drag & drop for admin** (drop
   opens the stage's required form exactly like the v1 portal board);
   **per-stage colored columns** (palette tints, tokens); admin can open/edit any
   lead regardless of stage.
4. **Won Leads** — cards: lead name, value, closer (sales/agent/partner), and the
   milestone checkboxes. Inside: full details, **upload proposal PDF**, **upload
   contract PDF**, client details, milestones, contract date.
5. **Partnership CRM** — v1 partners pipeline, with the reworked numbers flow (§6).
6. **Partners** — v1 partners directory, unchanged.
7. **Agents** — like Partners but for agents; two views: **Detailed** (cards with
   the agent's profile info + join date + a table of their leads, each openable)
   and **Pipeline** (v1's per-agent board).
8. **Registrations** — registry of every account that signed up / was created
   (sales, agents, partners) with type + date **[A: table of accounts w/ role,
   identifier, created date]**.
9. **Statements** — §7.
10. **Users** — all users + their data; delete **[A: deactivate]**; and
    **impersonation**: open any account's app directly without re-login
    (activity-logged) **[A]**.

## 3. Stage forms — per role

- **Admin + internal sales**: identical to ByteForce v1 forms (follow-up with
  owner/with, meeting full, proposal, lost reason, won fields) + `negotiation`
  **[A: negotiation opens a simple note field]**.
- **Agent (lighter)**:
  - *Following up*: date only (no time), method — **no Owner, no With**.
  - *Meeting setting*: "Did you agree with the client on a time?"
    - **Yes** → pick date + time, online/offline, "need a technical person with
      you?" (yes/no).
    - **No** → pick the date + time that suits YOU (labeled so), online/offline,
      technical person yes/no.
    - On submit the agent sees: "Your request was received — we'll confirm on
      WhatsApp." **[A: message copy only; no WhatsApp API in v2]** and **admins
      get a notification** with all details (agreed?, date, time, technical
      support); clicking it opens that lead.
  - *Sending proposal*: normal proposal form; marking sent **auto-returns to
    following_up WITHOUT any follow-up form**.
  - From following_up next options: `negotiation`, `lost`, plus **Mark ready to
    close** (flag; also available from every stage) → admin notification.
- **Partner**: same light forms as agents **[A]**.

## 4. Confirm win + milestones v2

- Admin "Confirm win" on any active B-Systems lead → the milestone tab opens
  immediately:
  - **Total commission is a PERCENTAGE** (of estimated value), not an amount.
  - Per milestone: **name** (label stays "Milestone n" numbering by default
    **[A]**), **value**, **commission the closer receives**, **expected start
    date**, **expected end date**.
  - Completing the tab auto-moves the lead to `won` and records it in Won Leads.
- Closer-side Won Leads (sales/agent/partner): card with the client's CRM data,
  current milestone progress (which/of how many), and per-milestone commission —
  **commission VISIBLE to agents and partners, HIDDEN from internal sales**.

## 5. Won Leads storage/uploads

- New attachment kinds: `proposal` (pdf), `contract` (pdf), `payment_proof`
  (image) — same storage abstraction + validation; contract date field on the won
  record.

## 6. Partnership pipeline — numbers flow rework (founder calls v1 a bug)

- Moving to *Didn't Answer*: clicking **"Number dialed"** lists the numbers on the
  card (initially the single registered number); choosing which number(s) failed
  is the move step — **new numbers are NOT required at move time**.
- Later (any time), adding new number(s) — one or many, free-form — **auto-returns
  the card to Lead**; the failed number moves to **`non answering number`** and
  the new ones into **`alternative numbers`** (repeatable loop; no two-number
  cap — v1's number2/number3 slots are replaced by lists **[A: JSON arrays]**).
- *Meeting setting* on this pipeline: simplified form — date + time +
  online/offline only.

## 7. Statements & payments

- Every **checked milestone** lands in Statements as payable, one row per
  milestone (even same closer).
- Table 1 **Waiting to be paid out**: milestone, company/client, closer,
  commission value + **Generate** → editable tab: client name, milestone name,
  milestone value, its % of milestone, amount the closer receives, adjustments,
  expected payment date → **Create**.
- Table 2 **Statement**: statement code **[A: ST-#### sequential]** + client,
  milestone, closer, values.
- Creating a statement immediately shows it in the closer's **Payments** section
  as `pending` with the expected date. Admin **Mark payment** → upload a payment
  proof IMAGE (replaces "payment reference") → status `paid` for the closer.
- Internal sales: **[A: sales has no Payments section — no commission; statements
  for sales-closed milestones still tracked admin-side]**.

## 8. Partner account auto-provisioning

- On PP-4 conversion (partner Won), the system **auto-creates a partner login**:
  page/profile from the already-registered data; **password =
  `{CompanyName}@Bsystemspartnership`** (spaces stripped from the company name
  **[A]**), with the email already on record. If no email on the gate, the
  account is created without login until admin adds an email in Users **[A]**.
- Partner app: **CRM (their leads) | Won Leads (partner view) | Payments |
  Profile** (profile auto-filled, read-only basics **[A]**, password change).

## 9. Per-role navigation summary (B-Systems)

| Role | Sections |
|---|---|
| Admin | the ten sections of §2 |
| Internal sales | CRM (pipeline) + Won Leads only |
| Agent | CRM, Won Leads, Payments, Profile (sign-up unchanged) |
| Partner | CRM, Won Leads, Payments, Profile (auto-provisioned) |

## 10. Notifications (new subsystem)

- In-app notifications with a nav bell: to admins — agent meeting requests (§3),
  ready-to-close flags (§3); click → the lead. **[A: polling reuse of ADR-009;
  no push]**. Extendable later (WhatsApp).

## 11. Explicitly unchanged

ByteForce CRM (all of it) · Partners directory · agent sign-up flow · consolidated
/login · brand token system · engine-first transition discipline · server-side
enforcement of every permission.
