// 集中存放游戏平衡数值。Phase 0 阶段为纯搬移：所有值与原先散落在
// reducer.ts / scoring.ts / customerGenerator.ts / customerFlow.ts 中的字面量
// 完全一致，目的是把调参入口收敛到一处，而不改变任何现有行为。
// 后续阶段（难度曲线、职业模式）才会在此基础上做差异化调整。

// ── 会话节奏与并发（原 reducer.ts 顶部常量） ──────────────────
export const sessionTiming = {
  /** 客户等待超过该秒数触发红色超时提醒。 */
  timeoutAlertSeconds: 120,
  /** 同时可保持的最大活跃会话数。 */
  maxOpenSessions: 3,
  /** 新客户接入的最小/最大延迟（秒）。 */
  minArrivalDelay: 18,
  maxArrivalDelay: 35,
  /** 每次 tick 触发随机事件的概率分母（1/N）。 */
  randomEventChance: 20,
} as const;

// ── 客户会话解决阈值（原 customerFlow.ts shouldResolveCustomer） ──
export const resolveThresholds = {
  /** 满意度达到该值即视为会话可收尾。 */
  satisfaction: 88,
  /** 怒气降到该值即视为会话可收尾。 */
  anger: 8,
} as const;

// ── 单客户数（原 customerGenerator.ts shiftCustomerCount） ────────
export const defaultCustomerCount = 6;

// ── 评分权重（原 scoring.ts scoreReply 内联系数） ────────────────
export const replyScoring = {
  /** 命中本轮 preferredTags 时每个标签的满意度加成。 */
  preferredSatisfactionPerHit: 8,
  /** 命中 preferredTags 时每个标签的怒气削减。 */
  preferredAngerPerHit: 7,
  /** 踩中 riskyTags 时每个标签的满意度惩罚。 */
  riskySatisfactionPerHit: 7,
  /** 踩中 riskyTags 时每个标签的怒气增加。 */
  riskyAngerPerHit: 10,
  /** 踩中 riskyTags 时每个标签的合规风险增加。 */
  riskyCompliancePerHit: 4,
  /** 反应判定：命中权重、踩雷权重，以及 success/failure 阈值。 */
  reactionPreferredWeight: 2,
  reactionRiskyWeight: 1,
  reactionSuccessAt: 2,
  reactionFailureAt: -1,
} as const;

// ── 日终评分与评级（原 scoring.ts buildDaySummary） ──────────────
export const daySummaryScoring = {
  /** score = 各项加权和。 */
  satisfactionWeight: 0.45,
  timeLeftWeight: 0.06,
  companyCostWeight: 0.18,
  complianceRiskWeight: 0.32,
  complaintPenalty: 12,
} as const;

/** 评级阈值（score 下限）。rageQuit 直接判 D。 */
export const gradeThresholds = {
  S: 72,
  A: 58,
  B: 42,
  C: 26,
} as const;
