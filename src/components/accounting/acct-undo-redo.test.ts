import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { acct } from "@/lib/i18n/dict/accounting";
import { formatMsg, type Msg } from "@/lib/i18n/core";
import {
  ACCT_UNDO_GLYPH,
  ACCT_UNDO_REASON_COPY,
  ACCT_UNDO_REFUSALS,
  acctUndoRefusal,
} from "./AcctUndoRedoButtons";
import {
  ACCT_UNDO_REASONS,
  type AcctUndoReason,
} from "@/lib/accounting/undo-reasons";

/* ============================================================================
   THE ACCOUNTING UNDO / REDO PAIR — founder: "add an undo and redo button for
   the accounting system". ONE STEP, PERSONAL.

   WHY THIS IS A SOURCE-AND-STYLESHEET TEST AND NOT A DOM TEST. This repo's
   vitest runs every `.test.ts` under src in the NODE environment (see
   vitest.config.ts) — there is no jsdom, and jsdom would not help anyway:
   jsdom resolves neither var() nor the cascade, and every colour in this
   control comes from a var() that jsdom does not resolve, and the three brand
   scopes live in three separate files that only a cascade can tell apart. So
   the four things that can actually break this control are each checked where
   they really live:

     1. the DICTIONARY — a missing key is a crash (tFor has no fallback, see
        ADR-075 / admin-labels.test.ts), and an English string left in an `ar`
        field is the defect the founder reads first;
     2. the THREE-SCOPE TOKEN LAW — a token the stylesheet spends that one
        brand scope fails to declare paints NOTHING there. That has shipped to
        production twice (ADR-057);
     3. the CONTRAST of the unavailable half — the whole hide-vs-disable
        decision rests on "visibly unavailable but still readable", which is a
        number, computed here against both grounds in all three scopes;
     4. the A11Y and RTL provisions — an accessible name on each button, a
        mounted live region, a real in-flight guard, a 44px touch target, and
        two arrows that mirror under [dir="rtl"].
   ========================================================================== */

const ROOT = path.resolve(__dirname, "../../..");
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");

const SERVER_SRC = read("src/components/accounting/AcctUndoRedo.tsx");
const CLIENT_SRC = read("src/components/accounting/AcctUndoRedoButtons.tsx");
const HEAD_SRC = read("src/components/accounting/AcctHead.tsx");
const DESIGN_CSS = read("src/themes/design-system.css");

const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "");
const CLIENT_CODE = CLIENT_SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const SERVER_CODE = SERVER_SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

/* ------------------------------------------------------------------ 1. copy */

/** every key this control reads out of the accounting dictionary */
const NEW_KEYS = [
  "undoBtn",
  "redoBtn",
  "undoNameWhat",
  "redoNameWhat",
  "undoNothing",
  "redoNothing",
  "undoWorking",
  "redoWorking",
  "undoDone",
  "redoDone",
  "undoRedoGroup",
  "undoRedoScope",
  "undoRefuseNothing",
  "undoRefuseChanged",
  "undoRefuseApplied",
  "undoRefuseDenied",
  "undoRefuseTooOld",
  "undoRefuseChildren",
  "undoRefuseDoublePay",
] as const;

const dict = acct as unknown as Record<string, Msg | undefined>;

