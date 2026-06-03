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
  | "investigate";

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
  status: "resolved" | "complaint" | "compliance_escalation";
  satisfaction: number;
  anger: number;
  notes: string[];
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
  activeCustomerIndex: number;
  activeRoundIndex: number;
  metrics: Metrics;
  messages: ChatMessage[];
  outcomes: CustomerOutcome[];
  summary?: DaySummary;
  currentCustomerOutcome?: CustomerOutcome;
}

export type GameAction =
  | { type: "START_DAY" }
  | { type: "CHOOSE_REPLY"; cardId: string }
  | { type: "NEXT_CUSTOMER" }
  | { type: "RESTART_DAY" };
