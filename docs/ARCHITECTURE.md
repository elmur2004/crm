# Architecture — living document

Status: **v2** — v1 (kickoff, 2026-08-08) updated through Phase 5 (2026-08-09);
describes the SHIPPED system. Decisions that shape this file get ADRs
(`docs/DECISIONS.md`); physical-schema decisions are recorded inline in §5.

## 1. System overview

One codebase, one deployment. Three applications separated by route groups and
server-side RBAC, two brands separated by the theming layer (SPEC §1, §3, §4):

| App | Route group | Brand scope | Roles |
|---|---|---|---|
| A — ByteForce CRM | `/byteforce` | `data-brand="byteforce"` | `byteforce_staff` |
| B — B-Systems CRM | `/b-systems` | `data-brand="bsystems"` | `bsystems_staff` |
| C — Partnership Portal | `/portal` (+ `/portal/admin`) | `data-brand="bsystems"` | `portal_rep`, `portal_admin` |

The four pipelines (A CRM, B CRM, B Partners, C Portal) all run on one shared
pipeline-engine module (§4 below; contract in `.claude/skills/pipeline-engine/SKILL.md`).

## 2. Stack (as initialized — ADR-000, ADR-002…005)

| Concern | Choice | Version installed |
|---|---|---|
| Framework | Next.js App Router + TypeScript | next 16.3.0 · react 19.2.8 · typescript 7.0.2 |
| Styling | Tailwind CSS v4 (CSS-first) on CSS-variable brand tokens | tailwindcss 4.3.3 + @tailwindcss/postcss (ADR-004) |
| Database | Prisma ORM; SQLite dev / PostgreSQL prod | prisma 7.9.1, `prisma-client` generator → `generated/prisma` (ADR-002) |
| Auth | NextAuth v5 (Auth.js) credentials, JWT sessions | next-auth 5.0.0-beta.32 (ADR-003) |
| Password hashing | bcryptjs (cost 12) behind `src/lib/auth/hash.ts` | bcryptjs 3.0.3 (ADR-005) |
| Validation | Zod on every mutation, server-side | zod 4.4.3 |
| Kanban DnD | dnd-kit (Portal only, v1 — A-7); stable DndContext id (BUG-002) | @dnd-kit/core 6.3.1 |
| Testing | Vitest (unit/integration, test.db) + Playwright (journeys 1–5 + security + QA sweep, e2e.db) | vitest 4.1.10 · @playwright/test 1.62.1 |
| Uploads | `src/lib/storage/` — local driver to `/uploads`, opaque keys, magic-byte validation, authenticated serving w/ Range | shipped Phase 2 |
| Money / time | EGP integer piasters (ADR-018) via `src/lib/money.ts`; UTC storage, Africa/Cairo display via `src/lib/datetime.ts` | shipped Phase 0 |
| DB driver | Prisma 7 driver adapter | @prisma/adapter-better-sqlite3 (prod: @prisma/adapter-pg, one-file swap in db.ts) |

Scaffolding note: `create-next-app` refuses a non-empty repo, so the app skeleton was
hand-written (package.json, tsconfig, configs, `src/app/`) — see IMPLEMENTATION.md.

## 3. Route map (final — ADR-007 for `/`)

There is **no top-level `src/app/layout.tsx`** — that is load-bearing. The brand tokens
are scoped `:root[data-brand]`, so `data-brand` must sit on `<html>`, and in Next.js
multiple root layouts exist only when every route lives inside a route group that owns
its topmost layout. Physical structure (URL segments unchanged):

```
src/app/(home)/layout.tsx + page.tsx     →  /            neutral <html>, no data-brand
src/app/(byteforce)/layout.tsx           →  <html data-brand="byteforce">
src/app/(byteforce)/byteforce/…          →  /byteforce/*
src/app/(bsystems)/layout.tsx            →  <html data-brand="bsystems">
src/app/(bsystems)/b-systems/…           →  /b-systems/*
src/app/(bsystems)/portal/…              →  /portal/*  (+ /portal/admin)
```

Every root layout imports `src/app/globals.css`. Apps B and C share the `(bsystems)`
root layout (same brand, same fonts). Navigating across groups is a full document
swap — brand bleed is structurally impossible.

