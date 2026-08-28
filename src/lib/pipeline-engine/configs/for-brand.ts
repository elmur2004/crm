import { internalCrmConfig } from "./internal-crm";
import { bsystemsCrmConfig } from "./bsystems-crm";
import type { Brand } from "../constants";
import type { PipelineConfig } from "../types";

/* V2 (ADR-030): ByteForce keeps the v1 pipeline; B-Systems runs the unified
   role-aware pipeline (negotiation stage, milestone-tab win, owner buckets).

   ADR-067 moved this out of services/leads.ts and into the engine, beside the
   two configs it chooses between. The merged CRM serves both pipelines from one
   set of screens, so the question "which stages does THIS company have" is now
   asked by the To-Do and its completion marks as well as by the write path —
   and services/leads.ts is a heavy module for a projection to import merely to
   learn the name of a stage. `partnersConfigFor` already lives here; this is
   its twin, in the same place, so the engine stays the one owner of the answer.
   leads.ts re-exports it, so every existing importer is undisturbed. */
export function configForBrand(brand: Brand): PipelineConfig {
  return brand === "byteforce" ? internalCrmConfig : bsystemsCrmConfig;
}

/** The stages whose cards carry a DATED record that the To-Do projects: the
    follow-up stage, the meeting stage, and — for the pipeline that has one —
    negotiation, whose follow-up is the response date agreed with the client.

    Derived from the config rather than written out, because the To-Do is shared
    by both companies and a literal list there is one pipeline's vocabulary
    imposed on the other. ByteForce has no negotiation stage, so this returns
    two stages for it and three for B-Systems — which is also why a ByteForce
    lead can never be evaluated against a stage its pipeline does not have. */
export function datedStagesFor(brand: Brand): string[] {
  const config = configForBrand(brand);
  return [config.followUpStage, config.meetingStage, config.negotiationStage].filter(
    (s): s is string => typeof s === "string",
  );
}

/** The stages a FOLLOW-UP row can be live in for this company: the follow-up
    stage, plus negotiation where the pipeline has one (the response-due date is
    a follow-up record on a negotiating lead). */
export function followUpStagesFor(brand: Brand): string[] {
  const config = configForBrand(brand);
  return [config.followUpStage, config.negotiationStage].filter(
    (s): s is string => typeof s === "string",
  );
}
