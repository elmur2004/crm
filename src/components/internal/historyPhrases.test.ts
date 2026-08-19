import { describe, expect, it } from "vitest";
import { NUMBER_ADDED_PIPELINES, TRIGGER_PHRASES } from "./historyPhrases";
import { history } from "@/lib/i18n/dict/internal";
import { agentsConfig, partnersConfig } from "@/lib/pipeline-engine/configs/partners";
import { transition } from "@/lib/pipeline-engine/transition";

/* SPEC §10.2 (PP-2) and §10.2a (PA-2) both prescribe the SAME History wording.
   ADR-057 gave the agent config its own row ids, and a map keyed on the literal
   "PP-2" quietly dropped the pill from every agent card. These assertions make
   the row id a derived fact, so the next PA-* row cannot repeat it. */

describe("History trigger phrases (SPEC §5.6)", () => {
  it("gives PP-2 and PA-2 the normative 'Returned to Lead' wording", () => {
    expect(TRIGGER_PHRASES["PP-2"]).toBe(history.returnedToLead);
    expect(TRIGGER_PHRASES["PA-2"]).toBe(history.returnedToLead);
  });

  it("covers the numberAdded row of EVERY pipeline that can emit one", () => {
    for (const config of NUMBER_ADDED_PIPELINES) {
      const rowId = config.triggers?.numberAdded ?? "PP-2";
      expect(TRIGGER_PHRASES[rowId], `no History wording for ${rowId}`).toBe(
        history.returnedToLead,
      );
    }
  });

  it("covers the trigger the engine actually stamps on the auto-return", () => {
    /* not a restatement of the config: the row id the ENGINE emits is what
       lands in ActivityLog.trigger and what the panel looks up */
    for (const config of [partnersConfig, agentsConfig]) {
      const result = transition(
        config,
        { stage: config.didntAnswerStage! },
        { type: "number_added", slot: 2 },
        { role: "bsystems_admin" },
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(TRIGGER_PHRASES[result.logTrigger]).toBe(history.returnedToLead);
    }
  });
});