```
/                          brand-neutral entry (no tokens, system fonts) — ADR-007
/byteforce                 App A  (own root layout, <html data-brand="byteforce">)
  /                        Home dashboard (§6.5)
  /leads                   rep cards → per-rep leads table → lead detail (§6.1)
  /crm                     5-column board: Following Up | Meeting Setting |
                           Sending Proposals | Won | Lost (§6.3)
  /clients                 client cards (§6.4)
/b-systems                 App B  (own root layout, <html data-brand="bsystems">)
  /, /leads, /crm, /clients        clones of App A on B-Systems data (§7.1)
  /partners-pipeline       6-column board: Lead | Didn't Answer | Following Up |
                           Meeting Setting | Won | Lost (§7.2)
  /partners                directory + partner detail with leads table (§7.3–7.4)
/portal                    App C  (own root layout, <html data-brand="bsystems">)
  /                        landing — signature gradient + mesh hero (§8.1)
  /signup, /login          phone + password (ADR-008); CV upload at signup
  /crm                     rep board (6 columns, dnd-kit, Won drop blocked) (§8.2)
  /won-deals               read-only won deals with milestone locks (§8.3)
  /profile                 rep profile (§8.4)
/portal/admin              admin layer (§8.5)
  /dashboard  /crm         combined | per-rep toggle
  /won-deals  /sales-team  milestone management | team table
/api/byteforce/…           App A data — requireBrandStaff("byteforce")
/api/b-systems/…           App B data (CRM + partners pipeline + partner leads)
/api/portal/…              App C — signup (public), deals + events (owner-or-admin),
                           won-deals (redacted), profile
/api/portal/admin/…        won-deal values, milestone define/check — requirePortalAdmin
/api/files/[id]            authenticated file serving (recordings → bsystems staff;
                           CVs → owning rep or admin), Range support
```

API namespaces are **brand-partitioned**: the brand/app a handler serves is derived
from its route, never from client input, and the service layer filters every
Lead/Client/SalesRep query by that route-derived brand — a `bsystems_staff` session
can never touch a `brand="byteforce"` row by id (SPEC §3 matrix; cross-brand
rejection is integration-tested alongside P-2). EVERY mutation: Zod parse → role
guard → service call. Mutations are route handlers (not server actions) so RBAC is
integration-testable at the API level (SPEC §13 requires P-2 proven at API level).

Multiple root layouts: each top-level route group owns its `<html>` element, which is
where `data-brand` and the brand font loaders live — no client-side theme switching,
brand is a static property of the URL space. Middleware + per-handler guards enforce
role isolation (internal apps invisible to portal roles and vice versa, §3).

## 4. Module map

