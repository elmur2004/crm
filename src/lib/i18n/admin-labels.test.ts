import { describe, expect, it } from "vitest";
import { ROLES } from "@/lib/pipeline-engine/constants";
import { grantableRoles } from "@/lib/services/user-tenancy";
import { assignableRoleLabels, regRoleBadges, roleBadges } from "./dict/admin";

/* ============================================================================
   ADR-075 — A MISSING LABEL IS A CRASH, NOT A BLANK.

   `tFor` is `(locale) => (m) => m[locale]`. There is no fallback in it, on
   purpose: a half-translated product is worse than a loud failure, and every
   call site passes a literal from a dictionary, so the type checker normally
   guarantees the message exists.

   These three maps are the exception. They are `Record<string, Msg>` keyed by
   ROLE, and a role is a string the compiler cannot check against them — so a
   role added to a list without a label reaches `t(undefined)` and throws a
   TypeError that takes the whole screen down.

   That is not hypothetical. ADR-074 added `mindoo_staff` to the create-user
   checkbox list and put its label in `regRoleBadges` — the Registrations map,
   a few lines above the one it needed — and the B-Systems Users page crashed on
   render. The founder reported it as "I can't add any users in bsystems right
   now", and it took a browser to find because nothing in the suite connected a
   role list to a label map.

   This file is that connection. It is cheap, it is pure, and it fails naming
   the role and the map.
   ========================================================================== */

describe("every role a screen can render has a label", () => {
  /* the two administrators' own grant lists — the exact source the create and
     edit forms render checkboxes from */
  const grantable = [...new Set([...grantableRoles("bsystems"), ...grantableRoles("mindoo")])];

  it("finds real roles to check (a silent zero would prove nothing)", () => {
    expect(grantable.length).toBeGreaterThanOrEqual(7);
  });

  it.each(grantable)("%s has an assignable-role checkbox label", (role) => {
    const label = assignableRoleLabels[role];
    expect(
      label,
      `assignableRoleLabels is missing "${role}". tFor has no fallback, so the ` +
        "create/edit user form will throw on render rather than show a blank box.",
    ).toBeDefined();
    expect(label!.en.length).toBeGreaterThan(0);
    expect(label!.ar.length).toBeGreaterThan(0);
  });

  it.each(ROLES)("%s has a Users-table badge", (role) => {
    /* the table guards its own lookup (`roleBadges[r] ? t(...) : r`), so a gap
       here degrades to the raw role id rather than crashing — still wrong on
       screen, and cheap to prevent */
    const badge = roleBadges[role];
    expect(badge, `roleBadges is missing "${role}" — the row prints the raw id`).toBeDefined();
  });

  it.each(ROLES)("%s has a Registrations badge", (role) => {
    const badge = regRoleBadges[role];
    expect(badge, `regRoleBadges is missing "${role}"`).toBeDefined();
  });

  it("every label map is complete in BOTH languages", () => {
    for (const [name, map] of [
      ["assignableRoleLabels", assignableRoleLabels],
      ["roleBadges", roleBadges],
      ["regRoleBadges", regRoleBadges],
    ] as const) {
      for (const [role, msg] of Object.entries(map)) {
        expect(msg.en, `${name}.${role} has no English`).toBeTruthy();
        expect(msg.ar, `${name}.${role} has no Arabic`).toBeTruthy();
      }
    }
  });
});
