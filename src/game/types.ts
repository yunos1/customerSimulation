export type MetricKey =
  | "satisfaction"
  | "anger"
  | "companyCost"
  | "complianceRisk"
  | "timeLeft";

export type ToneTag =
  | "apology"
  | "policy"
  | "refund_check"
  | "logistics"
  | "compensation"
  | "reject"
  | "supervisor"
  | "template"
  | "empathy"
  | "investigate"
  | "pushback";

export type GamePhase =
  | "intro"
  | "player_reply"
  | "customer_reaction"
  | "customer_resolved"
  | "customer_failed"
  | "summary";

export type CustomerType =
  | "angry_refund"
  | "lost_package"
  | "coupon_hunter"
  | "policy_checker"
  | "passive_aggressive";

export type Metrics = Record<MetricKey, number>;

export type MetricDelta = Partial<Record<MetricKey, number>>;

export interface ReplyCard {
  id: string;
  title: string;
  shortLabel: string;
  description: string;
  tags: ToneTag[];
  effects: MetricDelta;
  cooldown?: number;
}

export interface CustomerRound {
  id: string;
  prompt: string;
  preferredTags: ToneTag[];
  riskyTags: ToneTag[];
  successLine: string;
  neutralLine: string;
  failureLine: string;
  resolveAfter?: boolean;
}

export interface Customer {
  id: string;
  name: string;
  handle: string;
  type: CustomerType;
  issue: string;
  opening: string;
  initialMetrics: Pick<Metrics, "satisfaction" | "anger">;
  patience: number;
  profileNotes: string[];
  rounds: CustomerRound[];
}

export interface PolicyEntry {
  id: string;
  title: string;
  category: string;
  body: string;
  relatedTags: ToneTag[];
}

export interface RandomEvent {
  id: string;
  title: string;
  description: string;
  effects: MetricDelta;
}

export interface LevelConfig {
  id: string;
  title: string;
  briefing: string;
  baseMetrics: Metrics;
  customers: Customer[];
  replyCards: ReplyCard[];
  policies: PolicyEntry[];
  possibleEvents: RandomEvent[];
}

export interface ChatMessage {
  id: string;
  speaker: "system" | "customer" | "agent";
  text: string;
}

export interface CustomerOutcome {
  customerId: string;
  customerName: string;
  status: "resolved" | "complaint" | "compliance_escalation" | "rage_quit";
  satisfaction: number;
  anger: number;
  notes: string[];
}

export type AchievementId =
  | "first-save"
  | "perfect-shift"
  | "cool-headed"
  | "policy-shield"
  | "budget-keeper"
  | "speed-responder"
  | "multi-tasker"
  | "human-touch"
  | "no-timeout"
  | "comeback"
  | "rage-quit";

export interface Achievement {
  id: AchievementId;
  title: string;
  description: string;
  category: "服务" | "效率" | "合规" | "经营" | "技巧";
}

export type AchievementStats = {
  resolvedCount: number;
  complaintCount: number;
  timeoutCount: number;
  maxConcurrentSessions: number;
  freeReplyCount: number;
  fastestReplySeconds: number;
  savedAngryCustomerCount: number;
  recoveredLowSatisfactionCount: number;
  rageQuitCount: number;
};

export type CustomerSessionStatus = "active" | "resolved" | "failed";

export interface CustomerSession {
  id: string;
  customer: Customer;
  activeRoundIndex: number;
  metrics: Pick<Metrics, "satisfaction" | "anger">;
  messages: ChatMessage[];
  status: CustomerSessionStatus;
  elapsedSeconds: number;
  timeoutCounted: boolean;
  timeoutAlertDismissed: boolean;
  outcome?: CustomerOutcome;
}

export interface DaySummary {
  grade: "S" | "A" | "B" | "C" | "D";
  title: string;
  supervisorComment: string;
  totals: Metrics;
  outcomes: CustomerOutcome[];
}

export interface GameState {
  level: LevelConfig;
  phase: GamePhase;
  metrics: Metrics;
  sessions: CustomerSession[];
  activeSessionId?: string;
  connectedCustomerIds: string[];
  shiftMessages: ChatMessage[];
  nextArrivalIn: number;
  outcomes: CustomerOutcome[];
  achievements: AchievementId[];
  achievementStats: AchievementStats;
  summary?: DaySummary;
}

export type GameAction =
  | { type: "START_DAY"; seed: number }
  | { type: "TICK"; seed: number }
  | { type: "SELECT_SESSION"; sessionId: string }
  | { type: "OPEN_TIMEOUT_ALERT"; sessionId: string }
  | { type: "CHOOSE_REPLY"; cardId: string }
  | { type: "SUBMIT_FREE_REPLY"; text: string }
  | { type: "RESTART_DAY"; seed: number };