```
src/
  app/                       route groups per §3 above; pages are thin — data in,
                             components out; no business logic in pages
  components/
    shared/                  brand-agnostic primitives (consume semantic tokens only)
    byteforce/  bsystems/    brand-specific composition when structure differs
  lib/
    pipeline-engine/         THE shared engine (skill: pipeline-engine)
      types.ts               Stage, NextAction, Event, TransitionResult, PipelineConfig
      constants.ts           canonical stage/enum string unions (single source for
                             Prisma strings, Zod schemas, and UI labels)
      configs/               internal-crm.ts · partners.ts · portal.ts — stage sets,
                             terminal stages, allowed next-actions per stage/role,
                             auto-move events (proposal-sent, meeting-attended,
                             new-number-added, admin-won). Config decisions:
                             internal-crm exposes a direct "Won" action from every
                             active stage (T-9 "Any active"; §6.1's printed enum
                             omits it — ADR-011); partners' meeting-attended
                             destinations are Following Up / Won / Lost only (no
                             proposals stage exists in §7.2 — ADR-010, Won routes
                             through the PP-4 gate); portal excludes Won for reps
                             everywhere (P-2)
      transition.ts          pure fn: (card, event, ctx) → {nextStage, requiredGroup,
                             sideEffects[]} | REJECT     ← every SPEC §10 row.
                             Side-effect DESCRIPTORS only — their executors live in
                             the services (createClientFromWon in leads.ts, partner
                             creation in partners.ts, WonDeal in portal-deals.ts),
                             each atomic with the move + ActivityLog
    auth/                    NextAuth v5 config: two Credentials providers
                             (internal: email+password · portal: phone+password,
                             ADR-008), JWT sessions carrying user id + roles[],
                             `guards.ts` (requireRole / requireDealOwner / …) used by
                             EVERY route handler — UI hiding is never the barrier
    services/                use-case layer the API routes call (as shipped):
                             groups.ts (Zod gates for every §6.2/§7.2 field group),
                             leads.ts (applyLeadEvent + persistGroup + A-1 client
                             creation), clients.ts, sales-reps.ts, metrics.ts (§6.5),
                             partners.ts (PP rows incl. PP-2 in updateProspect),
                             portal-deals.ts (applyDealEvent, ADR-026 owner stamp),
                             portal-reps.ts (signup/profile), won-deals.ts (REDACTING
                             rep serializer — locked milestone values never leave the
                             server), milestones.ts (P-7/P-8, sequential order),
                             portal-admin.ts (§8.5 formulas), activity.ts (in-tx log)
                             (dashboard queries: services/metrics.ts for §6.5,
                             services/portal-admin.ts for §8.5 — each formula has a
                             fixture test with known expected numbers)
    storage/                 Storage interface (put/getStream/delete/url) +
                             LocalDriver → /uploads (gitignored); validation:
                             CV pdf/doc/docx ≤ 10 MB · recordings mp3/mp4 ≤ 50 MB
    db.ts                    PrismaClient singleton (imports generated/prisma)
    money.ts                 EGP constant (A-9), integer amounts, formatting
    datetime.ts              store UTC, render Africa/Cairo
  themes/                    ThemeProvider wiring + Tailwind token mapping (§6 below)
prisma/
  schema.prisma              physical schema (§5) · prisma.config.ts at root (v7)
  seed.ts                    demo data both brands + portal (SPEC §13)
e2e/                         Playwright journeys 1–5 (from Phase 1)
branding/                    canonical tokens + founder assets (ADR-006 mapping)
```

Dependency rule: `app/ → lib/services → lib/pipeline-engine | lib/metrics | storage → db`.
The engine never imports Prisma — it is pure and unit-testable; services execute its
returned side-effect descriptors inside one transaction.

## 5. Physical schema (v1 — implemented in Phase 0)

Physical decisions forced by SQLite dev parity (ADR-002):

- **No native enums on SQLite** → all enum-like columns are `String`, constrained by
  Zod at the API boundary and typed by the unions in `pipeline-engine/constants.ts`.
  On the Postgres production switch these may become native enums via migration.
- **No `Decimal` on SQLite** → money columns are `Int` **piasters** (EGP minor
  units, ADR-018), so decimal amounts survive per SPEC §2. Per-value cap
  ~21.4M EGP (Int32) — flagged for founder confirmation; the Postgres switch can
  widen to BIGINT/DECIMAL by migration. `src/lib/money.ts` is the only converter
  and formatter.
- **Polymorphic field groups** (FollowUp/Meeting/Proposal/LostInfo attach to Lead,
  PartnerProspect, or PortalDeal) → one nullable FK per parent type + an app-level
  "exactly one parent" invariant in the service layer (SQLite has no check constraints
  via Prisma). Groups are child records so history accumulates (SPEC §5.2, A-2).
- **Deletes**: operational records are never hard-deleted in v1; `active`/status flags
  instead. Cascades only from parents to their field groups and milestones.

