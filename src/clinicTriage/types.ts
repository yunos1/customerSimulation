export type TriageLevel = "immediate" | "urgent" | "soon" | "routine" | "redirect";

export type ClinicScenarioId = "morning" | "pediatricNight" | "fluSeason";

export type ClinicResourceId = "resus" | "doctor" | "nurse" | "lab";

export interface VitalSigns {
  heartRate: number;
  systolicBp: number;
  temperature: number;
  spo2: number;
  pain: number;
}

export interface PatientCase {
  id: string;
  name: string;
  initials: string;
  age: string;
  arrivalMinute: number;
  chiefComplaint: string;
  visibleSummary: string;
  vitals: VitalSigns;
  emotion: "calm" | "anxious" | "angry" | "quiet";
  redFlags: string[];
  hiddenRisk: string;
  recommendedLevel: TriageLevel;
  bestResource: ClinicResourceId;
  deteriorationMinute: number;
  outcome: string;
}

export interface ClinicScenario {
  id: ClinicScenarioId;
  title: string;
  shortLabel: string;
  description: string;
  durationMinutes: number;
  resources: Record<ClinicResourceId, number>;
  patientIds: string[];
}

export interface TriageDecision {
  patientId: string;
  level: TriageLevel;
  resourceId: ClinicResourceId;
  decidedAt: number;
}

export interface PatientEvaluation {
  patient: PatientCase;
  decision?: TriageDecision;
  waitMinutes: number;
  delayMinutes: number;
  safetyDelta: number;
  resourceMatch: boolean;
  status: "scheduled" | "waiting" | "handled" | "deteriorated";
  feedback: string;
}

export interface ClinicMetrics {
  totalScore: number;
  safetyScore: number;
  fairnessScore: number;
  efficiencyScore: number;
  experienceScore: number;
  deteriorations: number;
  averageWait: number;
  queuePressure: number;
}

export interface ClinicIssue {
  id: string;
  severity: "high" | "medium" | "low";
  title: string;
  detail: string;
}

export interface ClinicEvaluation {
  patients: PatientEvaluation[];
  metrics: ClinicMetrics;
  issues: ClinicIssue[];
}
