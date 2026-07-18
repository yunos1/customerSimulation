import { fatigue as fatigueCfg } from "./balance";
import { buildAssessedBaseReplyCard, buildAssessedReplyCard } from "./freeReply";
import { getActiveRound, shouldResolveCustomer } from "./customerFlow";
import { getReactionLine } from "./reactions";
import {
  applyDelta,
  applyShiftDelta,
  buildReplyFeedback,
  createOutcome,
  scoreReply,
} from "./scoring";
import type {
  Customer,
  CustomerOutcome,
  CustomerRound,
  CustomerSession,
  GameState,
  Metrics,
  ReplyAssessment,
  ReplyCard,
  ReplyReactionKind,
} from "./types";
import {
  appendAgentMessage,
  canResolvePendingReply,
  createMessage,
  getActiveSession,
  getOutcomeLabel,
  getOutcomeLine,
  getPreferredSessionId,
  getSessionById,
  idCounters,
  normalizeAiReactionLine,
  pickSessionMetrics,
  replaceSession,
  trimSessionMessages,
} from "./reducerShared";
import { refreshAchievements, shouldSummarize, summarize } from "./reducerSummary";

export function chooseReply(
  state: GameState,
  cardId: string,
  sessionId?: string,
  aiReactionLine?: string,
  aiAssessment?: ReplyAssessment,
  replyId?: string,
): GameState {
  if (state.phase !== "player_reply") {
    return state;
  }

  const session = sessionId ? getSessionById(state, sessionId) : getActiveSession(state);

  if (!session || session.status !== "active" || !canResolvePendingReply(session, replyId)) {
    return state;
  }

  const card = state.level.replyCards.find((candidate) => candidate.id === cardId);

  if (!card) {
    return state;
  }

  return answerSession(state, session, card, false, aiReactionLine, aiAssessment, replyId);
}

export function submitFreeReply(
  state: GameState,
  text: string,
  sessionId?: string,
  aiReactionLine?: string,
  aiAssessment?: ReplyAssessment,
  replyId?: string,
): GameState {
  if (state.phase !== "player_reply") {
    return state;
  }

  const trimmedText = text.trim();
  const session = sessionId ? getSessionById(state, sessionId) : getActiveSession(state);

  if (!trimmedText || !session || session.status !== "active" || !canResolvePendingReply(session, replyId)) {
    return state;
  }

  return answerSession(
    state,
    session,
    buildAssessedReplyCard(trimmedText, aiAssessment),
    true,
    aiReactionLine,
    aiAssessment,
    replyId,
  );
}

