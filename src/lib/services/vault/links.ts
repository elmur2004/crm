import { z } from "zod";
import { db } from "@/lib/db";
import type { Prisma } from "../../../../generated/prisma/client";
import { ApiError } from "@/lib/api-error";
import { writeLog, type Actor } from "../activity";
import { invalidateUndo } from "../undo";
import { assertNotArchived, setVaultArchived } from "./archive";
import { optionalText, vaultListParams, zHttpUrl, zVaultCompany } from "./common";
import { VAULT_LINK_CATEGORY_SUGGESTIONS, VAULT_LINK_TYPES, type VaultCompany } from "./constants";
import { vaultCompanyWhere } from "./tenancy";

/* ADR-070 — the vault LINKS section (founder: "so the Vault is not only a place
   for Sheets, Forms and Archive, but also a central place to keep any important
   or repeated resources and links we use constantly, instead of hunting for
   them every time").

   This file is deliberately the Forms service with two fields added, because a
   Links row must behave exactly like a Form row: the same http/https-only URL,
   the same duplicate-URL HANDSHAKE (a clash is a WARNING — 409 naming the
   clashing link — and re-submitting with acknowledgeDuplicate files it anyway,
   because one page legitimately lives under two names), the same
   archive-not-delete removal, the same company scoping, the same newest-first
   ordering.

   The two additions:
   · TYPE is closed at the founder's eight and validated by Zod, like every
     other pseudo-enum in this codebase.
   · CATEGORY is FREE TEXT and is stored as he typed it. See canonicalise()
     below for the one liberty taken with it, and ADR-070 §4 for why it is
     never translated. */

/** Free-text category: trimmed, inner runs of whitespace collapsed (so
    "Content   Calendar" and "Content Calendar" are the same words), capped. */
const zCategory = z
  .string()
  .trim()
  .min(1, "Give the link a category.")
  .max(80, "That category is too long.")
  .transform((v) => v.replace(/\s+/g, " "));

export const vaultLinkSchema = z.object({
  company: zVaultCompany,
  name: z.string().trim().min(1, "Give the link a name.").max(160),
  url: zHttpUrl,
  category: zCategory,
  type: z.enum(VAULT_LINK_TYPES),
  notes: optionalText(5000),
  acknowledgeDuplicate: z.coerce.boolean().optional().default(false),
});
export type VaultLinkInput = z.infer<typeof vaultLinkSchema>;

/** Search + company + archived, plus this section's own two filters (ADR-070
    decision I: fifty links have to stay findable). Bad values FALL BACK rather
    than 400 on a list — the vaultListParams `.catch` convention. */
export const vaultLinkListParams = vaultListParams.extend({
  category: z.string().trim().max(80).optional().catch(undefined),
  type: z.enum(VAULT_LINK_TYPES).optional().catch(undefined),
});
export type VaultLinkListParams = z.infer<typeof vaultLinkListParams>;

/* ------------------------------------------------------- the category list */

const fold = (s: string) => s.trim().replace(/\s+/g, " ").toLocaleLowerCase();

/** Every spelling the founder has actually stored, oldest first — the ORDER is
    the rule: the first spelling of a word wins, so the list cannot churn. */
