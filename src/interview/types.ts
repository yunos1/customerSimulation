export type InterviewRoleId = "frontend" | "product" | "sales";

export type InterviewDifficulty = "junior" | "mid" | "senior";

export type InterviewerId = "lin" | "chen" | "zhou" | "gao";

export type InterviewStage = "setup" | "briefing" | "question" | "summary";

export type InterviewMetricKey =
  | "clarity"
  | "structure"
  | "evidence"
  | "roleFit"
  | "resilience";

export type InterviewMetrics = Record<InterviewMetricKey, number>;

export interface InterviewRole {
  id: InterviewRoleId;
  title: string;
  field: string;
  mission: string;
  competencies: string[];
  keywords: string[];
  starterQuestions: string[];
}

export interface Interviewer {
  id: InterviewerId;
  name: string;
  title: string;
  style: string;
  pressure: number;
  initials: string;
}

export interface InterviewQuestion {
  id: string;
  title: string;
  prompt: string;
  focus: InterviewMetricKey[];
  source?: "role" | "custom" | "shared";
  evidenceHints?: string[];
}

export interface InterviewAnswer {
  questionId: string;
  prompt: string;
  answer: string;
  score: number;
  metrics: InterviewMetrics;
  strengths: string[];
  risks: string[];
  followUp: string;
  concern: string;
  improvedAnswer: string;
  retryOfQuestionId?: string;
  improvementFrom?: number;
}

export interface InterviewSummary {
  totalScore: number;
  hireSignal: string;
  verdict: string;
  metrics: InterviewMetrics;
  strongestAnswer?: InterviewAnswer;
  weakestAnswer?: InterviewAnswer;
  suggestions: string[];
  modelAnswer: string;
}

export interface InterviewCustomization {
  jdText: string;
  resumeText: string;
}

export interface CustomInterviewInsight {
  keywords: string[];
  jdSignals: string[];
  resumeSignals: string[];
  prompts: InterviewQuestion[];
}

export interface InterviewHistoryRecord {
  id: string;
  roleTitle: string;
  difficulty: InterviewDifficulty;
  interviewerName: string;
  score: number;
  createdAt: string;
  verdict: string;
}
