/* V2 — per-stage color helpers (token-mapped only). The keys cover every stage
   id across pipelines; intake covers new/lead. */

/** stage id → the design-system `data-stage-key` (spec §2.6) — resolves the
    four per-stage vars (well/bar/chip/chip-ink) under the active brand. */
export function stageKey(stage: string): string {
  switch (stage) {
    case "new":
    case "lead":
      return "intake";
    case "following_up":
      return "following";
    case "meeting_setting":
      return "meeting";
    case "sending_proposal":
      return "proposal";
    case "negotiation":
      return "negotiation";
    case "didnt_answer":
      return "didnt-answer";
    /* ADR-072 — its OWN key. Aliasing it onto "lost" would satisfy every guard
       and paint a lead that is merely paused in the colour of a lead that is
       gone, which is the exact confusion the column exists to end. */
    case "postponed":
      return "postponed";
    /* prospect pipeline (ADR-057, widened by ADR-059) — its own three keys.
       Without these the fallback below would paint Contacted, Waiting and
       Qualified — the prospect's win — in Lost. Never alias one of them onto
       an existing key: it satisfies every guard and paints the wrong column. */
    case "contacted":
      return "contacted";
    case "waiting":
      return "waiting";
    case "qualified":
      return "qualified";
    case "won":
      return "won";
    default:
      return "lost";
  }
}

export function stageTint(stage: string): string {
  switch (stage) {
    case "new":
    case "lead":
      return "bg-stage-intake";
    case "following_up":
      return "bg-stage-following";
    case "meeting_setting":
      return "bg-stage-meeting";
    case "sending_proposal":
      return "bg-stage-proposal";
    case "negotiation":
      return "bg-stage-negotiation";
    case "didnt_answer":
      return "bg-stage-didnt-answer";
    case "postponed":
      return "bg-stage-postponed"; // ADR-072
    case "contacted":
      return "bg-stage-contacted";
    case "waiting":
      return "bg-stage-waiting";
    case "qualified":
      return "bg-stage-qualified";
    case "won":
      return "bg-stage-won";
    case "lost":
      return "bg-stage-lost";
    default:
      return "bg-brand-surface-tint";
  }
}

export function stageAccent(stage: string): string {
  switch (stage) {
    case "new":
    case "lead":
      return "bg-stage-intake-accent";
    case "following_up":
      return "bg-stage-following-accent";
    case "meeting_setting":
      return "bg-stage-meeting-accent";
    case "sending_proposal":
      return "bg-stage-proposal-accent";
    case "negotiation":
      return "bg-stage-negotiation-accent";
    case "didnt_answer":
      return "bg-stage-didnt-answer-accent";
    case "postponed":
      return "bg-stage-postponed-accent"; // ADR-072
    case "contacted":
      return "bg-stage-contacted-accent";
    case "waiting":
      return "bg-stage-waiting-accent";
    case "qualified":
      return "bg-stage-qualified-accent";
    case "won":
      return "bg-stage-won-accent";
    case "lost":
      return "bg-stage-lost-accent";
    default:
      return "bg-brand-border";
  }
}
