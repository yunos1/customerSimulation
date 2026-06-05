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
  | "career_map"
  | "intro"
  | "player_reply"
  | "summary";

export type ReplyReactionKind = "success" | "neutral" | "failure";

export type CustomerType =
  | "angry_refund"
  | "lost_package"
  | "coupon_hunter"
  | "policy_checker"
  | "passive_aggressive";

export type CustomerScenarioSet = "realistic" | "comedy" | "cyber";

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

// 解锁条件：从 meta 的记录 / 成就推导某张高级回复卡是否可用。
// 全部是「达到阈值即解锁」的单调条件，保证解锁不可逆（符合元进度直觉）。
export type UnlockCondition =
  | { kind: "totalResolved"; count: number }
  | { kind: "totalRuns"; count: number }
  | { kind: "bestSatisfaction"; value: number }
  | { kind: "achievement"; id: AchievementId };

// 可解锁的高级回复卡：基础牌之外、靠里程碑赚到的额外工具。
export interface UnlockableCard {
  card: ReplyCard;
  condition: UnlockCondition;
  /** 解锁条件的人类可读描述，用于解锁 toast 展示。 */
  hint: string;
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
  // 可选的客户生成配置。缺省时生成器走默认数量与全场景池（保持旧行为）。
  generation?: DayGenerationConfig;
}

export type Grade = "S" | "A" | "B" | "C" | "D";

// 单天客户生成参数：替代 customerGenerator 中硬编码的数量与固定场景池，
// 让职业模式的不同天数可以差异化难度。
export interface DayGenerationConfig {
  /** 客户场景组：真实售后 / 荒诞喜剧 / 赛博悬疑。 */
  scenarioSet?: CustomerScenarioSet;
  /** 本天客户数，替代默认的 defaultCustomerCount。 */
  customerCount: number;
  /** 场景选择权重，偏向更难的客户类型（如 policy_checker / passive_aggressive）。 */
  typeWeights?: Partial<Record<CustomerType, number>>;
  /** 可选的场景 id 子集；缺省用全部场景。 */
  scenarioPool?: string[];
  /** 对每位客户初始指标的额外偏移（让后续天数更难安抚）。 */
  metricOffsets?: Partial<Pick<Metrics, "satisfaction" | "anger">>;
}

// 职业模式中的「一天」。通过 buildLevelConfig 适配成引擎消费的 LevelConfig。
export interface CareerDay {
  id: string;
  title: string;
  briefing: string;
  baseMetrics: Metrics;
  generation: DayGenerationConfig;
  /** 过关所需最低评级。 */
  passGrade: Grade;
}

// 整条职业线。replyCards / policies / possibleEvents 跨天共享。
export interface CareerConfig {
  days: CareerDay[];
  replyCards: ReplyCard[];
  policies: PolicyEntry[];
  possibleEvents: RandomEvent[];
}

export interface ChatMessage {
  id: string;
  speaker: "system" | "customer" | "agent";
  text: string;
}

export interface ReplyFeedback {
  matchedTags: ToneTag[];
  riskyTags: ToneTag[];
  metricChanges: MetricDelta;
  reactionKind: ReplyReactionKind;
  comboNotes: string[];
  timingRiskNotes: string[];
  message: string;
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

export type CoachingStats = {
  replyCount: number;
  matchedTagHits: number;
  riskyTagHits: number;
  comboHitCount: number;
  timingRiskCount: number;
  templateFatigueCount: number;
  templateUseCount: number;
  compensationUseCount: number;
  policyUseCount: number;
  investigationUseCount: number;
  empathyUseCount: number;
  supervisorUseCount: number;
  pushbackUseCount: number;
  freeReplyUseCount: number;
};

export type CustomerSessionStatus = "active" | "resolved" | "failed";

export interface ReplyMemory {
  cardId: string;
  tags: ToneTag[];
}

export interface CustomerSession {
  id: string;
  customer: Customer;
  activeRoundIndex: number;
  metrics: Pick<Metrics, "satisfaction" | "anger">;
  messages: ChatMessage[];
  replyHistory: ReplyMemory[];
  status: CustomerSessionStatus;
  elapsedSeconds: number;
  timeoutCounted: boolean;
  timeoutAlertDismissed: boolean;
  outcome?: CustomerOutcome;
}

export interface DaySummary {
  grade: Grade;
  title: string;
  supervisorComment: string;
  totals: Metrics;
  outcomes: CustomerOutcome[];
  diagnostics: SummaryDiagnostic[];
}

export interface SummaryDiagnostic {
  id: string;
  title: string;
  body: string;
  tone: "good" | "warning" | "risk" | "tip";
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
  coachingStats: CoachingStats;
  triggeredEventIds: string[];
  summary?: DaySummary;
  // 消息与会话 id 计数器。放进 state 而非模块级可变变量，
  // 让 reducer 保持纯函数：在 StrictMode 双调用下结果可重现。
  messageCounter: number;
  sessionCounter: number;
}

export type GameAction =
  | { type: "LOAD_DAY"; level: LevelConfig; seed: number }
  | { type: "START_DAY"; seed: number }
  | { type: "TICK"; seed: number }
  | { type: "SELECT_SESSION"; sessionId: string }
  | { type: "OPEN_TIMEOUT_ALERT"; sessionId: string }
  | { type: "CHOOSE_REPLY"; cardId: string; sessionId?: string; aiReactionLine?: string }
  | { type: "SUBMIT_FREE_REPLY"; text: string; sessionId?: string; aiReactionLine?: string }
  | { type: "RESTART_DAY"; level: LevelConfig; seed: number };