export function answerSession(
  state: GameState,
  session: CustomerSession,
  card: ReplyCard,
  isFreeReply: boolean,
  aiReactionLine?: string,
  aiAssessment?: ReplyAssessment,
  replyId?: string,
): GameState {
  const round = getActiveRound(session.customer, session.activeRoundIndex);
  const nextRoundIndex = session.activeRoundIndex + 1;
  const scoredCard = isFreeReply ? card : buildAssessedBaseReplyCard(card, aiAssessment);

  if (scoredCard.tags.includes("pushback")) {
    return pushBackAtCustomer(state, session, scoredCard, isFreeReply, replyId);
  }

  const { delta, reactionKind, feedback } = scoreReply(session.customer, round, scoredCard, {
    previousReply: getPreviousReply(session),
    templateUseCount: state.coachingStats.templateUseCount,
    recentTimingRiskNotes: state.coachingStats.recentTimingRiskNotes,
    aiAssessment,
  });
  const nextSessionMetrics = applySessionDelta(
    session.metrics,
    state.metrics,
    delta,
  );
  const nextMetrics = applyShiftDelta(state.metrics, delta);
  const nextOutcomeMetrics: Metrics = {
    ...nextMetrics,
    ...nextSessionMetrics,
  };
  const aiLine = normalizeAiReactionLine(aiReactionLine);
  // AI 成功时，回复里已自然承接了下一轮诉求，无需再单独追加 nextRound.prompt；
  // 只有走本地静态回退时，才需要补一条剧本台词，否则玩家不知道客人的新需求。
  const usedAiLine = aiLine !== undefined;
  const reactionLine =
    aiLine ??
    getReactionLine(
      session.customer,
      round,
      scoredCard,
      reactionKind,
      idCounters.messageCounter + session.elapsedSeconds + nextRoundIndex,
    );
  const outcome = maybeBuildOutcome(
    session.customer,
    round,
    nextRoundIndex,
    nextOutcomeMetrics,
    {
      card: scoredCard,
      isAiReactionLine: usedAiLine,
      reactionKind,
      reactionLine,
      aiAssessment,
    },
  );
  const baseMessages = trimSessionMessages([
    ...appendAgentMessage(session.messages, scoredCard.title, replyId),
    createMessage("customer", reactionLine),
    createMessage("system", feedback.message),
  ]);
  const nextCoachingStats = getNextCoachingStats(state, scoredCard, feedback, isFreeReply);

  if (outcome) {
    const nextSession: CustomerSession = {
      ...session,
      activeRoundIndex: nextRoundIndex,
      metrics: nextSessionMetrics,
      replyHistory: [...session.replyHistory, createReplyMemory(scoredCard)],
      status: outcome.status === "resolved" ? "resolved" : "failed",
      outcome,
      pendingReplyId: undefined,
      messages: [
        ...baseMessages,
        createMessage("system", getOutcomeLine(outcome.status)),
      ],
    };
    const replacedSessions = replaceSession(state.sessions, nextSession);
    const nextState: GameState = {
      ...state,
      metrics: { ...nextMetrics },
      fatigue: Math.min(100, state.fatigue + fatigueCfg.perReply),
      sessions: replacedSessions,
      activeSessionId: getPreferredSessionId(replacedSessions, state.activeSessionId),
      outcomes: [...state.outcomes, outcome],
      achievementStats: getNextReplyStats(state, session, scoredCard, outcome, isFreeReply),
      coachingStats: nextCoachingStats,
      shiftMessages: [
        ...state.shiftMessages,
        createMessage("system", `${session.customer.name}会话已结束：${getOutcomeLabel(outcome.status)}。`),
      ],
    };
    const nextStateWithAchievements = refreshAchievements(nextState);

    if (shouldSummarize(nextStateWithAchievements)) {
      return summarize(nextStateWithAchievements);
    }

    return nextStateWithAchievements;
  }

  const nextRound = getActiveRound(session.customer, nextRoundIndex);
  const nextSession: CustomerSession = {
    ...session,
    activeRoundIndex: nextRoundIndex,
    metrics: nextSessionMetrics,
    replyHistory: [...session.replyHistory, createReplyMemory(scoredCard)],
    pendingReplyId: undefined,
    messages: usedAiLine
      ? baseMessages
      : [
          ...baseMessages,
          createMessage("customer", nextRound.prompt),
        ],
  };

  return refreshAchievements({
    ...state,
    metrics: nextMetrics,
    fatigue: Math.min(100, state.fatigue + fatigueCfg.perReply),
    sessions: replaceSession(state.sessions, nextSession),
    achievementStats: getNextReplyStats(state, session, scoredCard, undefined, isFreeReply),
    coachingStats: nextCoachingStats,
  });
}

