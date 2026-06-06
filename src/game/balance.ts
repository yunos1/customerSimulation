// 集中存放游戏平衡数值。Phase 0 阶段为纯搬移：所有值与原先散落在
// reducer.ts / scoring.ts / customerGenerator.ts / customerFlow.ts 中的字面量
// 完全一致，目的是把调参入口收敛到一处，而不改变任何现有行为。
// 后续阶段（难度曲线、职业模式）才会在此基础上做差异化调整。

// ── 会话节奏与并发（原 reducer.ts 顶部常量） ──────────────────
export const sessionTiming = {
  /** 客户等待超过该秒数触发红色超时提醒。 */
  timeoutAlertSeconds: 120,
  /** 同时可保持的最大活跃会话数。 */
  maxOpenSessions: 2,
  /** 新客户接入的最小/最大延迟（秒）。 */
  minArrivalDelay: 60,
  maxArrivalDelay: 100,
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

// ── 疲劳值机制 ────────────────────────────────────────────────────
export const fatigue = {
  /** 每次完成回复（无论结果）消耗的疲劳点数。 */
  perReply: 8,
  /** 每秒自然恢复的疲劳点数（idle 缓慢回血）。 */
  recoveryPerTick: 1,
  /** 疲劳到达此阈值时进入「疲劳」状态，客户到达间隔压缩至原来 60%。 */
  pressureThreshold: 60,
  /** 疲劳满（100）时每秒对所有活跃会话满意度的惩罚。 */
  maxFatigueSatisfactionPenalty: 2,
} as const;

// ── 难度分层预设 ──────────────────────────────────────────────────
// 关卡通过 generation.difficultyPreset 引用其中一个 key，
// customerGenerator 用 metricOffsets 叠加偏移，scoring 通过 gradeThresholds 调整压力。
export type DifficultyPreset = "easy" | "normal" | "hard";

export const difficultyPresets: Record<DifficultyPreset, {
  /** 对每位客户初始满意度 / 怒气的额外偏移（负值让客户更难安抚）。 */
  metricOffsets: { satisfaction: number; anger: number };
  /** 客户到达最小间隔系数（<1 表示压缩，客流更密）。 */
  arrivalMultiplier: number;
  /** 评级阈值调整（正值让达到同一评级更难）。 */
  gradeOffset: number;
}> = {
  easy:   { metricOffsets: { satisfaction: 12, anger: -12 }, arrivalMultiplier: 1.4, gradeOffset: -8  },
  normal: { metricOffsets: { satisfaction: 0,  anger: 0   }, arrivalMultiplier: 1.0, gradeOffset: 0   },
  hard:   { metricOffsets: { satisfaction: -10, anger: 14 }, arrivalMultiplier: 0.7, gradeOffset: 10  },
} as const;

// ── 节假日客流波动 ────────────────────────────────────────────────
export const holiday = {
  /** 节假日客户到达间隔系数（0.5 = 间隔减半，客流翻倍）。 */
  arrivalMultiplier: 0.5,
  /** 节假日额外增加的最大并发会话数。 */
  extraMaxSessions: 1,
} as const;
