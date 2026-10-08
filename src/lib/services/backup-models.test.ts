import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/* ============================================================================
   ADR-084 — THE BACKUP'S TABLE LIST IS THE SCHEMA, AND THE SCHEMA IS THE
   ASSERTION.

   This has now gone wrong twice. `undoEntry` fell out of `MODELS` and was found
   by hand during the ADR-053 hardening; ADR-071's `calendarEvent` and
   `meetingAttendee` fell out and survived a whole feature, a phase gate and a
   production deploy — because nothing could notice. A missing entry is the
   WORST failure this product has available: the export silently omits the
   table, and then a restore DELETES those rows anyway when it wipes the parents
   they cascade from. The founder would discover it the one day he needed the
   backup to work.

   A comment saying "keep in sync with prisma/schema.prisma" is not a
   mechanism. So the directory is the assertion, the shape ADR-066/067/068
   already use: read the schema, read the list, and fail on any difference.

   DELIBERATELY NOT a round-trip integration test. One of those would need a
   database and would only catch a missing table whose rows the fixture happened
   to create — which is exactly how both of these got through. This reads the
   two files and compares sets, so it fails the moment a model is born.
   ========================================================================== */

const schemaPath = path.join(process.cwd(), "prisma", "schema.prisma");
const backupPath = path.join(process.cwd(), "src", "lib", "services", "backup.ts");
const resetPath = path.join(process.cwd(), "src", "tests", "db-reset.ts");

/** Prisma's `model Foo {` → the delegate name `db.foo`. Prisma lower-cases the
    FIRST character only (`AcctLoanPayment` → `acctLoanPayment`), which is what
    both lists already spell. */
function delegateName(model: string): string {
  return model.charAt(0).toLowerCase() + model.slice(1);
}

function schemaModels(): string[] {
  const src = readFileSync(schemaPath, "utf8");
  return [...src.matchAll(/^model\s+(\w+)\s*\{/gm)].map((m) => delegateName(m[1]!));
}

function backupModels(): string[] {
  const src = readFileSync(backupPath, "utf8");
  const block = src.split("const MODELS = [")[1]?.split("] as const;")[0];
  if (!block) throw new Error("Could not find the MODELS array in backup.ts");
  /* Only the quoted entries, one per line — a model name mentioned inside one of
     the block's long comments must not count as membership. That is the failure
     this file exists to prevent, so it must not be satisfiable by prose. */
  return [...block.matchAll(/^\s*"(\w+)"/gm)].map((m) => m[1]!);
}

function resetModels(): string[] {
  const src = readFileSync(resetPath, "utf8");
  return [...src.matchAll(/\bdb\.(\w+)\.deleteMany\(/g)].map((m) => m[1]!);
}

/* A table that is deliberately NOT in the backup would go here, WITH its reason.
   It is empty on purpose: every model this product has is operational data the
   founder expects a backup to contain. An entry here is a decision somebody has
   to write down. */
const DELIBERATELY_NOT_BACKED_UP: Array<{ model: string; why: string }> = [];

describe("The backup covers every table in the schema (ADR-084)", () => {
  it("has no model the export would silently omit", () => {
    const excused = new Set(DELIBERATELY_NOT_BACKED_UP.map((e) => e.model));
    const expected = schemaModels().filter((m) => !excused.has(m));
    const missing = expected.filter((m) => !backupModels().includes(m));
    /* The message names the models, because the fix is to add them in FK-safe
       order and the reader needs to know which. */
    expect(
      missing,
      `These models exist in prisma/schema.prisma but are absent from MODELS in ` +
        `src/lib/services/backup.ts. The export omits them AND a restore deletes ` +
        `their rows when it wipes the parents they cascade from. Add each one in ` +
        `FK-safe order (parents first; deletes run reversed).`,
    ).toEqual([]);
  });

  it("names no model the schema does not have", () => {
    const known = new Set(schemaModels());
    expect(backupModels().filter((m) => !known.has(m))).toEqual([]);
  });

  it("lists each model exactly once, so a restore cannot insert a table twice", () => {
    const seen = backupModels();
    const duplicates = seen.filter((m, i) => seen.indexOf(m) !== i);
    expect(duplicates).toEqual([]);
  });

  /* The two lists are maintained side by side and the backup's own comment says
     so ("Keep in sync with ... src/tests/db-reset.ts"). Both of this file's
     founding bugs were present in ONE of them, so the pair is checked too. */
  it("agrees with the integration suite's reset list", () => {
    const reset = new Set(resetModels());
    const backup = backupModels();
    expect(
      backup.filter((m) => !reset.has(m)),
      "in MODELS but never cleared by resetDb — integration tests would leak rows between cases",
    ).toEqual([]);
    const excused = new Set(DELIBERATELY_NOT_BACKED_UP.map((e) => e.model));
    expect(
      [...reset].filter((m) => !backup.includes(m) && !excused.has(m)),
      "cleared by resetDb but missing from MODELS — the shape of both ADR-084 bugs",
    ).toEqual([]);
  });

  /* THE TEST THAT PROVES THIS TEST WORKS. A guard that cannot fail is worse than
     no guard, and this repo has shipped two of those (BUG-015, and a sweep a
     comment could satisfy). So the parser is run against a list with a hole in
     it and must report exactly that hole. */
  it("would actually catch a missing table", () => {
    const full = backupModels();
    const holed = full.filter((m) => m !== "activityLog");
    expect(full.filter((m) => !holed.includes(m))).toEqual(["activityLog"]);
    /* and the quoted-entry rule really is quote-based: a bare word in a comment
       is not membership */
    const fromProse = [...'  /* mentions calendarEvent in prose */\n'.matchAll(/^\s*"(\w+)"/gm)];
    expect(fromProse).toEqual([]);
  });
});