export function pushBackAtCustomer(
  state: GameState,
  session: CustomerSession,
  card: ReplyCard,
  isFreeReply: boolean,
  replyId?: string,
): GameState {
  const round = getActiveRound(session.customer, session.activeRoundIndex);
  const reactionLine = getReactionLine(
    session.customer,
    round,
    card,
    "failure",
    idCounters.messageCounter + session.elapsedSeconds + session.activeRoundIndex + 91,
  );
  const nextSessionMetrics = applySessionDelta(
    session.metrics,
    state.metrics,
    card.effects,
  );
  const nextShiftMetrics = applyShiftDelta(state.metrics, card.effects);
  const outcome = createRageQuitOutcome(session.customer, nextShiftMetrics);
  const feedback = buildReplyFeedback(card, round, card.effects, "failure");
  const nextSession: CustomerSession = {
    ...session,
    status: "failed",
    metrics: nextSessionMetrics,
    replyHistory: [...session.replyHistory, createReplyMemory(card)],
    pendingReplyId: undefined,
    outcome,
    messages: [
      ...appendAgentMessage(session.messages, card.title, replyId),
      createMessage("customer", reactionLine),
      createMessage("system", feedback.message),
      createMessage("system", "硬刚结局：你把耳麦一摘，今日绩效开始冒烟。"),
    ],
  };
  const replacedSessions = replaceSession(state.sessions, nextSession);
  const nextState = refreshAchievements({
    ...state,
    metrics: nextShiftMetrics,
    sessions: replacedSessions,
    activeSessionId: getPreferredSessionId(replacedSessions, state.activeSessionId),
    outcomes: [...state.outcomes, outcome],
    achievementStats: {
      ...getNextReplyStats(state, session, card, outcome, isFreeReply),
      rageQuitCount: state.achievementStats.rageQuitCount + 1,
    },
    coachingStats: getNextCoachingStats(state, card, feedback, isFreeReply),
    shiftMessages: [
      ...state.shiftMessages,
      createMessage("system", `${session.customer.name}被你怼回去了：触发硬刚结局。`),
    ],
  });

  if (shouldSummarize(nextState)) {
    return summarize(nextState);
  }

  return nextState;
}

export function maybeBuildOutcome(
  customer: Customer,
  round: CustomerRound,
  nextRoundIndex: number,
  metrics: Metrics,
  resolutionContext?: {
    card: ReplyCard;
    isAiReactionLine: boolean;
    reactionKind: ReplyReactionKind;
    reactionLine: string;
    aiAssessment?: ReplyAssessment;
  },
) {
  if (
    metrics.anger >= 100 ||
    metrics.satisfaction <= 10 ||
    metrics.complianceRisk >= 100
  ) {
    return createOutcome(customer, metrics);
  }

  const aiResolutionDecision = getAiResolutionDecision(resolutionContext?.aiAssessment);

  if (aiResolutionDecision === "resolved") {
    return createOutcome(customer, metrics);
  }

  if (aiResolutionDecision === "continue") {
    return undefined;
  }

  if (
    shouldResolveCustomer(customer, round, nextRoundIndex, metrics.satisfaction, metrics.anger) ||
    (resolutionContext &&
      resolutionContext.isAiReactionLine &&
      shouldAcceptResolutionFromReaction(
        resolutionContext.card,
        resolutionContext.reactionKind,
        resolutionContext.reactionLine,
      ))
  ) {
    return createOutcome(customer, metrics);
  }

  return undefined;
}

export function getAiResolutionDecision(assessment?: ReplyAssessment) {
  if (!assessment) {
    return undefined;
  }

  if (assessment.issueResolved === true && assessment.customerIntent === "accepted") {
    return "resolved" as const;
  }

  if (assessment.issueResolved === true && assessment.reactionKind === "success") {
    return "resolved" as const;
  }

  if (
    assessment.issueResolved === false ||
    assessment.customerIntent === "still_concerned" ||
    assessment.customerIntent === "needs_info" ||
    assessment.customerIntent === "escalating"
  ) {
    return "continue" as const;
  }

  return undefined;
}

export function shouldAcceptResolutionFromReaction(
  card: ReplyCard,
  reactionKind: ReplyReactionKind,
  reactionLine: string,
) {
  if (reactionKind === "failure" || !hasResolutionIntent(card)) {
    return false;
  }

  const normalizedLine = reactionLine.trim().replace(/\s+/g, "");

  if (!normalizedLine || hasOpenConcern(normalizedLine)) {
    return false;
  }

  return acceptancePatterns.some((pattern) => pattern.test(normalizedLine));
}

