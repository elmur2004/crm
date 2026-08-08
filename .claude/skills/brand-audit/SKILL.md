---
name: brand-audit
description: Audit the codebase for brand compliance across both brands - hardcoded values, scope integrity, B-Systems pink/gradient/Paper rules, ByteForce palette and emoji rules, RTL readiness. Use after UI work, before phase gates, or when the user asks to check the branding.
---

# /brand-audit

Delegate to the `brand-auditor` subagent (preferred), or run its checklist directly:

1. Grep for hex colors and `font-family` outside `branding/`, `src/themes/`, and token
   files — every hit is a finding.
2. Scope integrity: `/byteforce` routes resolve to `data-brand="byteforce"`; `/b-systems`
   and `/portal` to `data-brand="bsystems"`; no cross-brand tokens.
3. B-Systems: pink never a surface or body text; canvases are Paper `#FAFAFD`, never
   `#FFFFFF`; `--gradient-hero` only in hero/login/landing components; `.bs-mesh` only
   over gradients; no green/teal/orange; Raleway headings / Inter body / JetBrains Mono
   meta; CTA copy is direct value (no "discover/unlock/elevate").
4. ByteForce: only the five palette values (+ functional danger); violet is `#53449B`
   (ADR-001); no emoji in App A UI strings; Lama Sans via token only.
5. RTL: flag physical left/right CSS that should be logical properties (A-12).

Output the findings table (File | Line | Finding | Rule ref | Severity) and a PASS/FAIL
verdict. Fix findings in the main thread, then log a one-line result in the session's
PROGRESS entry. A phase gate requires a PASS here.