```prisma
model User {
  id           String   @id @default(cuid())
  name         String
  email        String?  @unique            // internal staff login (ADR-008)
  phone        String?  @unique            // portal login, normalized (ADR-008)
  passwordHash String
  active       Boolean  @default(true)     // A-4: admin can deactivate reps
  roles        UserRole[]                  // A-8: one account may hold several roles
  portalRep    PortalRep?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

model UserRole {                            // roles: byteforce_staff | bsystems_staff |
  userId String                             //        portal_admin | portal_rep
  role   String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@id([userId, role])
}

model SalesRep {                            // internal rep cards (§6.1) — not accounts
  id             String @id @default(cuid())
  brand          String                     // byteforce | bsystems
  name           String
  leads          Lead[]
  ownedFollowUps FollowUp[]                 // §6.2 "Owner | rep select"
  @@index([brand])
}

model Lead {                                // Apps A & B (§6.1, §7.4)
  id          String    @id @default(cuid())
  brand       String                        // byteforce | bsystems
  salesRepId  String?                       // A-6: null = "Unassigned (Partner leads)"
  source      String    @default("direct")  // direct | partner (§5.5)
  partnerId   String?                       // attribution — permanent once set
  name        String
  number      String
  email       String?
  type        String                        // cold_call | event_data |
                                            // personal_connection | campaign_lead
  description String?
  stage       String    @default("new")     // new | following_up | meeting_setting |
                                            // sending_proposal | won | lost
  salesRep    SalesRep? @relation(fields: [salesRepId], references: [id])
  partner     Partner?  @relation(fields: [partnerId], references: [id])
  followUps   FollowUp[]
  meetings    Meeting[]
  proposals   Proposal[]
  lostInfo    LostInfo[]
  wonInfo     WonInfo?
  client      Client?
  createdAt   DateTime  @default(now())     // §7.4 "Date created"
  updatedAt   DateTime  @updatedAt
  @@index([brand, stage])
  @@index([brand, salesRepId])
  @@index([partnerId])
}

model FollowUp {                            // §6.2 — history accumulates (§5.2)
  id                String   @id @default(cuid())
  leadId            String?
  partnerProspectId String?
  portalDealId      String?                 // exactly one parent set (service invariant)
  context           String                  // initial | after_proposal | after_meeting
  dueAt             DateTime                // ONE UTC instant (§2: store UTC); the UI's
                                            // split date + time inputs (§6.2) are
                                            // combined/split in Africa/Cairo by
                                            // datetime.ts — never stored separately
  method            String                  // call | message | visit
  ownerSalesRepId   String?                 // "Owner | rep select": internal pipelines
  ownerPortalRepId  String?                 //   → SalesRep; portal deals → PortalRep.
                                            // Service invariant: owner ref type matches
                                            // the parent pipeline; exactly one set
  followingUpWith   String?                 // contact person
  lead              Lead?            @relation(fields: [leadId], references: [id], onDelete: Cascade)
  prospect          PartnerProspect? @relation(fields: [partnerProspectId], references: [id], onDelete: Cascade)
  deal              PortalDeal?      @relation(fields: [portalDealId], references: [id], onDelete: Cascade)
  ownerSalesRep     SalesRep?  @relation(fields: [ownerSalesRepId], references: [id])
  ownerPortalRep    PortalRep? @relation(fields: [ownerPortalRepId], references: [id])
  createdAt         DateTime @default(now())
}

model Meeting {                             // §6.2
  id                 String   @id @default(cuid())
  leadId             String?
  partnerProspectId  String?
  portalDealId       String?
  arranged           Boolean  @default(false)
  datetime           DateTime?              // required once arranged (Zod)
  mode               String?                // online | offline
  withAttendees      String?
  technicalSupport   String?
  outcome            String?                // attended | cancelled | delayed
  outcomeDestination String?                // T-6/T-8 destination once outcome set
  lead               Lead?            @relation(fields: [leadId], references: [id], onDelete: Cascade)
  prospect           PartnerProspect? @relation(fields: [partnerProspectId], references: [id], onDelete: Cascade)
  deal               PortalDeal?      @relation(fields: [portalDealId], references: [id], onDelete: Cascade)
  createdAt          DateTime @default(now())
}

model Proposal {                            // §6.2 — not used by Partners pipeline
  id             String    @id @default(cuid())
  leadId         String?
  portalDealId   String?
  service        String
  estimatedValue Int?                       // piasters (ADR-018)
  sent           Boolean   @default(false)  // checking fires T-5 / P-4
  sentAt         DateTime?
  lead           Lead?       @relation(fields: [leadId], references: [id], onDelete: Cascade)
  deal           PortalDeal? @relation(fields: [portalDealId], references: [id], onDelete: Cascade)
  createdAt      DateTime  @default(now())
}

model LostInfo {                            // §6.2 — reason required (T-4)
  id                String  @id @default(cuid())
  leadId            String?
  partnerProspectId String?
  portalDealId      String?
  reason            String
  lead              Lead?            @relation(fields: [leadId], references: [id], onDelete: Cascade)
  prospect          PartnerProspect? @relation(fields: [partnerProspectId], references: [id], onDelete: Cascade)
  deal              PortalDeal?      @relation(fields: [portalDealId], references: [id], onDelete: Cascade)
  createdAt         DateTime @default(now())
}

model WonInfo {                             // internal Won fields (§6.2, T-9)
  id              String  @id @default(cuid())
  leadId          String  @unique
  estimatedValue  Int                       // prefilled from proposal if present
  technicalOwner  String
  collectedAmount Int
  lead            Lead    @relation(fields: [leadId], references: [id], onDelete: Cascade)
  createdAt       DateTime @default(now())
}

model Client {                              // §6.4 — auto-created on Won (A-1)
  id             String    @id @default(cuid())
  brand          String
  leadId         String?   @unique
  name           String
  number         String
  service        String?
  estimatedValue Int?
  collected      Int?
  toBeCollected  Int?                       // default estimated − collected, editable
  dueDate        DateTime?
  retainer       Boolean   @default(false)
  technicalOwner String?
  lead           Lead?     @relation(fields: [leadId], references: [id])
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  @@index([brand])
}

model PartnerProspect {                     // App B partners pipeline (§7.2)
  id               String   @id @default(cuid())
  name             String
  companyName      String
  role             String?
  email            String?
  number           String
  number2          String?                  // saving non-empty fires PP-2 auto-return
  number3          String?                  //   (max two extra numbers)
  businessActivity String
  description      String?
  stage            String   @default("lead") // lead | didnt_answer | following_up |
                                             // meeting_setting | won | lost
  converted        Boolean  @default(false)  // PP-4 "Converted" badge (A-5)
  followUps        FollowUp[]
  meetings         Meeting[]
  lostInfo         LostInfo[]
  recordings       Attachment[]
  partner          Partner?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  @@index([stage])
}

model Partner {                             // §7.3 directory — created by PP-4 gate
  id               String   @id @default(cuid())
  prospectId       String   @unique
  companyName      String
  keyPersonName    String
  keyPersonRole    String
  address          String
  number           String
  email            String?
  businessActivity String
  importance       String                   // high | medium | low
  dateJoined       DateTime @default(now())
  prospect         PartnerProspect @relation(fields: [prospectId], references: [id])
  leads            Lead[]                   // §7.4 — live link, not a copy
}

model PortalRep {                           // §8.1 — profile over a User account
  id             String  @id @default(cuid())
  userId         String  @unique
  firstName      String
  lastName       String
  address        String
  speciality     String
  cv             Attachment?
  user           User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  deals          PortalDeal[]
  ownedFollowUps FollowUp[]                 // §6.2 owner select on portal deals
}

model PortalDeal {                          // §8.2
  id           String   @id @default(cuid())
  repId        String                       // owner — rep isolation enforced in guards
  name         String
  position     String
  number       String
  email        String?
  companyName  String
  industry     String
  requirements String?
  stage        String   @default("leads")   // leads | following_up | meeting_setting |
                                            // proposal_sending | won | lost
  rep          PortalRep @relation(fields: [repId], references: [id])
  followUps    FollowUp[]
  meetings     Meeting[]
  proposals    Proposal[]
  lostInfo     LostInfo[]
  wonDeal      WonDeal?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  @@index([repId, stage])
}

model WonDeal {                             // §8.3 — auto-created by P-6 (admin only)
  id              String  @id @default(cuid())
  dealId          String  @unique
  estimatedValue  Int?                      // admin-filled (§8.5.3)
  totalCommission Int?
  deal            PortalDeal  @relation(fields: [dealId], references: [id])
  milestones      Milestone[]
  createdAt       DateTime @default(now())
}
// Deal identity fields (name, position, number, email, company, industry) are read
// through the deal relation — one source of truth; the deal is stage-locked in Won.

model Milestone {                           // §8.3/§8.5 — P-7/P-8 locking
  id          String    @id @default(cuid())
  wonDealId   String
  index       Int                           // 1-based; i+1 locked until i completed
  value       Int                           // hidden from rep while locked
  completed   Boolean   @default(false)     // admin-only mutation
  completedAt DateTime?
  wonDeal     WonDeal   @relation(fields: [wonDealId], references: [id], onDelete: Cascade)
  @@unique([wonDealId, index])
}

model Attachment {                          // §9 — CVs + cold-call recordings
  id                String   @id @default(cuid())
  kind              String                  // cv | recording
  portalRepId       String?  @unique
  partnerProspectId String?
  filename          String                  // original, sanitized
  storageKey        String                  // storage-abstraction key, not a path
  mime              String                  // validated: cv pdf/doc/docx ≤10MB;
  size              Int                     //   recording mp3/mp4 ≤50MB (§15)
  rep               PortalRep?       @relation(fields: [portalRepId], references: [id])
  prospect          PartnerProspect? @relation(fields: [partnerProspectId], references: [id], onDelete: Cascade)
  createdAt         DateTime @default(now())
}

model ActivityLog {                         // §5.6 — product feature, not just audit
  id         String   @id @default(cuid())
  entityType String                         // lead | partner_prospect | portal_deal |
  entityId   String                         //   won_deal | client | partner
  actorId    String?                        // User id; null = system/automation
  actorLabel String                         // denormalized display name (survives edits)
  action     String                         // stage_change | auto_transfer | create |
                                            //   milestone_check | milestone_uncheck | …
  fromStage  String?
  toStage    String?
  trigger    String                         // §10 row id (T-5, PP-2, P-6, …) or verb
  createdAt  DateTime @default(now())
  @@index([entityType, entityId, createdAt])
}
```

