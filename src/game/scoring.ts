import {
  daySummaryScoring,
  gradeThresholds,
  replyScoring,
} from "./balance";
import type {
  Customer,
  CustomerOutcome,
  CustomerRound,
  CoachingStats,
  DaySummary,
  MetricDelta,
  Metrics,
  ReplyAssessment,
  ReplyFeedback,
  ReplyCard,
  ReplyMemory,
  ReplyReactionKind,
  SummaryDiagnostic,
  ToneTag,
} from "./types";

const metricBounds: Record<keyof Metrics, [number, number]> = {
  satisfaction: [0, 100],
  anger: [0, 100],
  companyCost: [0, 999],
  complianceRisk: [0, 100],
  timeLeft: [0, 180],
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

export function applyShiftDelta(metrics: Metrics, delta: MetricDelta): Metrics {
  return {
    ...metrics,
    companyCost: clampMetric("companyCost", metrics.companyCost + (delta.companyCost ?? 0)),
    complianceRisk: clampMetric(
      "complianceRisk",
      metrics.complianceRisk + (delta.complianceRisk ?? 0),
    ),
    timeLeft: clampMetric("timeLeft", metrics.timeLeft + (delta.timeLeft ?? 0)),
  };
}

type ReplyScoringContext = {
  previousReply?: ReplyMemory;
  templateUseCount: number;
  /** 最近 N 回合已展示过的 timingRiskNotes，用于去重（同一提示 3 回合内不重复推送）。 */
  recentTimingRiskNotes?: string[];
  aiAssessment?: ReplyAssessment;
};

type ReplyModifier = {
  delta: MetricDelta;
  reactionBias: number;
  comboNotes: string[];
  timingRiskNotes: string[];
};

export function scoreReply(
  customer: Customer,
  round: CustomerRound,
  card: ReplyCard,
  context: ReplyScoringContext,
) {
  const matchedTags = getTagOverlap(card.tags, round.preferredTags);
  const riskyTags = getTagOverlap(card.tags, round.riskyTags);
  const preferredHits = matchedTags.length;
  const riskyHits = riskyTags.length;
  const customerModifier = getCustomerTypeModifier(customer.type, card.tags);
  const sequenceModifier = getSequenceModifier(card, context);

  const delta: MetricDelta = {
    satisfaction:
      (card.effects.satisfaction ?? 0) +
      preferredHits * replyScoring.preferredSatisfactionPerHit -
      riskyHits * replyScoring.riskySatisfactionPerHit +
      customerModifier.satisfaction +
      (sequenceModifier.delta.satisfaction ?? 0),
    anger:
      (card.effects.anger ?? 0) -
      preferredHits * replyScoring.preferredAngerPerHit +
      riskyHits * replyScoring.riskyAngerPerHit +
      customerModifier.anger +
      (sequenceModifier.delta.anger ?? 0),
    companyCost: (card.effects.companyCost ?? 0) + (sequenceModifier.delta.companyCost ?? 0),
    complianceRisk:
      (card.effects.complianceRisk ?? 0) +
      riskyHits * replyScoring.riskyCompliancePerHit +
      customerModifier.complianceRisk +
      (sequenceModifier.delta.complianceRisk ?? 0),
    timeLeft: (card.effects.timeLeft ?? 0) + (sequenceModifier.delta.timeLeft ?? 0),
  };

  const reactionScore =
    preferredHits * replyScoring.reactionPreferredWeight -
    riskyHits * replyScoring.reactionRiskyWeight +
    customerModifier.reactionBias +
    sequenceModifier.reactionBias;
  const fallbackReactionKind: ReplyReactionKind =
    reactionScore >= replyScoring.reactionSuccessAt
      ? "success"
      : reactionScore <= replyScoring.reactionFailureAt
        ? "failure"
        : "neutral";
  const reactionKind = context.aiAssessment?.reactionKind ?? fallbackReactionKind;
  const semanticNotes = getAssessmentNotes(context.aiAssessment);
  const feedback = buildReplyFeedback(
    card,
    round,
    delta,
    reactionKind,
    sequenceModifier.comboNotes,
    sequenceModifier.timingRiskNotes,
    semanticNotes,
  );

  return { delta, reactionKind, feedback };
}

export function buildReplyFeedback(
  card: ReplyCard,
  round: CustomerRound,
  delta: MetricDelta,
  reactionKind: ReplyReactionKind,
  comboNotes: string[] = [],
  timingRiskNotes: string[] = [],
  semanticNotes: string[] = [],
): ReplyFeedback {
  const matchedTags = getTagOverlap(card.tags, round.preferredTags);
  const riskyTags = card.tags.includes("pushback")
    ? Array.from(new Set([...getTagOverlap(card.tags, round.riskyTags), "pushback" as const]))
    : getTagOverlap(card.tags, round.riskyTags);
  const metricChanges = pickMeaningfulMetricChanges(delta);

  return {
    matchedTags,
    riskyTags,
    metricChanges,
    reactionKind,
    comboNotes,
    timingRiskNotes,
    semanticNotes,
    message: buildFeedbackMessage(
      matchedTags,
      riskyTags,
      metricChanges,
      reactionKind,
      comboNotes,
      timingRiskNotes,
      semanticNotes,
    ),
  };
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

export function buildDaySummary(
  metrics: Metrics,
  outcomes: CustomerOutcome[],
  coachingStats: CoachingStats,
  timeoutCount: number,
  gradeOffset = 0,
): DaySummary {
  const complaints = outcomes.filter((outcome) => outcome.status !== "resolved").length;
  const rageQuits = outcomes.filter((outcome) => outcome.status === "rage_quit").length;
  const avgSatisfaction =
    outcomes.reduce((total, outcome) => total + outcome.satisfaction, 0) / Math.max(outcomes.length, 1);
  const avgAnger =
    outcomes.reduce((total, outcome) => total + outcome.anger, 0) / Math.max(outcomes.length, 1);
  const totals: Metrics = {
    ...metrics,
    satisfaction: Math.round(avgSatisfaction),
    anger: Math.round(avgAnger),
  };

  // timeLeft 现在是「处理精力」，结束时通常还剩较多（不再被时钟耗光），
  // 系数从 0.15 降到 0.06，让「省精力 = 高效」成为适度加分而非主导项，
  // 避免平庸表现靠剩余时间刷高评级。等级阈值维持不变。
  const score =
    avgSatisfaction * daySummaryScoring.satisfactionWeight +
    metrics.timeLeft * daySummaryScoring.timeLeftWeight -
    metrics.companyCost * daySummaryScoring.companyCostWeight -
    metrics.complianceRisk * daySummaryScoring.complianceRiskWeight -
    complaints * daySummaryScoring.complaintPenalty;

  const grade =
    rageQuits > 0
      ? "D"
      : score >= gradeThresholds.S + gradeOffset
        ? "S"
        : score >= gradeThresholds.A + gradeOffset
          ? "A"
          : score >= gradeThresholds.B + gradeOffset
            ? "B"
            : score >= gradeThresholds.C + gradeOffset
              ? "C"
              : "D";

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
  const diagnostics = buildSummaryDiagnostics(metrics, outcomes, coachingStats, timeoutCount);

  if (rageQuits > 0) {
    return {
      grade,
      title: "大不了不干了",
      supervisorComment: "你确实没有再受气，但主管也确实在打印离职交接单。游戏可以重开，现实别这么玩。",
      totals,
      outcomes,
      diagnostics,
    };
  }

  return {
    grade,
    title: titles[grade],
    supervisorComment: comments[grade],
    totals,
    outcomes,
    diagnostics,
  };
}

function getTagOverlap(source: ToneTag[], target: ToneTag[]) {
  const targetSet = new Set(target);

  return source.filter((tag) => targetSet.has(tag));
}

function pickMeaningfulMetricChanges(delta: MetricDelta): MetricDelta {
  return (Object.keys(delta) as Array<keyof Metrics>).reduce<MetricDelta>((changes, metric) => {
    const value = delta[metric];

    if (value && value !== 0) {
      changes[metric] = Math.round(value);
    }

    return changes;
  }, {});
}

function buildFeedbackMessage(
  matchedTags: ToneTag[],
  riskyTags: ToneTag[],
  metricChanges: MetricDelta,
  reactionKind: ReplyReactionKind,
  comboNotes: string[],
  timingRiskNotes: string[],
  semanticNotes: string[],
) {
  const matchedText =
    matchedTags.length > 0
      ? `命中：${matchedTags.map(getToneTagLabel).join("、")}`
      : "未命中这轮核心诉求";
  const riskyText =
    riskyTags.length > 0
      ? `踩雷：${riskyTags.map(getToneTagLabel).join("、")}`
      : "没有踩到明显雷点";
  const metricText = formatMetricChanges(metricChanges);
  const sequenceText = formatSequenceNotes(comboNotes, timingRiskNotes);
  const semanticText = formatSemanticNotes(semanticNotes);

  return `接待复盘：${matchedText}；${riskyText}；${sequenceText}；${semanticText}；${metricText}。${getReactionHint(reactionKind)}`;
}

function getReactionHint(reactionKind: ReplyReactionKind) {
  if (reactionKind === "success") {
    return "客户明显被你接住了，可以顺势推进具体方案。";
  }

  if (reactionKind === "failure") {
    return "客户没有买账，下一句最好补上具体动作或政策依据。";
  }

  return "客户态度有松动，但还需要更明确的下一步。";
}

function formatMetricChanges(metricChanges: MetricDelta) {
  const items = metricOrder
    .filter((metric) => metricChanges[metric])
    .map((metric) => `${metricLabels[metric]} ${formatSignedMetric(metric, metricChanges[metric] ?? 0)}`);

  if (items.length === 0) {
    return "指标基本不变";
  }

  return `影响：${items.join("，")}`;
}

function formatSequenceNotes(comboNotes: string[], timingRiskNotes: string[]) {
  const notes = [
    ...comboNotes.map((note) => `连招：${note}`),
    ...timingRiskNotes.map((note) => `时机风险：${note}`),
  ];

  if (notes.length === 0) {
    return "节奏：常规衔接";
  }

  return notes.join("；");
}

function formatSemanticNotes(semanticNotes: string[]) {
  if (semanticNotes.length === 0) {
    return "AI语义：按本地意图识别结算";
  }

  return `AI语义：${semanticNotes.join("；")}`;
}

function getAssessmentNotes(assessment?: ReplyAssessment) {
  if (!assessment) return [];

  const notes: string[] = [];

  if (assessment.coachingNote) {
    notes.push(assessment.coachingNote);
  }

  if (assessment.confidence !== undefined && assessment.confidence < 0.45) {
    notes.push("这句表达偏含糊，客户可能只感到被安抚，未看到明确动作");
  }

  return notes.slice(0, 2);
}

function formatSignedMetric(metric: keyof Metrics, value: number) {
  const prefix = value > 0 ? "+" : "";
  const suffix = metric === "companyCost" ? " 元" : metric === "timeLeft" ? " 分" : "";

  return `${prefix}${value}${suffix}`;
}

const metricOrder: Array<keyof Metrics> = [
  "satisfaction",
  "anger",
  "companyCost",
  "complianceRisk",
  "timeLeft",
];

const metricLabels: Record<keyof Metrics, string> = {
  satisfaction: "满意度",
  anger: "怒气",
  companyCost: "成本",
  complianceRisk: "合规",
  timeLeft: "时间",
};

const toneTagLabels: Record<ToneTag, string> = {
  apology: "道歉",
  policy: "政策边界",
  refund_check: "退款复核",
  logistics: "物流追踪",
  compensation: "补偿",
  reject: "明确拒绝",
  supervisor: "主管升级",
  template: "模板话术",
  empathy: "共情",
  investigate: "查证",
  pushback: "硬刚",
};

function getToneTagLabel(tag: ToneTag) {
  return toneTagLabels[tag];
}

function getSequenceModifier(card: ReplyCard, context: ReplyScoringContext): ReplyModifier {
  const previousTags = context.previousReply?.tags ?? [];
  const has = (tag: ToneTag) => card.tags.includes(tag);
  const had = (tag: ToneTag) => previousTags.includes(tag);
  const modifier: ReplyModifier = {
    delta: {},
    reactionBias: 0,
    comboNotes: [],
    timingRiskNotes: [],
  };

  if ((had("apology") || had("empathy")) && (has("investigate") || has("refund_check") || has("logistics"))) {
    addModifier(modifier, {
      delta: { satisfaction: 5, anger: -4 },
      reactionBias: 1,
      comboNote: "先接情绪再推进动作，客户更容易跟着走。",
    });
  }

  if (had("investigate") && (has("policy") || has("refund_check") || has("supervisor"))) {
    addModifier(modifier, {
      delta: { satisfaction: 4, complianceRisk: -3 },
      reactionBias: 1,
      comboNote: "先查证再给边界，方案听起来更可信。",
    });
  }

  if (had("policy") && has("reject")) {
    addModifier(modifier, {
      delta: { anger: -5, complianceRisk: -2 },
      reactionBias: 1,
      comboNote: "先讲依据再拒绝，硬边界不那么像推脱。",
    });
  }

  if (had("policy") && has("compensation")) {
    addModifier(modifier, {
      delta: { satisfaction: 3, complianceRisk: -4 },
      reactionBias: 1,
      comboNote: "先定规则再补偿，承诺更不容易失控。",
    });
  }

  if (had("template") && has("template")) {
    addModifier(modifier, {
      delta: { satisfaction: -6, anger: 8 },
      reactionBias: -2,
      timingRiskNote: "连续模板会让客户觉得你没有看上下文。",
    });
  }

  if (has("compensation") && !had("policy") && !had("investigate") && !had("supervisor")) {
    addModifier(modifier, {
      delta: { complianceRisk: 8, companyCost: 5 },
      reactionBias: -1,
      timingRiskNote: "没有查证或政策铺垫就补偿，客户可能继续试探上限。",
    });
  }

  if (has("reject") && !had("policy") && !had("empathy") && !had("apology")) {
    addModifier(modifier, {
      delta: { satisfaction: -5, anger: 7 },
      reactionBias: -1,
      timingRiskNote: "没有安抚或依据就拒绝，容易被理解成甩锅。",
    });
  }

  if (has("policy") && !had("apology") && !had("empathy") && !had("investigate")) {
    addModifier(modifier, {
      delta: { anger: 4 },
      reactionBias: -1,
      timingRiskNote: "开场直接念规则，情绪型客户会觉得你在挡问题。",
    });
  }

  if (has("template") && context.templateUseCount >= 2) {
    addModifier(modifier, {
      delta: { satisfaction: -4, anger: 6 },
      reactionBias: -1,
      timingRiskNote: "今日模板已经偏多，客户对复制粘贴更敏感。",
    });
  }

  // 去重：同一 timingRiskNote 在最近回合已展示过则不重复推送。
  if (context.recentTimingRiskNotes && context.recentTimingRiskNotes.length > 0) {
    modifier.timingRiskNotes = modifier.timingRiskNotes.filter(
      (note) => !context.recentTimingRiskNotes!.includes(note),
    );
  }

  return modifier;
}

function addModifier(
  modifier: ReplyModifier,
  rule: {
    delta: MetricDelta;
    reactionBias: number;
    comboNote?: string;
    timingRiskNote?: string;
  },
) {
  modifier.delta = mergeDelta(modifier.delta, rule.delta);
  modifier.reactionBias += rule.reactionBias;

  if (rule.comboNote) {
    modifier.comboNotes.push(rule.comboNote);
  }

  if (rule.timingRiskNote) {
    modifier.timingRiskNotes.push(rule.timingRiskNote);
  }
}

function mergeDelta(base: MetricDelta, extra: MetricDelta): MetricDelta {
  return metricOrder.reduce<MetricDelta>((nextDelta, metric) => {
    const value = (base[metric] ?? 0) + (extra[metric] ?? 0);

    if (value !== 0) {
      nextDelta[metric] = value;
    }

    return nextDelta;
  }, {});
}

function buildSummaryDiagnostics(
  metrics: Metrics,
  outcomes: CustomerOutcome[],
  coachingStats: CoachingStats,
  timeoutCount: number,
) {
  const diagnostics: SummaryDiagnostic[] = [];
  const complaints = outcomes.filter((outcome) => outcome.status !== "resolved").length;
  const resolved = outcomes.length - complaints;

  if (complaints === 0 && outcomes.length > 0) {
    diagnostics.push({
      id: "resolved-all",
      title: "收尾稳定",
      body: `今天 ${resolved} 位客户都接受了处理方案，说明你能把情绪安抚和后续动作连起来。`,
      tone: "good",
    });
  } else if (complaints > 0) {
    diagnostics.push({
      id: "complaint-risk",
      title: "异常单偏多",
      body: `${complaints} 位客户没有被稳住。复盘时优先看这些会话里是否过早拒绝、补偿或使用模板。`,
      tone: "risk",
    });
  }

  if (metrics.complianceRisk >= 70) {
    diagnostics.push({
      id: "compliance-high",
      title: "合规压力高",
      body: `合规风险收在 ${metrics.complianceRisk}，已经接近主管强制介入线。高价值承诺前先补政策依据。`,
      tone: "risk",
    });
  } else if (metrics.complianceRisk <= 20) {
    diagnostics.push({
      id: "compliance-low",
      title: "边界感清楚",
      body: "合规风险保持在低位，说明你没有为了快速安抚而乱承诺。",
      tone: "good",
    });
  }

  if (metrics.companyCost >= 70 || coachingStats.compensationUseCount >= 3) {
    diagnostics.push({
      id: "cost-high",
      title: "补偿使用偏重",
      body: `今天用了 ${coachingStats.compensationUseCount} 次补偿，成本来到 ${metrics.companyCost} 元。先查证再补偿会更稳。`,
      tone: "warning",
    });
  } else if (metrics.companyCost <= 30) {
    diagnostics.push({
      id: "cost-low",
      title: "预算守得住",
      body: `公司成本控制在 ${metrics.companyCost} 元，说明你没有把优惠券当万能灭火器。`,
      tone: "good",
    });
  }

  if (coachingStats.templateUseCount >= 2) {
    diagnostics.push({
      id: "template-heavy",
      title: "模板味偏重",
      body: `标准模板用了 ${coachingStats.templateUseCount} 次。高怒气或被动攻击型客户会把它理解成敷衍。`,
      tone: "warning",
    });
  }

  if (coachingStats.comboHitCount >= 3) {
    diagnostics.push({
      id: "combo-good",
      title: "话术衔接漂亮",
      body: `今天打出了 ${coachingStats.comboHitCount} 次有效连招，说明你开始按“安抚、查证、边界、方案”的顺序控场。`,
      tone: "good",
    });
  }

  if (coachingStats.timingRiskCount >= 3) {
    diagnostics.push({
      id: "timing-risk",
      title: "出牌时机偏急",
      body: `有 ${coachingStats.timingRiskCount} 次回复触发时机风险。补偿、拒绝和政策说明最好先铺垫。`,
      tone: "warning",
    });
  }

  if (coachingStats.templateFatigueCount > 0) {
    diagnostics.push({
      id: "template-fatigue",
      title: "模板疲劳出现",
      body: `今日模板疲劳触发 ${coachingStats.templateFatigueCount} 次。越到后面，标准话术越需要配合具体订单信息。`,
      tone: "warning",
    });
  }

  if (coachingStats.riskyTagHits > coachingStats.matchedTagHits) {
    diagnostics.push({
      id: "risky-tags",
      title: "踩雷多于命中",
      body: `话术踩雷 ${coachingStats.riskyTagHits} 次，高于命中 ${coachingStats.matchedTagHits} 次。下一局先读客户提示再出牌。`,
      tone: "warning",
    });
  } else if (coachingStats.matchedTagHits >= coachingStats.replyCount && coachingStats.replyCount > 0) {
    diagnostics.push({
      id: "matched-tags",
      title: "诉求判断准",
      body: `你在 ${coachingStats.replyCount} 次回复里命中 ${coachingStats.matchedTagHits} 个关键诉求，客户反应会更可控。`,
      tone: "good",
    });
  }

  if (timeoutCount > 0) {
    diagnostics.push({
      id: "timeouts",
      title: "等待提醒出现",
      body: `有 ${timeoutCount} 次会话等待超过 2 分钟。并发时优先点开红色提醒，别让情绪自然升温。`,
      tone: "warning",
    });
  } else {
    diagnostics.push({
      id: "no-timeout",
      title: "节奏没有失控",
      body: "没有客户等到红色提醒，说明你在多线会话里切换得比较及时。",
      tone: "good",
    });
  }

  if (coachingStats.freeReplyUseCount >= 3) {
    diagnostics.push({
      id: "free-reply",
      title: "人味够",
      body: "自由回复用得不少，客户会更容易感到自己不是在和自动流程对话。",
      tone: "good",
    });
  } else {
    diagnostics.push({
      id: "free-reply-tip",
      title: "可以多写一句",
      body: "下局试着在关键节点用自由回复补一句具体承诺，系统会按语义识别你的意图。",
      tone: "tip",
    });
  }

  if (metrics.timeLeft <= 10) {
    diagnostics.push({
      id: "time-tight",
      title: "时间压线",
      body: "剩余时间很少，说明部分处理动作过重。事实清楚时可以少查一次，直接给边界和下一步。",
      tone: "warning",
    });
  }

  return diagnostics.slice(0, 5);
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

  return {
    satisfaction: 0,
    anger: 0,
    complianceRisk: 0,
    reactionBias: 0,
  };
}
