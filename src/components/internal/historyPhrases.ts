import type { Msg } from "@/lib/i18n/core";
import { history } from "@/lib/i18n/dict/internal";
import { agentsConfig, partnersConfig } from "@/lib/pipeline-engine/configs/partners";
import type { PipelineConfig } from "@/lib/pipeline-engine/types";

/* §5.6 — where SPEC prescribes the EXACT History wording for a transition, the
   ActivityLog trigger resolves to that phrase and the card shows it as a pill.

   ADR-057: the map is keyed off the pipelines' own trigger SLOTS, never a
   literal row id. Hardcoding "PP-2" here silently dropped the pill from every
   agent card the moment the agent config got its own row ids. Any future config
   that declares a `numberAdded` row is covered by construction.

   ADR-059 collapsed the two configs back onto one shared PP-2 — so the slot
   scan now yields a single id, and the ids that WERE stamped in between have to
   be named explicitly (see LEGACY_NUMBER_ADDED_TRIGGERS). */

/** The configs that can emit a `number_added` transition (§5.3): the ones with
    a Didn't-Answer stage to auto-return FROM. */
export const NUMBER_ADDED_PIPELINES: readonly PipelineConfig[] = [partnersConfig, agentsConfig];

/** Row ids that are no longer STAMPED but are still stored. ActivityLog is
    append-only: ADR-057 gave agent cards their own §10.2a ids for two days and
    ADR-059 folded them back into PP-*, so every card moved in between carries
    `PA-2` for ever. Drop it and those cards silently lose their pill. */
const LEGACY_NUMBER_ADDED_TRIGGERS = ["PA-2"] as const;

export const TRIGGER_PHRASES: Record<string, Msg> = Object.fromEntries([
  ...NUMBER_ADDED_PIPELINES.map((config) => [
    /* the same default `transition.ts` stamps when a config declares no ids */
    config.triggers?.numberAdded ?? "PP-2",
    history.returnedToLead,
  ]),
  ...LEGACY_NUMBER_ADDED_TRIGGERS.map((trigger) => [trigger, history.returnedToLead]),
]);