describe("the undo/redo copy exists in both languages", () => {
  it.each(NEW_KEYS)("acct.%s is present and filled in EN and AR", (key) => {
    const msg = dict[key];
    expect(msg, `acct.${key} is missing — tFor has no fallback, so the accounting page head throws on render`).toBeDefined();
    expect(msg!.en.trim().length).toBeGreaterThan(0);
    expect(msg!.ar.trim().length).toBeGreaterThan(0);
    expect(msg!.ar).not.toBe(msg!.en);
  });

  /* The founder reads this module in Arabic. A string whose `ar` is really the
     English one is invisible to the type checker and to every other test in the
     suite, so this is checked for EVERY entry in the dictionary — mine and
     anyone else's — rather than only for the keys above.

     The rule is "Arabic script present, and not a copy of the English", not
     "no Latin characters": this dictionary's Arabic legitimately carries file
     formats and vendor names (JSON, Adobe) that are not translated, and a
     Latin-character ban would fail on correct strings and get deleted. */
  it("EVERY accounting string has real Arabic in its ar field", () => {
    const offenders: string[] = [];
    for (const [key, msg] of Object.entries(dict)) {
      if (!msg) continue;
      const bare = msg.ar.replace(/\{\w+\}/g, "").trim();
      if (!/[؀-ۿ]/.test(bare)) {
        offenders.push(`${key} has no Arabic at all → ${JSON.stringify(msg.ar)}`);
      } else if (msg.ar === msg.en && /[A-Za-z]{3,}/.test(msg.en)) {
        offenders.push(`${key} is the English string verbatim → ${JSON.stringify(msg.ar)}`);
      }
    }
    expect(offenders, `untranslated Arabic:\n${offenders.join("\n")}`).toEqual([]);
  });

  /* The e2e suite asserts the module's English literals by hand. This feature
     ADDED keys and must not have edited one, so a sample spanning the shell,
     the tabs, the forms and the generic error is pinned byte-for-byte. */
  it("the existing English literals are unchanged", () => {
    expect(acct.navItem.en).toBe("Accounting");
    expect(acct.metaTitle.en).toBe("Accounting");
    expect(acct.company.en).toBe("Company");
    expect(acct.month.en).toBe("Month");
    expect(acct.tabDashboard.en).toBe("Dashboard");
    expect(acct.tabIncome.en).toBe("Income");
    expect(acct.tabImport.en).toBe("Import / Export");
    expect(acct.dashEyebrow.en).toBe("Overview");
    expect(acct.save.en).toBe("Save");
    expect(acct.cancel.en).toBe("Cancel");
    expect(acct.delete.en).toBe("Delete");
    /* THE ONE DOCUMENTED CHANGE (ADR-086): the old sentence promised money
       records could never be undone, which this feature made false on every
       accounting delete. Pinned to its replacement so the next edit is as
       deliberate as this one was. */
    expect(acct.deleteConfirm.en).toBe(
      "Delete this record? You can undo it for a few minutes.",
    );
    expect(acct.somethingWentWrong.en).toBe("Something went wrong");
  });

  /* ADR-045's rule: the BUTTON NAMES WHAT IT WILL DO. The accessible name and
     the confirmation are templates, so the description the server stored has to
     survive into both languages intact — and never half-translate. */
  it("the naming templates carry {what} in BOTH languages", () => {
    for (const key of ["undoNameWhat", "redoNameWhat", "undoDone", "redoDone"] as const) {
      expect(acct[key].en, key).toContain("{what}");
      expect(acct[key].ar, key).toContain("{what}");
    }
    const filled = formatMsg(acct.undoNameWhat, { what: "Added an income entry" });
    expect(filled.en).toBe("Undo: Added an income entry");
    expect(filled.ar).toContain("Added an income entry");
    expect(filled.ar).not.toContain("{what}");
    expect(filled.ar).toContain("تراجع");
  });

  /* The nothing-to-do name IS the explanation of why the half cannot be
     pressed — it is the whole accessible name of the disabled button, so it has
     to say more than "Undo". */
  it("the unavailable half explains itself rather than repeating the verb", () => {
    expect(acct.undoNothing.en).not.toBe(acct.undoBtn.en);
    expect(acct.redoNothing.en).not.toBe(acct.redoBtn.en);
    expect(acct.undoNothing.en.toLowerCase()).toContain("nothing");
    expect(acct.redoNothing.en.toLowerCase()).toContain("nothing");
  });
});

/* ------------------------------------------- 2. refusal code → honest copy */

const UNDO_ROUTE_SRC = read("src/app/api/accounting/undo/route.ts");
const REDO_ROUTE_SRC = read("src/app/api/accounting/redo/route.ts");
const ENGINE_SRC = read("src/lib/services/accounting-undo.ts");

/** The engine source with its block comments removed — a `refuse(…)` written
    inside a comment is prose, not a throw site. */
const ENGINE_CODE_ONLY = stripComments(ENGINE_SRC);

/** every reason code the engine really throws: the last bare-word string
    literal inside each `refuse(status, message, reason)` call. A message
    argument is a sentence with spaces in it, so a bare-word regex cannot
    match one. */
const ENGINE_CODES = ENGINE_CODE_ONLY.split("refuse(")
  .slice(1)
  .map((chunk) => {
    const args = chunk.split(");")[0] ?? "";
    const words = args.match(/"\w+"/g) ?? [];
    return words.length ? words[words.length - 1]!.slice(1, -1) : undefined;
  })
  .filter((c): c is string => Boolean(c));

