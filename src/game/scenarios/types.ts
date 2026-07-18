import type {
  CustomerType,
  Metrics,
  ToneTag,
} from "../types";

export type RoundTemplate = {
  id: string;
  prompts: string[];
  preferredTags: ToneTag[];
  riskyTags: ToneTag[];
  successLines: string[];
  neutralLines: string[];
  failureLines: string[];
  resolveAfter?: boolean;
};

export type ScenarioTemplate = {
  id: string;
  type: CustomerType;
  names: string[];
  handles: string[];
  issues: string[];
  openings: string[];
  profileNotes: string[];
  initialMetrics: Pick<Metrics, "satisfaction" | "anger">;
  patience: number;
  rounds: RoundTemplate[];
};