## 6. Theming architecture (both brands)

1. **Canonical tokens** — `branding/byteforce/tokens.css` and
   `branding/b-systems/tokens.css` are the only files where brand values exist. Both
   are imported once in `src/app/globals.css`; each is scoped to
   `:root[data-brand="…"]` so they coexist inertly.
2. **Brand selection is structural, not stateful** — there is NO top-level
   `src/app/layout.tsx`; every route lives in a route group owning its root layout
   (structure in §3), and the brand groups render
   `<html data-brand="byteforce|bsystems">`. The tokens' `:root[data-brand]` scoping
   only matches when the attribute sits on `<html>` — which this structure guarantees.
   No client-side switching, no flash of wrong brand, brand bleed is structurally
   impossible.
3. **Tailwind mapping (ADR-004)** — `@theme inline` in `globals.css` maps utility
   names to the semantic variables, e.g. `--color-brand-primary: var(--color-primary)`
   → `bg-brand-primary` resolves at runtime against the active `data-brand` scope.
   Components use ONLY brand-prefixed utilities (`bg-brand-primary`, `text-brand-ink`,
   `font-brand-display`, …) or semantic vars directly — `/brand-audit` greps for raw
   hexes/font names outside `branding/` + `src/themes/` (sole exemption: the guard
   test, ADR-015) and must stay clean.
   **Semantic token contract (ADR-019):** both brand files define the *identical*
   semantic variable set (asserted by `src/lib/brand-tokens.test.ts`) so a shared
   component can never hit an unset variable in one brand.