async function storedSpellings(where: Prisma.VaultLinkWhereInput = {}): Promise<string[]> {
  const rows = await db.vaultLink.findMany({
    where,
    select: { category: true },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => r.category);
}

function dedupe(spellings: string[]): string[] {
  const seen = new Map<string, string>();
  for (const s of spellings) if (!seen.has(fold(s))) seen.set(fold(s), s);
  return [...seen.values()];
}

/** The categories offered in the filter and in the datalist — LIVE rows only,
    so archiving the last link in a category retires that category too. */
export async function listVaultLinkCategories(
  /* ADR-074 — the tenancy wall (services/vault/tenancy.ts). REQUIRED. */
  visible: readonly VaultCompany[],
): Promise<string[]> {
  /* ADR-074 — the category list is BUILT FROM DATA, so an unscoped one hands
     every tenant the other tenants' own words: "Portfolio", a client's name, a
     campaign nobody outside that company has heard of. It appears in the filter
     select and in the datalist behind the Add form, so it is read on every
     visit rather than on a deliberate action. */
  return dedupe(
    await storedSpellings({ archived: false, ...vaultCompanyWhere(visible, undefined) }),
  ).sort((a, b) => a.localeCompare(b));
}

/** The suggestion PAIR a folded key belongs to, if the key is one of OUR eight
    in either language. A pair is ONE category wearing two spellings — see
    canonicalise. */
export function vaultLinkSuggestionPair(key: string) {
  return VAULT_LINK_CATEGORY_SUGGESTIONS.find((m) => fold(m.en) === key || fold(m.ar) === key);
}

/* The one liberty taken with his words (ADR-070 §4). "portfolio" typed the day
   after "Portfolio" was filed is the SAME category to a human and two rows to a
   database, and a filter list that offers both is the hunting he asked us to
   stop. So a new category that differs from an existing one ONLY by case or by
   whitespace adopts the spelling already on file; anything genuinely new is
   stored exactly as typed.

   The fold is done in JS on purpose, not with Prisma's `mode: "insensitive"`:
   that compiles to ILIKE on Postgres, where a `%` or `_` inside a category the
   founder typed would silently become a wildcard. The write path that decides
   what gets STORED cannot live with that (and neither, it turns out, can the
   exact-match read filter — see listVaultLinks).

   ARCHIVED rows count here (no `where`), while listVaultLinkCategories reads
   live rows only: restoring an old link must not resurrect a second spelling of
   a word that is already on the list.

   `exceptId` is the row being EDITED. Without it a row's own spelling is on
   file, so it always folds onto itself and a category's spelling could never be
   corrected — see updateVaultLink for the other half of that. */
async function canonicalise(
  category: string,
  visible: readonly VaultCompany[],
  exceptId?: string,
): Promise<string> {
  /* ADR-074 — SCOPED. Adopting "whichever half is already on file" across
     companies would silently spell one tenant's category the way another tenant
     spells it — and, read the other way, tell that tenant a word exists on rows
     it cannot see. A company's vocabulary is its own. */
  const key = fold(category);
  const stored = await storedSpellings({
    ...vaultCompanyWhere(visible, undefined),
    ...(exceptId ? { id: { not: exceptId } } : {}),
  });
  const onFile = stored.find((s) => fold(s) === key);
  if (onFile) return onFile;
  const pair = vaultLinkSuggestionPair(key);
  if (!pair) return category; // genuinely his own word — stored exactly as typed
  /* One of OUR OWN eight. The English and the Arabic half are ONE category, not
     two: this app's language toggle sits on this very page, and picking
     "بورتفوليو" in Arabic the week after "Portfolio" was filed in English would
     otherwise open a SECOND category holding half his links — our vocabulary
     causing the exact near-duplicate the fold exists to end. So adopt whichever
     half of the pair is already on file; only when neither is does the half he
     actually picked get stored. (His own words are never folded across
     languages — we cannot translate "Investor Deck Q4". These eight are ours.) */
  const twin = stored.find((s) => fold(s) === fold(pair.en) || fold(s) === fold(pair.ar));
  return twin ?? (fold(pair.en) === key ? pair.en : pair.ar);
}

/** Every row — LIVE and ARCHIVED — whose category folds to this key: one
    category, however it happens to be spelled on each row. Folded in JS, never
    with ILIKE, for the reason above. */
/* ADR-074 — SCOPED, and this one is a cross-tenant WRITE rather than a read.
   Re-spelling a category renames every link that folds to the same key, and
   unscoped that `updateMany` rewrote the category column on OTHER COMPANIES'
   rows: one tenant typing "portfolio" as "Portfolio" silently edited another
   tenant's records. The rename follows the word only inside the company that
   owns the link being edited. */
async function foldGroupIds(key: string, visible: readonly VaultCompany[]): Promise<string[]> {
  const rows = await db.vaultLink.findMany({
    where: vaultCompanyWhere(visible, undefined),
    select: { id: true, category: true },
  });
  return rows.filter((r) => fold(r.category) === key).map((r) => r.id);
}

/* --------------------------------------------------------------- the list */

/* Prisma compiles `equals` + `mode: "insensitive"` to `col ILIKE $1` on
   Postgres — verified against a real cluster, not assumed — and ILIKE reads `%`
   and `_` in the VALUE as wildcards. A category the founder typed may contain
   either ("Q4_2026", "100% Organic"), and `?category=%` would return every link
   in the vault while the filter box claimed to hold one category. An
   EXACT-match filter has to match exactly, so the pattern is escaped to
   literals; `\` is Postgres's default LIKE escape character, so escaping it
   first keeps a backslash in his text literal too. */
const likeLiteral = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export async function listVaultLinks(
  params: VaultLinkListParams,
  /* ADR-074 — `visible` is the tenancy wall (services/vault/tenancy.ts).
     REQUIRED, never defaulted: a default would be "the whole platform", which
     is exactly the leak this argument exists to close. */
  visible: readonly VaultCompany[],
) {
  const where: Prisma.VaultLinkWhereInput = {
    archived: params.archived,
    ...vaultCompanyWhere(visible, params.company),
    ...(params.category
      ? { category: { equals: likeLiteral(params.category), mode: "insensitive" } }
      : {}),
    ...(params.type ? { type: params.type } : {}),
    ...(params.q
      ? {
          OR: [
            { name: { contains: params.q, mode: "insensitive" } },
            { category: { contains: params.q, mode: "insensitive" } },
            { notes: { contains: params.q, mode: "insensitive" } },
            { url: { contains: params.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  return db.vaultLink.findMany({ where, orderBy: { createdAt: "desc" } });
}

/* ---------------------------------------------- the duplicate-URL handshake */

/** Live (non-archived) links only, excluding self — the Forms rule verbatim. */
/* ADR-074 — SCOPED, like the Forms twin: the 409 body names the clashing
   record, so unscoped this was an existence oracle with a label on it. */
export async function findDuplicateLinkUrl(
  url: string,
  /* ADR-074 — the tenancy wall (services/vault/tenancy.ts). REQUIRED. */
  visible: readonly VaultCompany[],
  exceptId?: string,
) {
  return db.vaultLink.findFirst({
    where: {
      url,
      archived: false,
      ...vaultCompanyWhere(visible, undefined),
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    select: { id: true, name: true },
  });
}

async function assertUrlAcknowledged(
  input: VaultLinkInput,
  visible: readonly VaultCompany[],
  exceptId?: string,
) {
  if (input.acknowledgeDuplicate) return;
  const clash = await findDuplicateLinkUrl(input.url, visible, exceptId);
  if (clash) {
    /* 409 = the handshake: the client shows the clash and may re-submit with
       acknowledgeDuplicate=true. Warn, never block (the Forms rule). */
    throw new ApiError(409, `This URL is already on "${clash.name}" — save again to keep both.`);
  }
}

/* ------------------------------------------------------------- the writes */

export async function createVaultLink(
  input: VaultLinkInput,
  /* ADR-074 — the tenancy wall (services/vault/tenancy.ts). REQUIRED. */
  visible: readonly VaultCompany[],
  actor: Actor,
) {
  await assertUrlAcknowledged(input, visible);
  const category = await canonicalise(input.category, visible);
  return db.$transaction(async (tx) => {
    const link = await tx.vaultLink.create({
      data: {
        company: input.company,
        name: input.name,
        url: input.url,
        category,
        type: input.type,
        notes: input.notes,
      },
    });
    await writeLog(tx, {
      entityType: "vault_link",
      entityId: link.id,
      actor,
      action: "create",
      trigger: "vault_link_create",
    });
    await invalidateUndo(tx, actor);
    return link;
  });
}

export async function updateVaultLink(
  id: string,
  input: VaultLinkInput,
  /* ADR-074 — the tenancy wall (services/vault/tenancy.ts). REQUIRED. */
  visible: readonly VaultCompany[],
  actor: Actor,
) {
  const before = await db.vaultLink.findUnique({ where: { id } });
  if (!before) throw new ApiError(404, "Link not found");
  assertNotArchived(before);
  await assertUrlAcknowledged(input, visible, id);

  /* A deliberate RE-SPELLING of HIS OWN category. He left the row in the
     category it was already in and changed only how that category is written —
     "investor deck q4" to "Investor Deck Q4". The fold must not answer that by
     handing him back the spelling on file, because on an edit the spelling on
     file is HIS OWN OLD ONE: the modal would close, the PATCH would answer 200,
     and the row would still read the way he just corrected. A category's
     spelling would then be frozen at its first typing for ever, with no state
     in which it could be fixed.

     So on an edit his new spelling wins, and the WHOLE fold group takes it —
     including archived rows, which own their spelling (ADR-070 §4) and would
     otherwise restore later as a second spelling and split the category in two.
     One category may only ever wear one spelling on file; that is the entire
     point of the fold, and a rename is the one honest way to change it.

     OUR OWN EIGHT are excluded on purpose: they are the system's vocabulary,
     not his words, so "portfolio" typed over "Portfolio" is still normalised to
     ours rather than re-spelling the suggestion. */
  const key = fold(input.category);
  const respelling =
    key === fold(before.category) &&
    input.category !== before.category &&
    !vaultLinkSuggestionPair(key);
  const category = respelling ? input.category : await canonicalise(input.category, visible, id);
  const groupIds = respelling ? await foldGroupIds(key, visible) : [];

  return db.$transaction(async (tx) => {
    if (groupIds.length > 0) {
      /* the rest of the category follows the rename. Not an edit of an archived
         record's content (ADR-043): the word is the same word, only its
         spelling on file changed. */
      await tx.vaultLink.updateMany({
        where: { id: { in: groupIds.filter((g) => g !== id) } },
        data: { category },
      });
    }
    const link = await tx.vaultLink.update({
      where: { id },
      data: {
        company: input.company,
        name: input.name,
        url: input.url,
        category,
        type: input.type,
        notes: input.notes,
      },
    });
    await writeLog(tx, {
      entityType: "vault_link",
      entityId: id,
      actor,
      action: "update",
      trigger: "vault_link_update",
    });
    await invalidateUndo(tx, actor);
    return link;
  });
}

/* The founder wrote "Delete". In this module Delete has meant ARCHIVE since
   ADR-053 (nothing here is ever hard-deleted), and Archive is one of the
   sections he himself listed — so a link removes exactly the way a form does.
   Said plainly in the ADR and the CHANGELOG, and flagged in PROGRESS for his
   confirmation, rather than substituted quietly. */
export const archiveVaultLink = (id: string, actor: Actor) =>
  setVaultArchived("vault_link", id, true, actor);
export const restoreVaultLink = (id: string, actor: Actor) =>
  setVaultArchived("vault_link", id, false, actor);
