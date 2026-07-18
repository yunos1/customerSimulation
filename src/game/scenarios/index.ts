import type { CustomerScenarioSet } from "../types";
import { comedyScenarios } from "./comedy";
import { cyberScenarios } from "./cyber";
import { realisticScenarios } from "./realistic";
import type { ScenarioTemplate } from "./types";

export type { RoundTemplate, ScenarioTemplate } from "./types";

export const scenarioSets: Record<CustomerScenarioSet, ScenarioTemplate[]> = {
  realistic: realisticScenarios,
  comedy: comedyScenarios,
  cyber: cyberScenarios,
};

export { comedyScenarios, cyberScenarios, realisticScenarios };