4. **Fonts (ADR-013, mechanism per ADR-027)** — self-hosted `@font-face` under the
   **literal family names the tokens already use**. Shipped mechanism: fontsource
   packages (`@fontsource/raleway` 500–800, `@fontsource/inter` 400/500/700,
   `@fontsource/jetbrains-mono` 500) imported in the `(bsystems)` root layout —
   npm-delivered `@font-face` files, same contract as hand-managed `public/fonts/`.
   `next/font` is deliberately NOT used (it registers generated scoped family names
   the canonical tokens could never reference). Lama Sans still pending (A-13):
   the token fallback stack applies; when files land in
   `branding/byteforce/fonts/`, add plain `@font-face` declarations per the
   byteforce README.
5. **Assets** — founder files per ADR-006: `branding/b-systems/logo-mark.png`
   (gradient S-mark), `branding/byteforce/logo-horizontal.png` (primary lockup).
   `src/themes/assets.ts` exports the per-brand asset map; components never reference
   `branding/` paths directly. Missing slots render a typographic fallback until files
   arrive.
6. **Brand rules enforced by audit** (SPEC §4.4): B-Systems — 60/28/12, pink never a
   surface or body text, Paper `#FAFAFD` never `#FFFFFF`, gradient only in hero
   components (+ optional `.bs-mesh` overlay), no green/teal/orange anywhere.
   ByteForce — five official values only, no emoji in UI copy, RTL-safe (logical
   properties only; A-12).

