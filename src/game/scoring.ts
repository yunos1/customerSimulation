import type {
  Customer,
  CustomerOutcome,
  CustomerRound,
  DaySummary,
  LevelConfig,
  MetricDelta,
  Metrics,
  ReplyCard,
  ToneTag,
} from "./types";

const metricBounds: Record<keyof Metrics, [number, number]> = {
  satisfaction: [0, 100],
  anger: [0, 100],
  companyCost: [0, 999],
  complianceRisk: [0, 100],
  timeLeft: [0, 120],
};

export function clampMetric(metric: keyof Metrics, value: number) {
  const [min, max] = metricBounds[metric];
  return Math.max(min, Math.min(max, value));
}

export function applyDelta(metrics: Metrics, delta: MetricDelta): Metrics {
  return {
    satisfaction: clampMetric("satisfaction", metrics.satisfaction + (delta.satisfaction ?? 0)),
    anger: clampMetric("anger", metrics.anger + (delta.anger ?? 0)),
    companyCost: clampMetric("companyCost", metrics.companyCost + (delta.companyCost ?? 0)),
    complianceRisk: clampMetric(
      "complianceRisk",
      metrics.complianceRisk + (delta.complianceRisk ?? 0),
    ),
    timeLeft: clampMetric("timeLeft", metrics.timeLeft + (delta.timeLeft ?? 0)),
  };
}

export function scoreReply(customer: Customer, round: CustomerRound, card: ReplyCard) {
  const preferredHits = countTagOverlap(card.tags, round.preferredTags);
  const riskyHits = countTagOverlap(card.tags, round.riskyTags);
  const customerModifier = getCustomerTypeModifier(customer.type, card.tags);

  const delta: MetricDelta = {
    ...card.effects,
    satisfaction:
      (card.effects.satisfaction ?? 0) + preferredHits * 8 - riskyHits * 7 + customerModifier.satisfaction,
    anger: (card.effects.anger ?? 0) - preferredHits * 7 + riskyHits * 10 + customerModifier.anger,
    complianceRisk:
      (card.effects.complianceRisk ?? 0) + riskyHits * 4 + customerModifier.complianceRisk,
  };

  const reactionScore = preferredHits * 2 - riskyHits + customerModifier.reactionBias;
  const reactionKind: "success" | "neutral" | "failure" =
    reactionScore >= 2 ? "success" : reactionScore <= -1 ? "failure" : "neutral";

  return { delta, reactionKind };
}

export function createOutcome(customer: Customer, metrics: Metrics): CustomerOutcome {
  if (metrics.complianceRisk >= 100) {
    return {
      customerId: customer.id,
      customerName: customer.name,
      status: "compliance_escalation",
      satisfaction: metrics.satisfaction,
      anger: metrics.anger,
      notes: ["合规风险触顶，主管强制介入。"],
    };
  }

  if (metrics.anger >= 100 || metrics.satisfaction <= 10) {
    return {
      customerId: customer.id,
      customerName: customer.name,
      status: "complaint",
      satisfaction: metrics.satisfaction,
      anger: metrics.anger,
      notes: ["客户提交差评或投诉。"],
    };
  }

  return {
    customerId: customer.id,
    customerName: customer.name,
    status: "resolved",
    satisfaction: metrics.satisfaction,
    anger: metrics.anger,
    notes: ["会话已收尾，客户暂时接受处理方案。"],
  };
}

export function buildDaySummary(level: LevelConfig, metrics: Metrics, outcomes: CustomerOutcome[]): DaySummary {
  const complaints = outcomes.filter((outcome) => outcome.status !== "resolved").length;
  const avgSatisfaction =
    outcomes.reduce((total, outcome) => total + outcome.satisfaction, 0) / Math.max(outcomes.length, 1);

  const score =
    avgSatisfaction * 0.45 +
    metrics.timeLeft * 0.15 -
    metrics.companyCost * 0.18 -
    metrics.complianceRisk * 0.32 -
    complaints * 12;

  const grade = score >= 72 ? "S" : score >= 58 ? "A" : score >= 42 ? "B" : score >= 26 ? "C" : "D";

  const comments: Record<DaySummary["grade"], string> = {
    S: "你今天像把灭火器和合同条款装进了同一个脑子里。",
    A: "表现很稳，客户基本安顿住了，公司钱包也还活着。",
    B: "合格的一天。情绪没炸穿，成本也没离谱，值得下班。",
    C: "主管说想和你聊聊优惠券的正确打开方式。",
    D: "今天的工单像连环事故报告，建议明早先喝水再上线。",
  };

  const titles: Record<DaySummary["grade"], string> = {
    S: "金牌客服",
    A: "情绪稳定大师",
    B: "合格打工人",
    C: "被主管约谈",
    D: "今日工位不保",
  };

  return {
    grade,
    title: titles[grade],
    supervisorComment: comments[grade],
    totals: metrics,
    outcomes,
  };
}

function countTagOverlap(source: ToneTag[], target: ToneTag[]) {
  const targetSet = new Set(target);
  return source.filter((tag) => targetSet.has(tag)).length;
}

function getCustomerTypeModifier(type: Customer["type"], tags: ToneTag[]) {
  const has = (tag: ToneTag) => tags.includes(tag);

  switch (type) {
    case "angry_refund":
      return {
        satisfaction: has("apology") || has("refund_check") ? 4 : 0,
        anger: has("template") || has("reject") ? 8 : 0,
        complianceRisk: has("compensation") ? 3 : 0,
        reactionBias: has("apology") ? 1 : 0,
      };
    case "lost_package":
      return {
        satisfaction: has("logistics") || has("investigate") ? 5 : 0,
        anger: has("template") ? 5 : 0,
        complianceRisk: 0,
        reactionBias: has("investigate") ? 1 : 0,
      };
    case "coupon_hunter":
      return {
        satisfaction: has("compensation") ? 10 : has("policy") ? -3 : 0,
        anger: has("reject") ? 9 : 0,
        complianceRisk: has("compensation") ? 5 : -2,
        reactionBias: has("compensation") ? 1 : 0,
      };
    case "policy_checker":
      return {
        satisfaction: has("policy") ? 7 : 0,
        anger: has("template") || has("compensation") ? 6 : 0,
        complianceRisk: has("policy") ? -5 : 4,
        reactionBias: has("policy") ? 1 : -1,
      };
    case "passive_aggressive":
      return {
        satisfaction: has("empathy") ? 8 : 0,
        anger: has("template") ? 11 : 0,
        complianceRisk: 0,
        reactionBias: has("empathy") ? 1 : 0,
      };
  }
}
