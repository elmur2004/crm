/* V2 — per-stage column color classes (token-mapped utilities only). The keys
   cover every stage id across pipelines; intake covers new/lead. */

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
    case "won":
      return "bg-stage-won-accent";
    case "lost":
      return "bg-stage-lost-accent";
    default:
      return "bg-brand-border";
  }
}