## 7. Auth & authorization

- NextAuth v5, JWT strategy. Two Credentials providers: `internal` (email + password)
  and `portal` (identifier + password, where the identifier is a normalized phone for
  reps or an email for admins — one form field, resolved by shape; ADR-008 + ADR-016).
  Session token carries `{ userId, roles[] }` (multi-role per A-8/ADR-000).
- **The JWT authenticates; it never authorizes.** `lib/auth/guards.ts` re-reads
  `active` and roles **from the database on every guarded request** (ADR-017) — a
  deactivated rep (A-4 kill-switch) or a revoked role is rejected on the next request,
  not at token expiry. The deactivated-rep-403 case joins the P-2 integration tests.
- Middleware (Next 16: `src/proxy.ts`) does coarse route-group gating only.
  **Every route handler independently re-checks** via guards (shipped names in
  `lib/auth/guards.ts`): `requireRole`/`requireBrandStaff` (route-derived brand
  scope, §3), `requireDealAccess(dealId)` — admits the owning rep **or any
  `portal_admin`** (owner-or-admin: §3's "everything a rep can, plus"; a rep on a
  foreign deal gets 403, tested), and `requirePortalAdmin` for Won-deal management
  + all milestone mutations.
- **portal_admin provisioning (ADR-016):** sign-up creates `portal_rep` accounts only.
  Admin accounts come from the seed script (and ops) in v1 — there is no admin
  sign-up. Dual-role B-Systems accounts (A-8) carry both `bsystems_staff` and
  `portal_admin` and log in with email through either app's form.
- **Role ⇒ identifier invariant** (service-layer rule on every user create/update):
  `*_staff` roles ⇒ email required; `portal_rep` ⇒ phone required; `portal_admin` ⇒
  email or phone required. Rejected otherwise — no un-loginable accounts, no staff
  accounts drifting onto the portal provider. Becomes a DB CHECK constraint on the
  Postgres switch (ADR-002).
- Sign-up (portal only, §8.1): Zod-validated, CV upload validated (type/size) before
  user creation; account active immediately (A-4), `active=false` kill-switch for
  admin (effective per ADR-017 above).
- Passwords: bcryptjs cost 12 (ADR-005). No secrets in repo; `.env` gitignored,
  `.env.example` documents `DATABASE_URL` and `AUTH_SECRET`.

## 8. Cross-cutting conventions

- **Money**: `Int` piasters everywhere (§5 physical note, ADR-018); `money.ts` is the
  only converter/formatter; missing values count as 0 in dashboard sums (SPEC §6.5).
- **Per-card Estimated value (ADR-012)**: a card's Estimated value = the
  `estimatedValue` of its **most recent Proposal by `createdAt`** (0 if none); Won
  cards use `WonInfo.estimatedValue` (internal) / `WonDeal.estimatedValue` (portal).
  This defines every §6.5/§8.5 sum and the §6.2 Won-group prefill; the metrics test
  fixtures include a lead with two proposals to lock the no-double-count rule in.
- **Time**: store UTC `DateTime` only (SPEC §2). Follow-up date + time render/collect
  as split inputs in Africa/Cairo (§6.2 UI shape) but persist as the single `dueAt`
  instant — `datetime.ts` owns the combine/split, DST-safe.
- **Activity log**: written inside the same transaction as its transition/side effect
  (engine returns descriptors; services execute atomically). History panel reads
  `ActivityLog` by `(entityType, entityId)`.
- **Realtime**: milestone unlock propagates by ≤5 s polling on rep Won-Deals views
  (ADR-009).
- **Uploads**: never trust client mime — sniff + extension + size server-side; storage
  keys are opaque (no user-controlled paths); `/uploads` is gitignored and served
  through an authenticated route handler (a rep's CV is not world-readable).

## 9. Open architecture questions

- [x] Portal login identifier — **phone + password**, ADR-008.
- [x] Local database — **SQLite dev / Postgres prod**, ADR-002.
- [x] Milestone realtime — **short-interval polling v1**, ADR-009.
- [ ] Phone-number change for portal reps (A-10 carve-out) — ADR when Phase 3 touches
      profile editing.
- [ ] Postgres migration timing (before or at Phase 5 hardening) — ADR when a deploy
      target exists.
