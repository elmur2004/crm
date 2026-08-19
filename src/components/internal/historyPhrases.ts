import type { Msg } from "@/lib/i18n/core";
import { history } from "@/lib/i18n/dict/internal";
import { agentsConfig, partnersConfig } from "@/lib/pipeline-engine/configs/partners";
import type { PipelineConfig } from "@/lib/pipeline-engine/types";

/* §5.6 — where SPEC prescribes the EXACT History wording for a transition, the
   ActivityLog trigger resolves to that phrase and the card shows it as a pill.

   ADR-057: the map is keyed off the pipelines' own trigger SLOTS, never a
   literal row id. §10.2's PP-2 and §10.2a's PA-2 are ONE normative sentence
   ("Returned to Lead — new number added") declared by two configs of the same
   parameterized family, so hardcoding "PP-2" here silently dropped the pill
   from every agent card the moment the agent config got its own row ids. Any
   future config that declares a `numberAdded` row is covered by construction. */

/** The configs that can emit a `number_added` transition (§5.3): the ones with
    a Didn't-Answer stage to auto-return FROM. */
export const NUMBER_ADDED_PIPELINES: readonly PipelineConfig[] = [partnersConfig, agentsConfig];

export const TRIGGER_PHRASES: Record<string, Msg> = Object.fromEntries(
  NUMBER_ADDED_PIPELINES.map((config) => [
    /* the same default `transition.ts` stamps when a config declares no ids */
    config.triggers?.numberAdded ?? "PP-2",
    history.returnedToLead,
  ]),
);
