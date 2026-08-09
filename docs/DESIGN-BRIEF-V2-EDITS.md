# Design Brief — V2 EDITS (give this to Claude Design TOGETHER with DESIGN-BRIEF.md)

These edits SUPERSEDE parts of DESIGN-BRIEF.md. Brand systems (§2 of the base
brief), constraints, and ByteForce screens are unchanged. Everything below is about
the B-Systems side.

## 1. Structure change

- **The Portal no longer exists as a separate app.** Design only TWO applications:
  ByteForce CRM (unchanged) and a role-aware **B-Systems CRM**.
- Four user types see different versions of the B-Systems CRM: **Admin**,
  **Internal sales**, **Agent** (external, self-signed-up), **Partner** (partner
  company with an auto-created account).
- Per-role navigation:
  - Admin: `Home · Leads · CRM · Won Leads · Partnership CRM · Partners · Agents ·
    Registrations · Statements · Users` (ten sections).
  - Internal sales: `CRM · Won Leads`.
  - Agent: `CRM · Won Leads · Payments · Profile`.
  - Partner: `CRM · Won Leads · Payments · Profile`.
- The consolidated `/login` stays; keep the agent sign-up page (unchanged fields).

## 2. Screens to ADD or REDESIGN

1. **Home (admin)** — existing dashboard + new block under "Pipeline by stage":
   number of agents, number of partners, and a chart of THEIR leads per stage
   (brand tints only).
2. **Leads (admin)** — a filter bar top-start: `Internal / Agents / Partners /
   Admins / Any`; a unified leads list under it; actions on every lead: open/edit,
   **copy data**, **delete** (confirm pattern); "Add lead" for the admin bucket.
3. **CRM board (all roles)** — SEVEN columns now: New, Following Up, Meeting
   Setting, Sending Proposal, **Negotiation (NEW)**, Won, Lost. Per-stage colored
   columns (palette tints; spec exact tints per brand). Drag & drop for every
   role; a drop opens the stage's form modal; Won is admin-only (blocked state for
   others). Cards can carry a **"Ready to close"** flag marker — design it (a
   distinct chip/ribbon) plus the always-available "Mark ready to close" action.
4. **Agent stage forms (lighter — design these exact flows)**:
   - Following up: date (no time) + method only.
   - Meeting: "Did you agree with the client on a time?" → Yes: date+time picker,
     Online/Offline, "Need a technical colleague?" · No: "Pick the time that suits
     you", Online/Offline, technical colleague — then a confirmation state: "Your
     request was received — we'll confirm on WhatsApp."
   - Proposal: normal fields; after "Sent" the card auto-returns to Following Up
     with NO extra form (design the auto-move feedback).
   - From Following Up the options are Negotiation / Lost / Mark ready to close.
5. **Admin notifications** — a bell in the header with a dropdown/panel: meeting
   requests (agreed?, date, time, online/offline, technical support, who) and
   ready-to-close alerts; clicking opens the lead.
6. **Confirm win + Milestones v2 (admin modal)** — Total commission as a
   **percentage**; per milestone: name, value, closer's commission, expected start
   date, expected end date. Completing it moves the lead to Won.
7. **Won Leads (admin)** — card grid: lead name, value, closer, milestone
   check-row; card detail view: full client data, milestone table, **proposal PDF
   upload**, **contract PDF upload**, contract date.
8. **Won Leads (closer view: sales/agent/partner)** — card with the client's CRM
   data + milestone progress; per-milestone commission VISIBLE for agents and
   partners, HIDDEN for internal sales (design both variants).
9. **Partnership CRM — numbers flow** — "Didn't answer" move: select which of the
   card's number(s) went unanswered (list starts with the one registered number);
   adding new numbers later is optional and free-count; when added, the card
   returns to Lead and the detail shows **Non-answering number(s)** and
   **Alternative numbers** field groups. Meeting form here: date + time +
   online/offline only.
10. **Agents (admin section)** — toggle **Detailed** (agent cards: profile info,
    join date, table of their leads) / **Pipeline** (per-agent board) — mirror of
    the Partners section pattern.
11. **Registrations (admin)** — registry table of every signed-up/created account
    (type: sales/agent/partner, identifier, date).
12. **Statements (admin)** — two stacked tables: **Waiting to be paid out**
    (milestone, client, closer, commission, Generate button) and **Statement**
    (code ST-####, client, milestone, closer, values). The Generate modal: client
    name, milestone name, milestone value, % of milestone, amount, adjustments,
    expected payment date — all editable + Create.
13. **Payments (agent/partner)** — pending/paid list with expected date; the paid
    state shows the admin-uploaded **payment proof image**.
14. **Users (admin)** — all users with data; deactivate; **"Open account"
    (impersonation)** affordance — design the "you are viewing as X" state and the
    exit from it.

## 3. Removed from the base brief

- The whole standalone Portal chapter (§4.3/§4.4 of the base brief) as separate
  screens — their content is absorbed above (landing/sign-up stay, portal nav
  dies). The B-Systems "Clients" section is dropped (absorbed by Won Leads).