export function hasResolutionIntent(card: ReplyCard) {
  const resolutionTags: Array<ReplyCard["tags"][number]> = [
    "refund_check",
    "logistics",
    "policy",
    "compensation",
    "reject",
    "supervisor",
  ];

  return (
    card.tags.some((tag) => resolutionTags.includes(tag)) ||
    /工单|回访|复核|退款|退货|补发|主管|升级|方案|处理节点/.test(card.title)
  );
}

export function hasOpenConcern(line: string) {
  return openConcernPatterns.some((pattern) => pattern.test(line));
}

const acceptancePatterns = [
  /我(先|暂时|就)?接受/,
  /可以.*(先等|等结果|等回访|等答复|等正式反馈|接受|不投诉)/,
  /行.*(先等|等结果|等回访|等答复|等正式反馈|接受|不投诉|按.*(处理|推进|复核|流程|工单))/,
  /好.*(先等|等结果|等回访|等答复|等正式反馈|接受|不投诉|按.*(处理|推进|复核|流程|工单))/,
  /那就按.*(处理|推进|复核|流程|工单|方案)/,
  /按.*(处理|推进|复核|流程|工单|方案).*来/,
  /我(就|先|暂时)?等(你|你们|结果|回访|答复|正式反馈)/,
  /等(你|你们)?(正式)?(反馈|答复|回访|结果)/,
  /先这样/,
  /(暂时|先)?不投诉/,
  /保存.*(结论|记录)/,
  /我先不上/,
];

const openConcernPatterns = [
  /[？?]/,
  /多久|多长时间|什么时候|何时/,
  /能不能|可不可以|是不是|有没有|到底|怎么|什么|为什么|谁来|谁负责/,
  /还(是)?想问|还要问|我还想/,
  /但(是)?你(得|要|必须)|不过.*(想问|告诉我|说明)/,
  /如果.*怎么办/,
];

export function applySessionDelta(
  sessionMetrics: CustomerSession["metrics"],
  shiftMetrics: Metrics,
  delta: ReplyCard["effects"],
) {
  return pickSessionMetrics(applyDelta({ ...shiftMetrics, ...sessionMetrics }, delta));
}

export function createRageQuitOutcome(customer: Customer, metrics: Metrics): CustomerOutcome {
  return {
    customerId: customer.id,
    customerName: customer.name,
    status: "rage_quit",
    satisfaction: 0,
    anger: 100,
    notes: [
      "客服直接怼回客户，触发硬刚结局。",
      `合规风险升至 ${metrics.complianceRisk}，主管开始找人。`,
    ],
  };
}

export function createTimeLimitOutcome(
  customer: Customer,
  sessionMetrics: CustomerSession["metrics"],
  shiftMetrics: Metrics,
): CustomerOutcome {
  const status: CustomerOutcome["status"] =
    shiftMetrics.complianceRisk >= 100 ? "compliance_escalation" : "complaint";

  return {
    customerId: customer.id,
    customerName: customer.name,
    status,
    satisfaction: sessionMetrics.satisfaction,
    anger: sessionMetrics.anger,
    notes: [
      "值班时间耗尽，会话未能在当天完成。",
      status === "compliance_escalation" ? "合规风险过高，主管强制介入。" : "客户等待处理超时，转为投诉记录。",
    ],
  };
}