describe("every refusal maps to its own honest sentence, chosen BY CODE", () => {
  /* The defect this replaced: the copy was chosen by pattern-matching the
     server's English message, so a reword on the server silently changed which
     sentence a bookkeeper read — and the double-payroll guard, whose message
     contains the word "already" while having applied NOTHING, was one careless
     regex away from being explained as "that step was already applied". The
     reason now travels as data and the text match is only a fallback. */

  it("the closed set is mapped exhaustively, with no gaps", () => {
    for (const reason of ACCT_UNDO_REASONS) {
      const msg = ACCT_UNDO_REASON_COPY[reason];
      expect(msg, `no sentence for the code "${reason}"`).toBeDefined();
      expect(msg.en.trim().length).toBeGreaterThan(0);
      expect(msg.ar.trim().length).toBeGreaterThan(0);
      expect(msg, `"${reason}" degrades to the generic`).not.toBe(acct.somethingWentWrong);
    }
    /* and nothing extra: the map is exactly the set */
    expect(Object.keys(ACCT_UNDO_REASON_COPY).sort()).toEqual([...ACCT_UNDO_REASONS].sort());
  });

  /** status, code and the engine prose that really travels with it */
  const REFUSALS: Array<{
    status: number;
    reason: AcctUndoReason;
    message: string;
    expect: Msg;
    why: string;
  }> = [
    {
      status: 409,
      reason: "changed_since",
      message: "This changed since — undo is no longer safe",
      expect: acct.undoRefuseChanged,
      why: "fingerprint mismatch on undo",
    },
    {
      status: 409,
      reason: "changed_since",
      message: "This changed since — redo is no longer safe",
      expect: acct.undoRefuseChanged,
      why: "fingerprint mismatch on redo",
    },
    {
      status: 409,
      reason: "already_applied",
      message: "That action was already undone",
      expect: acct.undoRefuseApplied,
      why: "the second click of a double-press",
    },
    {
      status: 409,
      reason: "already_applied",
      message: "That action was already redone",
      expect: acct.undoRefuseApplied,
      why: "the second click of a double-press",
    },
    {
      status: 409,
      reason: "children_added",
      message: "Records were added to this since — undo would delete them, so it was refused",
      expect: acct.undoRefuseChildren,
      why: "child rows would be destroyed",
    },
    {
      status: 409,
      reason: "double_payroll",
      message:
        "That person already has another payroll row for this month — undo would pay them twice",
      expect: acct.undoRefuseDoublePay,
      why: "the double-payroll guard — NOT 'already applied'",
    },
    {
      status: 400,
      reason: "nothing",
      message: "Nothing to undo",
      expect: acct.undoRefuseNothing,
      why: "the stack is empty",
    },
    {
      status: 400,
      reason: "nothing",
      message: "Nothing to redo",
      expect: acct.undoRefuseNothing,
      why: "the stack is empty",
    },
    {
      status: 400,
      reason: "too_old",
      message: "That action is too old to undo",
      expect: acct.undoRefuseTooOld,
      why: "the undo window expired",
    },
    {
      status: 400,
      reason: "too_old",
      message: "That action is too old to redo",
      expect: acct.undoRefuseTooOld,
      why: "the undo window expired",
    },
    {
      status: 403,
      reason: "no_actor",
      message: "Nothing to undo",
      expect: acct.undoRefuseDenied,
      why: "no ownership — there is nothing OF YOURS to apply",
    },
    {
      status: 403,
      reason: "not_permitted",
      message: "Your account does not have access to Accounting",
      expect: acct.undoRefuseDenied,
      why: "the module wall (ADR-066's per-admin flag)",
    },
    {
      status: 400,
      reason: "no_company",
      message: "Unknown company",
      expect: acct.undoRefuseDenied,
      why: "a company that is not a company at all",
    },
    {
      status: 404,
      reason: "no_company",
      message: "Not found",
      expect: acct.undoRefuseDenied,
      why: "ADR-074's company wall — a company this account does not hold",
    },
  ];

  it.each(REFUSALS)("$status / $why is read from the code $reason", ({ status, reason, message, expect: wanted }) => {
    const got = acctUndoRefusal(status, message, reason);
    expect(got).toBe(wanted);
    expect(got).not.toBe(acct.somethingWentWrong);
  });

  it("the double-payroll code is a DIFFERENT sentence from already-applied", () => {
    expect(acctUndoRefusal(409, "", "double_payroll")).not.toBe(
      acctUndoRefusal(409, "", "already_applied"),
    );
    expect(acctUndoRefusal(409, "", "double_payroll").en.toLowerCase()).toContain("twice");
  });

  it("changed-since says the row changed and nothing was touched", () => {
    const msg = acctUndoRefusal(409, "", "changed_since");
    expect(msg.en.toLowerCase()).toContain("changed");
    expect(msg.en.toLowerCase()).toContain("nothing was touched");
  });

  /* THE POINT OF THE WHOLE FIX: the code wins over the prose. A body whose
     message reads like one refusal and whose code names another must be read
     by the CODE — that is what makes a reword on the server a copy change
     rather than a behaviour change. */
  it("the CODE decides, even when the English message reads like another refusal", () => {
    expect(acctUndoRefusal(409, "That action was already undone", "double_payroll")).toBe(
      acct.undoRefuseDoublePay,
    );
    expect(
      acctUndoRefusal(409, "That person already has another payroll row", "already_applied"),
    ).toBe(acct.undoRefuseApplied);
    /* and a reworded message with a correct code still lands correctly — the
       brittleness this replaced, proven gone */
    expect(acctUndoRefusal(409, "Totally new wording from a later release", "children_added")).toBe(
      acct.undoRefuseChildren,
    );
  });

  it("every refusal sentence is its own string, in both languages", () => {
    const all = [
      acct.undoRefuseNothing,
      acct.undoRefuseChanged,
      acct.undoRefuseApplied,
      acct.undoRefuseDenied,
      acct.undoRefuseTooOld,
      acct.undoRefuseChildren,
      acct.undoRefuseDoublePay,
    ];
    expect(new Set(all.map((m) => m.en)).size).toBe(all.length);
    expect(new Set(all.map((m) => m.ar)).size).toBe(all.length);
  });

  /* ---- THE PRODUCER SIDE -------------------------------------------------
     The map above is only as good as what the server sends, so the engine and
     the two routes are read back here. A refusal thrown without a code, or a
     code the client has never heard of, fails THIS test by name. */

  it("the engine throws only codes the client can read", () => {
    expect(ENGINE_CODES.length).toBeGreaterThan(0);
    const unknown = ENGINE_CODES.filter((c) => !(ACCT_UNDO_REASONS as readonly string[]).includes(c));
    expect(unknown, `the engine throws codes nothing maps:\n${unknown.join("\n")}`).toEqual([]);
  });

  it("the engine has no UNCODED refusal left in it", () => {
    /* a bare `new ApiError(...)` in the engine is a refusal with no reason
       attached, which the client could only explain by guessing again */
    const bare = ENGINE_CODE_ONLY.match(/new ApiError\(/g) ?? [];
    expect(bare.length, "a refusal in accounting-undo.ts is not going through refuse()").toBe(0);
  });

  it("the engine covers every refusal the client has copy for", () => {
    /* `not_permitted` and `no_company` come from the two guards, not the
       engine; everything else must be thrown somewhere in the engine */
    const fromGuards: AcctUndoReason[] = ["not_permitted", "no_company"];
    const missing = ACCT_UNDO_REASONS.filter(
      (r) => !fromGuards.includes(r) && !ENGINE_CODES.includes(r),
    );
    expect(missing, `codes nothing can produce:\n${missing.join("\n")}`).toEqual([]);
  });

  it("both routes put the code in the body and label their two guards", () => {
    for (const [name, src] of [
      ["undo", UNDO_ROUTE_SRC],
      ["redo", REDO_ROUTE_SRC],
    ] as const) {
      const code = src.replace(/\/\*[\s\S]*?\*\//g, "");
      /* the body is shaped in the route, because handleRoute is shared by some
         forty endpoints and only ever sends { error } */
      expect(code, name).toContain("acctRefusalResponse(err)");
      /* …and anything that is not a coded refusal still reaches the shared
         handler untouched */
      expect(code, name).toContain("throw err;");
      expect(code, name).toContain('attempt("not_permitted", [403]');
      expect(code, name).toContain('attempt("no_company", [400, 404]');
    }
  });

  it("the shared route handler and the shared ApiError were NOT widened", () => {
    /* ~40 CRM endpoints depend on both; the extra field is added inside the two
       accounting routes instead */
    expect(read("src/lib/auth/guards.ts")).toContain(
      "return Response.json({ error: err.message }, { status: err.status });",
    );
    expect(read("src/lib/api-error.ts")).not.toContain("reason");
  });
});

describe("the text fallback still reads correctly when the body carries no code", () => {
  /* An older cached bundle against a newer server, or a proxy that strips an
     unknown JSON field, and the refusal must STILL be explained — so the
     status-and-prose mapping this control shipped with is kept, and pinned
     here against the engine's literal messages exactly as it was before. */

  const FALLBACK: Array<{ status: number; message: string; expect: Msg; why: string }> = [
    {
      status: 409,
      message: "This changed since — undo is no longer safe",
      expect: acct.undoRefuseChanged,
      why: "fingerprint mismatch on undo",
    },
    {
      status: 409,
      message: "This changed since — redo is no longer safe",
      expect: acct.undoRefuseChanged,
      why: "fingerprint mismatch on redo",
    },
    {
      status: 409,
      message: "That action was already undone",
      expect: acct.undoRefuseApplied,
      why: "the second click of a double-press",
    },
    {
      status: 409,
      message: "That action was already redone",
      expect: acct.undoRefuseApplied,
      why: "the second click of a double-press",
    },
    {
      status: 409,
      message: "Records were added to this since — undo would delete them, so it was refused",
      expect: acct.undoRefuseChildren,
      why: "child rows would be destroyed",
    },
    {
      status: 409,
      message:
        "That person already has another payroll row for this month — undo would pay them twice",
      expect: acct.undoRefuseDoublePay,
      why: "the double-payroll guard — NOT 'already applied'",
    },
    {
      status: 400,
      message: "Nothing to undo",
      expect: acct.undoRefuseNothing,
      why: "the stack is empty",
    },
    {
      status: 400,
      message: "Nothing to redo",
      expect: acct.undoRefuseNothing,
      why: "the stack is empty",
    },
    {
      status: 400,
      message: "That action is too old to undo",
      expect: acct.undoRefuseTooOld,
      why: "the undo window expired",
    },
    {
      status: 400,
      message: "That action is too old to redo",
      expect: acct.undoRefuseTooOld,
      why: "the undo window expired",
    },
    {
      status: 403,
      message: "Nothing to undo",
      expect: acct.undoRefuseDenied,
      why: "no ownership — a 403 is a permission answer whatever it says",
    },
  ];

  it.each(FALLBACK)("$status / $why still maps with no code at all", ({ status, message, expect: wanted }) => {
    /* every shape a stripped body can arrive in */
    for (const absent of [undefined, null, "", "not_a_code_we_know", 7]) {
      const got = acctUndoRefusal(status, message, absent);
      expect(got, `reason=${JSON.stringify(absent)}`).toBe(wanted);
      expect(got).not.toBe(acct.somethingWentWrong);
    }
  });

  it("every message the fallback matches is still the engine's own wording", () => {
    const missing = [...new Set(FALLBACK.map((m) => m.message))].filter(
      (m) => !ENGINE_SRC.includes(m),
    );
    expect(
      missing,
      "the engine reworded these, so the FALLBACK mapping is now guessing:\n" + missing.join("\n"),
    ).toEqual([]);
  });

  it("no two fallback rows claim the same engine message", () => {
    for (const { status, message } of FALLBACK) {
      const hits = ACCT_UNDO_REFUSALS.filter((r) => r.status === status && r.match.test(message));
      expect(hits.length, `${status} "${message}" matched ${hits.length} rows`).toBeLessThanOrEqual(
        1,
      );
    }
  });

  /* An undocumented status with no code must degrade to the module's OWN
     generic, never to the server's English `error` string: this module is read
     in Arabic. */
  it("anything undocumented falls back to the module's generic, in both languages", () => {
    for (const status of [500, 502, 418]) {
      expect(acctUndoRefusal(status, "Internal Server Error")).toBe(acct.somethingWentWrong);
      expect(acctUndoRefusal(status, "Internal Server Error", "nope")).toBe(
        acct.somethingWentWrong,
      );
    }
  });

  it("no refusal path can print the server's English message onto the screen", () => {
    /* the body's `error` is read ONCE, and only as the fallback argument */
    const reads = CLIENT_CODE.match(/data\?\.error/g) ?? [];
    expect(reads.length).toBe(1);
    expect(CLIENT_CODE).toContain(
      "acctUndoRefusal(res.status, data?.error ?? null, data?.reason)",
    );
  });
});

/* ----------------------------------------------------- 3. the mirrored pair */

describe("the two glyphs are real mirrors, and mirror again in Arabic", () => {
  it("undo and redo are different drawings", () => {
    expect(ACCT_UNDO_GLYPH.undo).not.toEqual(ACCT_UNDO_GLYPH.redo);
  });

  /* Each path's starting x is mirrored about the 16-wide viewBox's centre, so
     the two arrows really are each other's reflection rather than two
     hand-drawn approximations that happen to look alike. */
  it("each redo subpath starts at 16 minus the undo subpath's x", () => {
    const startX = (d: string) => Number(/^M\s*(-?[\d.]+)/.exec(d)![1]);
    ACCT_UNDO_GLYPH.undo.forEach((d, i) => {
      expect(startX(d) + startX(ACCT_UNDO_GLYPH.redo[i]!)).toBeCloseTo(16, 6);
    });
  });

  it("the arc's sweep flag flips and the horizontal delta negates", () => {
    const [undoArc, undoTail] = ACCT_UNDO_GLYPH.undo;
    const [redoArc, redoTail] = ACCT_UNDO_GLYPH.redo;
    // "a rx ry rot large sweep dx dy" — the sweep flag is what reverses a curve
    const sweep = (d: string) => /a[\d.\s]+0\s+1\s+([01])/.exec(d)![1];
    expect(sweep(undoArc)).not.toBe(sweep(redoArc));
    // the arrow head: h4 becomes h-4
    expect(/h(-?[\d.]+)/.exec(undoTail)![1]).toBe("4");
    expect(/h(-?[\d.]+)/.exec(redoTail)![1]).toBe("-4");
  });

  /* Direction is the ONLY thing distinguishing the two glyphs, so in Arabic —
     where "back" is the other way — leaving them unmirrored would point undo
     forwards. That is a defect, not a nicety. */
  it("design-system.css mirrors the icon under [dir=\"rtl\"]", () => {
    expect(stripComments(DESIGN_CSS)).toMatch(
      /\[dir="rtl"\]\s*\.acct-ur-icon\s*\{[^}]*transform:\s*scaleX\(-1\)/,
    );
  });
});

/* ------------------------------------------------------------- 4. the markup */

describe("the control's accessibility provisions are in the markup", () => {
  it("both halves get a real accessible name, never a bare arrow", () => {
    // the name is the verb plus the description, or the reason it is quiet
    expect(CLIENT_CODE).toMatch(/aria-label=\{name\}/);
    expect(CLIENT_CODE).toMatch(/const name =[\s\S]*?copy\.nothing[\s\S]*?copy\.nameWhat/);
    // every drawn glyph is hidden from the accessible tree
    const svgs = CLIENT_CODE.match(/<svg[\s\S]*?>/g) ?? [];
    expect(svgs.length).toBeGreaterThan(0);
    for (const svg of svgs) expect(svg).toContain("aria-hidden");
  });

  it("the pair is a labelled group", () => {
    expect(CLIENT_CODE).toContain('role="group"');
    expect(CLIENT_CODE).toContain("aria-label={t(acct.undoRedoGroup)}");
  });

  /* A live region that mounts together with its first message is announced
     unreliably, so the wrapper is unconditional and only its contents change. */
  it("the live region is mounted unconditionally", () => {
    expect(CLIENT_CODE).toMatch(
      /<div className="toast-wrap" role="status" aria-live="polite" aria-atomic="true">/,
    );
    const at = CLIENT_CODE.indexOf('role="status"');
    const conditional = CLIENT_CODE.indexOf("{result ? (");
    expect(at).toBeGreaterThan(-1);
    expect(conditional).toBeGreaterThan(at); // the message is inside, not around
  });

  it("the unavailable half uses aria-disabled and stays focusable", () => {
    expect(CLIENT_CODE).toContain("aria-disabled={what === null ? true : undefined}");
    // the `disabled` attribute is spent on the in-flight state and nothing
    // else — `aria-disabled` (which keeps the tab order) carries the rest
    expect(CLIENT_CODE).toContain("disabled={frozen}");
    expect(CLIENT_CODE).not.toMatch(/(?<!aria-)disabled=\{what === null/);
    expect(CLIENT_CODE).not.toMatch(/(?<!aria-)disabled=\{!available/);
  });

  it("a double-click cannot fire twice, even inside one frame", () => {
    expect(CLIENT_CODE).toContain("if (running.current) return;");
    expect(CLIENT_CODE).toContain("running.current = true;");
    // and every exit from `run` releases the guard
    expect((CLIENT_CODE.match(/running\.current = false;/g) ?? []).length).toBe(2);
  });

  it("success and refusal both refresh, so the pair flips from the server", () => {
    expect((CLIENT_CODE.match(/router\.refresh\(\)/g) ?? []).length).toBe(2);
    // ...and a dropped network does NOT refresh over the figures on screen
    expect(CLIENT_CODE).toMatch(/catch \{[\s\S]*?setResult\([\s\S]*?\}\s*\n\s*const data/);
  });

  it("the server half renders nothing when neither side has anything", () => {
    expect(SERVER_CODE).toContain("if (!undo && !redo) return null;");
    expect(SERVER_CODE).toContain("pendingAcctUndo(user.id, company)");
    expect(SERVER_CODE).toContain("pendingAcctRedo(user.id, company)");
  });

  it("the control is mounted in the chrome every accounting page renders", () => {
    expect(HEAD_SRC).toContain('import { AcctUndoRedo } from "./AcctUndoRedo";');
    expect(HEAD_SRC).toContain("<AcctUndoRedo company={view.company} />");
  });

  /* The CRM's ADR-045 pill is a different stack: different endpoint, different
     table, different class names, pinned to the viewport. The one thing that
     could still confuse the two is this control reaching for /api/undo. */
  it("it posts to the accounting endpoints and never to the CRM's", () => {
    expect(CLIENT_CODE).toContain("`/api/accounting/${direction}`");
    expect(CLIENT_CODE).not.toContain('"/api/undo"');
    expect(CLIENT_CODE).not.toContain("undo-fab");
    expect(CLIENT_CODE).not.toContain("undo-btn");
  });
});

/* ------------------------------------------------- 5. brand: tokens, 3 scopes */

/** the declarations directly inside one top-level rule (brand-tokens.test.ts's
    scopeBody, for the same reason: a token declared in some component rule
    further down a brand file is invisible to the [data-brand] scope). */
function scopeBody(css: string, selector: string): string {
  const s = stripComments(css);
  const at = s.indexOf(selector);
  if (at < 0) return "";
  const open = s.indexOf("{", at);
  if (open < 0) return "";
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    if (s[i] === "{") depth++;
    else if (s[i] === "}") {
      depth--;
      if (depth === 0) return s.slice(open + 1, i);
    }
  }
  return "";
}

const SCOPES: Array<{ name: string; file: string; selector: string }> = [
  { name: "byteforce", file: "branding/byteforce/tokens.css", selector: '[data-brand="byteforce"]' },
  { name: "b-systems", file: "branding/b-systems/tokens.css", selector: '[data-brand="bsystems"]' },
  { name: "neutral", file: "src/themes/neutral.css", selector: '[data-brand="neutral"]' },
];

/** every `--name: value` in a file, for resolving var() indirection (the brand
    files alias semantic tokens onto a raw palette: --color-surface →
    var(--bf-offwhite) → #F4F1EA) */
function varMap(css: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const m of stripComments(css).matchAll(/(--[\w-]+)\s*:\s*([^;{}]+);/g)) {
    map.set(m[1]!, m[2]!.trim());
  }
  return map;
}

function resolveVar(map: Map<string, string>, name: string, depth = 0): string | null {
  if (depth > 8) return null;
  const raw = map.get(name);
  if (!raw) return null;
  const inner = /^var\(\s*(--[\w-]+)\s*\)$/.exec(raw);
  return inner ? resolveVar(map, inner[1]!, depth + 1) : raw;
}

/** the rules this feature added — anywhere in the sheet, @media included */
function acctUrRules(css: string): Array<{ selector: string; body: string }> {
  const out: Array<{ selector: string; body: string }> = [];
  for (const m of stripComments(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = m[1]!.trim().replace(/\s+/g, " ");
    if (selector.includes("acct-ur")) out.push({ selector, body: m[2]! });
  }
  return out;
}

describe("the pair is token-driven and works under BOTH brands (ADR-054/057)", () => {
  const rules = acctUrRules(DESIGN_CSS);

  it("finds the rules it is about to check (a silent zero would prove nothing)", () => {
    expect(rules.length).toBeGreaterThanOrEqual(6);
  });

  it("neither component source carries a hardcoded colour or a font", () => {
    for (const [name, src] of [
      ["AcctUndoRedo.tsx", SERVER_SRC],
      ["AcctUndoRedoButtons.tsx", CLIENT_SRC],
    ] as const) {
      expect(src, name).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(src, name).not.toMatch(/\b(rgba?|hsla?|color-mix)\s*\(/);
      expect(src, name).not.toMatch(/font-family/i);
      /* and no inline style object either — that is how a hardcoded value gets
         past a stylesheet audit */
      expect(src, name).not.toMatch(/style=\{\{/);
    }
  });

  it("the stylesheet block spends tokens only — no literal colour, no font", () => {
    for (const { selector, body } of rules) {
      expect(body, selector).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(body, selector).not.toMatch(/\b(rgba?|hsla?)\s*\(/);
      expect(body, selector).not.toMatch(/font-family/i);
    }
  });

  /* THE LAW THAT HAS BROKEN PRODUCTION TWICE: a token spent through a bare
     var() that one scope does not declare paints nothing in that scope. The
     accounting module re-skins per company, so this control renders under
     byteforce AND bsystems; neutral is checked too because design-system.css is
     one sheet shared with the (home) and (vault) shells. */
  it("every token the block spends is declared in ALL THREE brand scopes", () => {
    const spent = new Set<string>();
    for (const { body } of rules) {
      for (const m of body.matchAll(/var\(\s*(--[\w-]+)/g)) spent.add(m[1]!);
    }
    expect(spent.size).toBeGreaterThan(0);
    for (const { name, file, selector } of SCOPES) {
      const declared = scopeBody(read(file), selector);
      for (const token of spent) {
        expect(
          new RegExp(`${token}\\s*:`).test(declared),
          `${token} is NOT declared inside ${selector} (${name}) — it would paint nothing there`,
        ).toBe(true);
      }
    }
  });
});

/* --------------------------------------------- 6. the unavailable half's ink */

function srgbToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function luminance(hex: string): number {
  const h = hex.trim().replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  return (
    0.2126 * srgbToLinear(r!) + 0.7152 * srgbToLinear(g!) + 0.0722 * srgbToLinear(b!)
  );
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

describe("the nothing-to-do half is recessed but still readable (WCAG AA)", () => {
  /* The whole hide-vs-disable decision rests on this number. `opacity: .6`,
     which the CRM pill uses for its in-flight state, would have put the
     unavailable half at roughly 3:1 — which is why this block paints with
     --color-muted instead, and why that is checked rather than asserted in a
     comment. The ink lands on --color-surface (the recessed, unavailable half)
     and the description sits on --color-surface-card (the live half), so both
     grounds are measured, in all three scopes. */
  it.each(SCOPES)("$name: muted ink clears 4.5:1 on both grounds", ({ file, selector }) => {
    /* Read from the LIGHT block only. Each token file now also carries dark
       blocks further down, and varMap keeps the LAST declaration of a name —
       so a file-wide map silently measured the DARK values and stopped
       checking light at all. The light block holds the raw palette its
       aliases resolve through (--bf-offwhite, --bs-paper), so it is
       self-contained. */
    const light = scopeBody(read(file), selector);
    expect(light, `no light ${selector} block found in ${file}`).toContain("--color-muted");
    const map = varMap(light);
    const ink = resolveVar(map, "--color-muted");
    expect(ink, "--color-muted does not resolve to a value").toMatch(/^#[0-9a-fA-F]{3,8}$/);
    for (const ground of ["--color-surface", "--color-surface-card"]) {
      const bg = resolveVar(map, ground);
      expect(bg, `${ground} does not resolve to a value`).toMatch(/^#[0-9a-fA-F]{3,8}$/);
      expect(contrast(ink!, bg!), `${ink} on ${bg} (${ground})`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("the unavailable state is NOT painted with an opacity multiplier", () => {
    const quiet = acctUrRules(DESIGN_CSS).filter((r) =>
      r.selector.includes('[aria-disabled="true"]'),
    );
    expect(quiet.length).toBeGreaterThan(0);
    for (const { selector, body } of quiet) {
      expect(body, selector).not.toMatch(/\bopacity\s*:/);
    }
    for (const { selector, body } of acctUrRules(DESIGN_CSS)) {
      if (/:disabled/.test(selector)) expect(body, selector).not.toMatch(/\bopacity\s*:/);
    }
  });
});

/* ------------------------------------------------- 7. phone and RTL geometry */

describe("phone and RTL geometry", () => {
  /* The accounting module is used on a phone, where a 38px-tall chrome button
     is below the 44px floor. The rule lives inside a narrow-screen media query,
     so the check has to see the query too. */
  it("the buttons reach a 44px touch target in both axes on a phone", () => {
    const s = stripComments(DESIGN_CSS);
    const query = /@media \(max-width: 820px\) \{([\s\S]*?)\n\}/g;
    const blocks = [...s.matchAll(query)].map((m) => m[1]!).filter((b) => b.includes("acct-ur-btn"));
    expect(blocks.length, "no narrow-screen block for .acct-ur-btn").toBeGreaterThan(0);
    const body = blocks.join("\n");
    expect(body).toMatch(/min-block-size:\s*44px/);
    expect(body).toMatch(/min-inline-size:\s*44px/);
  });

  /* Logical properties only, so Arabic needs no second rule — the repo's
     standing requirement, and the reason the CRM pill flips for free. */
  it("the block uses logical properties, never left/right", () => {
    for (const { selector, body } of acctUrRules(DESIGN_CSS)) {
      expect(body, selector).not.toMatch(
        /(^|[\s;])(left|right|margin-left|margin-right|padding-left|padding-right|border-left|border-right|text-align:\s*(left|right))\s*:/,
      );
    }
  });

  it("the description truncates rather than pushing the chrome apart", () => {
    const what = acctUrRules(DESIGN_CSS).find((r) => r.selector === ".acct-ur-what");
    expect(what).toBeDefined();
    expect(what!.body).toMatch(/text-overflow:\s*ellipsis/);
    expect(what!.body).toMatch(/white-space:\s*nowrap/);
  });
});
