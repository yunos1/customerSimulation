export type InterviewRoleId = "frontend" | "product" | "sales";

export type InterviewDifficulty = "steady" | "urgent" | "executive";

export type InterviewStage = "setup" | "shortlist" | "interview" | "decision" | "outcome" | "summary";

export type HiringDecision = "hire" | "waitlist" | "reject";

export type QuestionId =
  | "impact"
  | "deep_dive"
  | "collaboration"
  | "motivation"
  | "pressure"
  | "pedigree";

export type SignalKind = "ability" | "evidence" | "team" | "motivation" | "risk" | "bias";

export type SignalTone = "positive" | "neutral" | "warning" | "negative";

export type InterviewMetricKey =
  | "accuracy"
  | "evidence"
  | "candidateExperience"
  | "biasControl"
  | "teamFit";

export type InterviewMetrics = Record<InterviewMetricKey, number>;

export interface InterviewRole {
  id: InterviewRoleId;
  title: string;
  field: string;
  hiringGoal: string;
  teamContext: string;
  mustHaves: string[];
  niceToHaves: string[];
  riskNotes: string[];
}

export interface DifficultySetting {
  id: InterviewDifficulty;
  label: string;
  description: string;
  questionLimit: number;
  pressureLabel: string;
}

export interface InterviewQuestion {
  id: QuestionId;
  title: string;
  prompt: string;
  intent: string;
  category: string;
  experienceDelta: number;
  biasRisk: number;
  signalKinds: SignalKind[];
}

export interface CandidateSignal {
  label: string;
  kind: SignalKind;
  tone: SignalTone;
}

export interface CandidateResponse {
  answer: string;
  read: string;
  signals: CandidateSignal[];
}

export interface CandidateProfile {
  capability: number;
  collaboration: number;
  motivation: number;
  growth: number;
  integrity: number;
  pressure: number;
  fitScore: number;
  recommendation: HiringDecision;
  hiddenStrength: string;
  hiddenRisk: string;
  bestUse: string;
  delayedOutcome: string;
}

export interface Candidate {
  id: string;
  roleId: InterviewRoleId;
  name: string;
  initials: string;
  headline: string;
  resumeSummary: string;
  resumeHighlights: string[];
  surfaceTags: string[];
  expectedSalary: string;
  availability: string;
  expression: number;
  pedigree: number;
  profile: CandidateProfile;
  responses: Record<QuestionId, CandidateResponse>;
}

export interface InterviewDecisionRecord {
  id: string;
  candidateId: string;
  candidateName: string;
  roleTitle: string;
  decision: HiringDecision;
  recommendedDecision: HiringDecision;
  decisionScore: number;
  evidenceScore: number;
  candidateExperience: number;
  biasControl: number;
  teamFit: number;
  askedQuestionIds: QuestionId[];
  discoveredSignals: CandidateSignal[];
  blindSpots: string[];
  verdict: string;
  delayedFeedback: string;
  createdAt: string;
}

export interface InterviewSummary {
  totalScore: number;
  verdict: string;
  hireSignal: string;
  metrics: InterviewMetrics;
  bestCandidateId: string;
  bestCandidateName: string;
  suggestions: string[];
  records: InterviewDecisionRecord[];
}

export interface InterviewHistoryRecord {
  id: string;
  roleTitle: string;
  score: number;
  accuracy: number;
  createdAt: string;
  verdict: string;
}
