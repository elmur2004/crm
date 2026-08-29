-- ADR-070 (founder: "I want a section for the links we keep needing to find
-- again — a portfolio, a content calendar, a video we use over and over, a
-- Drive folder or Sheet, a document, an image, a website, a reference") — the
-- Data Vault's LINKS section.
--
-- One new table, built in VaultForm's image: the same company tag, the same
-- http/https-only url (the rule lives in Zod, as it does for every other
-- pseudo-enum and URL in this schema), the same optional notes, the same
-- archived/archivedAt pair — nothing in the vault is ever deleted (ADR-053) —
-- and the same two indexes. It adds exactly the two columns he asked for:
--
--   category  FREE TEXT. His eight suggestions are defaults, not a closed list:
--             he explicitly asked to type a new one when none of them fits, so
--             the column stores whatever he typed. Its own index carries both
--             the category filter and the suggestion list, which reads the
--             DISTINCT live values back out.
--   type      the CLOSED list of his eight kinds (video | image | document |
--             sheet | form | folder | website | other), a plain TEXT column
--             held by Zod exactly like VaultSheet.type and VaultDocument.type —
--             the house pattern, not a Postgres enum.
--
-- NO BACKFILL and no data touched anywhere else: this is a brand-new table with
-- no legacy shape to repair, and no other section changes meaning because it
-- exists. Nothing references it and it references nothing, so the restore order
-- in src/lib/services/backup.ts needs no new FK reasoning either — the entry is
-- added there only so the table is exported at all.
--
-- Every statement is IF NOT EXISTS, so the whole file is re-runnable at boot
-- (scripts/start.mjs retries `prisma migrate deploy`) and a half-applied deploy
-- can be replayed safely — the house rule since ADR-064.

-- CreateTable
CREATE TABLE IF NOT EXISTS "VaultLink" (
    "id" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "notes" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VaultLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "VaultLink_company_archived_idx" ON "VaultLink"("company", "archived");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "VaultLink_url_idx" ON "VaultLink"("url");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "VaultLink_category_idx" ON "VaultLink"("category");