export function getNextReplyStats(
  state: GameState,
  session: CustomerSession,
  card: ReplyCard,
  outcome: CustomerOutcome | undefined,
  isFreeReply: boolean,
) {
  const replySeconds = session.elapsedSeconds;
  const isResolved = outcome?.status === "resolved";
  // 成就「先查再说」：上一张是查证，这一张是政策（标准合规顺序）。
  // 用当前出牌 + 历史上一张判断，而不是依赖「解决时上一张是查证」的弱条件。
  const previous = getPreviousReply(session);
  const investigateThenPolicy =
    Boolean(previous?.tags.includes("investigate")) && card.tags.includes("policy");

  return {
    ...state.achievementStats,
    resolvedCount:
      state.achievementStats.resolvedCount + (outcome?.status === "resolved" ? 1 : 0),
    complaintCount:
      state.achievementStats.complaintCount +
      (outcome && outcome.status !== "resolved" ? 1 : 0),
    freeReplyCount: state.achievementStats.freeReplyCount + (isFreeReply ? 1 : 0),
    fastestReplySeconds: Math.min(state.achievementStats.fastestReplySeconds, replySeconds),
    savedAngryCustomerCount:
      state.achievementStats.savedAngryCustomerCount +
      (isResolved && session.customer.initialMetrics.anger >= 70 ? 1 : 0),
    recoveredLowSatisfactionCount:
      state.achievementStats.recoveredLowSatisfactionCount +
      (isResolved && session.customer.initialMetrics.satisfaction < 40 ? 1 : 0),
    investigatePolicyComboCount:
      state.achievementStats.investigatePolicyComboCount + (investigateThenPolicy ? 1 : 0),
    consecutiveNoTimeoutCount: session.timeoutCounted
      ? 0
      : state.achievementStats.consecutiveNoTimeoutCount + 1,
  };
}

export function getNextCoachingStats(
  state: GameState,
  card: ReplyCard,
  feedback: {
    matchedTags: ReplyCard["tags"];
    riskyTags: ReplyCard["tags"];
    comboNotes: string[];
    timingRiskNotes: string[];
  },
  isFreeReply: boolean,
) {
  const has = (tag: ReplyCard["tags"][number]) => card.tags.includes(tag);
  const hasTemplateFatigue = feedback.timingRiskNotes.some((note) => note.includes("模板"));

  return {
    ...state.coachingStats,
    replyCount: state.coachingStats.replyCount + 1,
    matchedTagHits: state.coachingStats.matchedTagHits + feedback.matchedTags.length,
    riskyTagHits: state.coachingStats.riskyTagHits + feedback.riskyTags.length,
    comboHitCount: state.coachingStats.comboHitCount + feedback.comboNotes.length,
    timingRiskCount: state.coachingStats.timingRiskCount + feedback.timingRiskNotes.length,
    templateFatigueCount:
      state.coachingStats.templateFatigueCount + (hasTemplateFatigue ? 1 : 0),
    templateUseCount: state.coachingStats.templateUseCount + (has("template") ? 1 : 0),
    compensationUseCount: state.coachingStats.compensationUseCount + (has("compensation") ? 1 : 0),
    policyUseCount: state.coachingStats.policyUseCount + (has("policy") ? 1 : 0),
    investigationUseCount:
      state.coachingStats.investigationUseCount + (has("investigate") ? 1 : 0),
    empathyUseCount:
      state.coachingStats.empathyUseCount + (has("empathy") || has("apology") ? 1 : 0),
    supervisorUseCount: state.coachingStats.supervisorUseCount + (has("supervisor") ? 1 : 0),
    pushbackUseCount: state.coachingStats.pushbackUseCount + (has("pushback") ? 1 : 0),
    freeReplyUseCount: state.coachingStats.freeReplyUseCount + (isFreeReply ? 1 : 0),
    // 滚动窗口：把本次展示的提示追加进去，保留最近3条（按提示文本去重的滑动集合）。
    recentTimingRiskNotes: [...state.coachingStats.recentTimingRiskNotes, ...feedback.timingRiskNotes].slice(-3),
  };
}

export function getPreviousReply(session: CustomerSession) {
  return session.replyHistory[session.replyHistory.length - 1];
}

export function createReplyMemory(card: ReplyCard) {
  return {
    cardId: card.id,
    tags: card.tags,
  };
}

