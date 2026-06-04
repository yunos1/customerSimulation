import { activeDay } from "../content/levels";
import { getUnlockedAchievements } from "../content/achievements";
import { buildRandomizedCustomers } from "./customerGenerator";
import { buildFreeReplyCard } from "./freeReply";
import { getActiveRound, shouldResolveCustomer } from "./customerFlow";
import { getReactionLine } from "./reactions";
import {
  applyDelta,
  applyShiftDelta,
  buildDaySummary,
  buildReplyFeedback,
  createOutcome,
  scoreReply,
} from "./scoring";
import type {
  ChatMessage,
  Customer,
  CustomerOutcome,
  CustomerRound,
  CustomerSession,
  AchievementId,
  GameAction,
  GameState,
  LevelConfig,
  Metrics,
  ReplyCard,
} from "./types";

const timeoutAlertSeconds = 120;
const maxOpenSessions = 3;
const minArrivalDelay = 18;
const maxArrivalDelay = 35;
const randomEventChance = 20;

let messageCounter = 0;
let sessionCounter = 0;

export function createInitialState(level: LevelConfig, seed = Date.now()): GameState {
  const randomizedLevel = {
    ...level,
    customers: buildRandomizedCustomers(level.customers, seed),
  };

  return {
    level: randomizedLevel,
    phase: "intro",
    metrics: {
      ...randomizedLevel.baseMetrics,
    },
    sessions: [],
    activeSessionId: undefined,
    connectedCustomerIds: [],
    shiftMessages: [
      createMessage(
        "system",
        `${randomizedLevel.title}｜${randomizedLevel.briefing}`,
      ),
    ],
    nextArrivalIn: getArrivalDelay(randomizedLevel.id.length + seed),
    outcomes: [],
    achievements: [],
    triggeredEventIds: [],
    achievementStats: {
      resolvedCount: 0,
      complaintCount: 0,
      timeoutCount: 0,
      maxConcurrentSessions: 0,
      freeReplyCount: 0,
      fastestReplySeconds: Number.POSITIVE_INFINITY,
      savedAngryCustomerCount: 0,
      recoveredLowSatisfactionCount: 0,
      rageQuitCount: 0,
    },
    coachingStats: {
      replyCount: 0,
      matchedTagHits: 0,
      riskyTagHits: 0,
      templateUseCount: 0,
      compensationUseCount: 0,
      policyUseCount: 0,
      investigationUseCount: 0,
      empathyUseCount: 0,
      supervisorUseCount: 0,
      pushbackUseCount: 0,
      freeReplyUseCount: 0,
    },
  };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "START_DAY":
      return startDay(state, action.seed);

    case "TICK":
      return tick(state, action.seed);

    case "SELECT_SESSION":
      return selectSession(state, action.sessionId);

    case "OPEN_TIMEOUT_ALERT":
      return openTimeoutAlert(state, action.sessionId);

    case "CHOOSE_REPLY":
      return chooseReply(state, action.cardId);

    case "SUBMIT_FREE_REPLY":
      return submitFreeReply(state, action.text);

    case "RESTART_DAY":
      messageCounter = 0;
      sessionCounter = 0;
      return createInitialState(activeDay, action.seed);

    default:
      return state;
  }
}

export function getActiveSession(state: GameState) {
  return state.sessions.find((session) => session.id === state.activeSessionId);
}

function startDay(state: GameState, seed: number): GameState {
  if (state.phase !== "intro") {
    return state;
  }

  return connectRandomCustomer(
    {
      ...state,
      phase: "player_reply",
      shiftMessages: [
        ...state.shiftMessages,
        createMessage("system", "值班开始：系统会随机接入客户，客户等待超过 2 分钟会触发红色提醒。"),
      ],
    },
    seed,
  );
}

function tick(state: GameState, seed: number): GameState {
  if (state.phase === "intro" || state.phase === "summary") {
    return state;
  }

  const metricsAfterClock = applyShiftDelta(state.metrics, { timeLeft: -1 });
  const nextSessions = state.sessions.map((session): CustomerSession => {
    if (session.status !== "active") {
      return session;
    }

    return {
      ...session,
      elapsedSeconds: session.elapsedSeconds + 1,
      timeoutCounted:
        session.timeoutCounted || session.elapsedSeconds + 1 >= timeoutAlertSeconds,
    };
  });
  const newTimeoutAlertCount = nextSessions.filter(
    (session, index) =>
      session.status === "active" &&
      session.timeoutCounted &&
      !state.sessions[index]?.timeoutCounted,
  ).length;

  const nextState: GameState = {
    ...state,
    metrics: metricsAfterClock,
    sessions: nextSessions,
    activeSessionId: getPreferredSessionId(nextSessions, state.activeSessionId),
    achievementStats:
      newTimeoutAlertCount > 0
        ? {
            ...state.achievementStats,
            timeoutCount: state.achievementStats.timeoutCount + newTimeoutAlertCount,
          }
        : state.achievementStats,
  };

  const nextStateWithEvent = maybeTriggerRandomEvent(nextState, seed);
  const nextStateWithTimeLimit =
    nextStateWithEvent.metrics.timeLeft <= 0
      ? closeActiveSessionsForTimeLimit(nextStateWithEvent)
      : nextStateWithEvent;
  const nextStateWithAchievements = refreshAchievements(nextStateWithTimeLimit);

  if (shouldSummarize(nextStateWithAchievements)) {
    return summarize(nextStateWithAchievements);
  }

  if (nextStateWithAchievements.metrics.timeLeft <= 0) {
    return summarize(nextStateWithAchievements);
  }

  if (
    hasAvailableCustomer(nextStateWithAchievements) &&
    countActiveSessions(nextStateWithAchievements.sessions) < maxOpenSessions
  ) {
    const nextArrivalIn = Math.max(0, state.nextArrivalIn - 1);

    if (nextArrivalIn <= 0) {
      return connectRandomCustomer(nextStateWithAchievements, seed + messageCounter + sessionCounter);
    }

    return {
      ...nextStateWithAchievements,
      nextArrivalIn,
    };
  }

  return {
    ...nextStateWithAchievements,
  };
}

function selectSession(state: GameState, sessionId: string): GameState {
  if (state.phase === "intro" || state.phase === "summary") {
    return state;
  }

  const session = state.sessions.find((candidate) => candidate.id === sessionId);

  if (!session) {
    return state;
  }

  return {
    ...state,
    activeSessionId: session.id,
  };
}

function openTimeoutAlert(state: GameState, sessionId: string): GameState {
  if (state.phase === "intro" || state.phase === "summary") {
    return state;
  }

  const session = state.sessions.find((candidate) => candidate.id === sessionId);

  if (!session) {
    return state;
  }

  return {
    ...state,
    activeSessionId: session.id,
    sessions: state.sessions.map((candidate) =>
      candidate.id === session.id
        ? {
            ...candidate,
            timeoutAlertDismissed: true,
          }
        : candidate,
    ),
  };
}

function chooseReply(state: GameState, cardId: string): GameState {
  if (state.phase !== "player_reply") {
    return state;
  }

  const session = getActiveSession(state);

  if (!session || session.status !== "active") {
    return state;
  }

  const card = state.level.replyCards.find((candidate) => candidate.id === cardId);

  if (!card) {
    return state;
  }

  return answerSession(state, session, card, false);
}

function submitFreeReply(state: GameState, text: string): GameState {
  if (state.phase !== "player_reply") {
    return state;
  }

  const trimmedText = text.trim();
  const session = getActiveSession(state);

  if (!trimmedText || !session || session.status !== "active") {
    return state;
  }

  return answerSession(state, session, buildFreeReplyCard(trimmedText), true);
}

function answerSession(
  state: GameState,
  session: CustomerSession,
  card: ReplyCard,
  isFreeReply: boolean,
): GameState {
  const round = getActiveRound(session.customer, session.activeRoundIndex);
  const nextRoundIndex = session.activeRoundIndex + 1;

  if (card.tags.includes("pushback")) {
    return pushBackAtCustomer(state, session, card, isFreeReply);
  }

  const { delta, reactionKind, feedback } = scoreReply(session.customer, round, card);
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
  const reactionLine = getReactionLine(
    session.customer,
    round,
    card,
    reactionKind,
    messageCounter + session.elapsedSeconds + nextRoundIndex,
  );
  const outcome = maybeBuildOutcome(
    session.customer,
    round,
    nextRoundIndex,
    nextOutcomeMetrics,
  );
  const baseMessages = [
    ...session.messages,
    createMessage("agent", card.title),
    createMessage("customer", reactionLine),
    createMessage("system", feedback.message),
  ];
  const nextCoachingStats = getNextCoachingStats(state, card, feedback, isFreeReply);

  if (outcome) {
    const nextSession: CustomerSession = {
      ...session,
      activeRoundIndex: nextRoundIndex,
      metrics: nextSessionMetrics,
      status: outcome.status === "resolved" ? "resolved" : "failed",
      outcome,
      messages: [
        ...baseMessages,
        createMessage("system", getOutcomeLine(outcome.status)),
      ],
    };
    const replacedSessions = replaceSession(state.sessions, nextSession);
    const nextState: GameState = {
      ...state,
      metrics: {
        ...nextMetrics,
      },
      sessions: replacedSessions,
      activeSessionId: getPreferredSessionId(replacedSessions, state.activeSessionId),
      outcomes: [...state.outcomes, outcome],
      achievementStats: getNextReplyStats(state, session, outcome, isFreeReply),
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
    messages: [
      ...baseMessages,
      createMessage("customer", nextRound.prompt),
    ],
  };

  return refreshAchievements({
    ...state,
    metrics: nextMetrics,
    sessions: replaceSession(state.sessions, nextSession),
    achievementStats: getNextReplyStats(state, session, undefined, isFreeReply),
    coachingStats: nextCoachingStats,
  });
}

function pushBackAtCustomer(
  state: GameState,
  session: CustomerSession,
  card: ReplyCard,
  isFreeReply: boolean,
): GameState {
  const round = getActiveRound(session.customer, session.activeRoundIndex);
  const reactionLine = getReactionLine(
    session.customer,
    round,
    card,
    "failure",
    messageCounter + session.elapsedSeconds + session.activeRoundIndex + 91,
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
    outcome,
    messages: [
      ...session.messages,
      createMessage("agent", card.title),
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
      ...getNextReplyStats(state, session, outcome, isFreeReply),
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

function connectRandomCustomer(state: GameState, seed: number): GameState {
  const customer = pickRandomUnconnectedCustomer(state, seed);

  if (!customer) {
    return {
      ...state,
      nextArrivalIn: 0,
    };
  }

  const session = createSession(customer);

  return refreshAchievements({
    ...state,
    activeSessionId: getPreferredSessionId([...state.sessions, session], state.activeSessionId),
    connectedCustomerIds: [...state.connectedCustomerIds, customer.id],
    nextArrivalIn: getArrivalDelay(seed + customer.id.length),
    sessions: [...state.sessions, session],
    achievementStats: {
      ...state.achievementStats,
      maxConcurrentSessions: Math.max(
        state.achievementStats.maxConcurrentSessions,
        countActiveSessions([...state.sessions, session]),
      ),
    },
    shiftMessages: [
      ...state.shiftMessages,
      createMessage("system", `新客户随机接入：${customer.name}。`),
    ],
  });
}

function maybeTriggerRandomEvent(state: GameState, seed: number): GameState {
  const availableEvents = state.level.possibleEvents.filter(
    (event) => !state.triggeredEventIds.includes(event.id),
  );

  if (availableEvents.length === 0 || getSeededIndex(seed, randomEventChance) !== 0) {
    return state;
  }

  const event = availableEvents[getSeededIndex(seed + messageCounter, availableEvents.length)];
  const nextMetrics = applyShiftDelta(state.metrics, event.effects);

  return {
    ...state,
    metrics: nextMetrics,
    triggeredEventIds: [...state.triggeredEventIds, event.id],
    shiftMessages: [
      ...state.shiftMessages,
      createMessage("system", `突发事件：${event.title}。${event.description}`),
    ],
  };
}

function closeActiveSessionsForTimeLimit(state: GameState): GameState {
  const activeSessions = state.sessions.filter((session) => session.status === "active");

  if (activeSessions.length === 0) {
    return state;
  }

  const timedOutSessions = activeSessions.map((session) => {
    const outcome = createTimeLimitOutcome(session.customer, session.metrics, state.metrics);

    return {
      ...session,
      status: "failed" as const,
      outcome,
      messages: [
        ...session.messages,
        createMessage("system", "值班时间耗尽：未完成会话已转为异常记录。"),
      ],
    };
  });
  const outcomes = timedOutSessions.map((session) => session.outcome);
  const replacedSessions = state.sessions.map((session) =>
    timedOutSessions.find((candidate) => candidate.id === session.id) ?? session,
  );

  return {
    ...state,
    sessions: replacedSessions,
    activeSessionId: getPreferredSessionId(replacedSessions, state.activeSessionId),
    outcomes: [...state.outcomes, ...outcomes],
    achievementStats: {
      ...state.achievementStats,
      complaintCount: state.achievementStats.complaintCount + outcomes.length,
    },
    shiftMessages: [
      ...state.shiftMessages,
      createMessage("system", "剩余时间归零，系统已结束所有未完成会话。"),
    ],
  };
}

function createSession(customer: Customer): CustomerSession {
  const firstRound = getActiveRound(customer, 0);
  sessionCounter += 1;

  return {
    id: `session-${sessionCounter}-${customer.id}`,
    customer,
    activeRoundIndex: 0,
    metrics: {
      ...customer.initialMetrics,
    },
    messages: [
      createMessage("system", `新会话接入：${customer.name}。`),
      createMessage("customer", customer.opening),
      createMessage("customer", firstRound.prompt),
    ],
    status: "active",
    elapsedSeconds: 0,
    timeoutCounted: false,
    timeoutAlertDismissed: false,
  };
}

function maybeBuildOutcome(
  customer: Customer,
  round: CustomerRound,
  nextRoundIndex: number,
  metrics: Metrics,
) {
  if (
    metrics.anger >= 100 ||
    metrics.satisfaction <= 10 ||
    metrics.complianceRisk >= 100 ||
    shouldResolveCustomer(customer, round, nextRoundIndex, metrics.satisfaction, metrics.anger)
  ) {
    return createOutcome(customer, metrics);
  }

  return undefined;
}

function applySessionDelta(
  sessionMetrics: CustomerSession["metrics"],
  shiftMetrics: Metrics,
  delta: ReplyCard["effects"],
) {
  return pickSessionMetrics(applyDelta({ ...shiftMetrics, ...sessionMetrics }, delta));
}

function createRageQuitOutcome(customer: Customer, metrics: Metrics): CustomerOutcome {
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

function createTimeLimitOutcome(
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

function summarize(state: GameState): GameState {
  const summary = buildDaySummary(
    state.metrics,
    state.outcomes,
    state.coachingStats,
    state.achievementStats.timeoutCount,
  );
  const stateWithSummary = refreshAchievements({
    ...state,
    phase: "summary",
    summary,
  });

  return {
    ...stateWithSummary,
    summary,
    activeSessionId: undefined,
    shiftMessages: [
      ...stateWithSummary.shiftMessages,
      createMessage("system", "今日会话已全部处理完毕，主管正在生成绩效记录。"),
    ],
  };
}

function shouldSummarize(state: GameState) {
  return (
    state.connectedCustomerIds.length >= state.level.customers.length &&
    state.sessions.length > 0 &&
    state.sessions.every((session) => session.status !== "active")
  );
}

function pickRandomUnconnectedCustomer(state: GameState, seed: number) {
  const candidates = state.level.customers.filter(
    (customer) => !state.connectedCustomerIds.includes(customer.id),
  );

  if (candidates.length === 0) {
    return undefined;
  }

  return candidates[getSeededIndex(seed, candidates.length)];
}

function hasAvailableCustomer(state: GameState) {
  return state.connectedCustomerIds.length < state.level.customers.length;
}

function countActiveSessions(sessions: CustomerSession[]) {
  return sessions.filter((session) => session.status === "active").length;
}

function replaceSession(sessions: CustomerSession[], nextSession: CustomerSession) {
  return sessions.map((session) => (session.id === nextSession.id ? nextSession : session));
}

function getPreferredSessionId(sessions: CustomerSession[], currentSessionId?: string) {
  const currentSession = sessions.find((session) => session.id === currentSessionId);

  if (currentSession?.status === "active") {
    return currentSession.id;
  }

  const nextActiveSession = sessions.find((session) => session.status === "active");

  return nextActiveSession?.id ?? currentSession?.id ?? sessions[0]?.id;
}

function pickSessionMetrics(metrics: Metrics) {
  return {
    satisfaction: metrics.satisfaction,
    anger: metrics.anger,
  };
}

function getNextReplyStats(
  state: GameState,
  session: CustomerSession,
  outcome: CustomerOutcome | undefined,
  isFreeReply: boolean,
) {
  const replySeconds = session.elapsedSeconds;
  const isResolved = outcome?.status === "resolved";

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
  };
}

function getNextCoachingStats(
  state: GameState,
  card: ReplyCard,
  feedback: { matchedTags: ReplyCard["tags"]; riskyTags: ReplyCard["tags"] },
  isFreeReply: boolean,
) {
  const has = (tag: ReplyCard["tags"][number]) => card.tags.includes(tag);

  return {
    ...state.coachingStats,
    replyCount: state.coachingStats.replyCount + 1,
    matchedTagHits: state.coachingStats.matchedTagHits + feedback.matchedTags.length,
    riskyTagHits: state.coachingStats.riskyTagHits + feedback.riskyTags.length,
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
  };
}

function refreshAchievements(state: GameState): GameState {
  const nextAchievements = getUnlockedAchievements(state);
  const newlyUnlockedAchievements = nextAchievements.filter(
    (achievementId) => !state.achievements.includes(achievementId),
  );

  if (newlyUnlockedAchievements.length === 0) {
    return {
      ...state,
      achievements: nextAchievements,
    };
  }

  return {
    ...state,
    achievements: nextAchievements,
    shiftMessages: [
      ...state.shiftMessages,
      ...newlyUnlockedAchievements.map((achievementId) =>
        createMessage("system", `成就解锁：${getAchievementTitle(achievementId)}。`),
      ),
    ],
  };
}

function getAchievementTitle(achievementId: AchievementId) {
  const titles: Record<AchievementId, string> = {
    "first-save": "第一单稳住",
    "perfect-shift": "零投诉下班",
    "cool-headed": "情绪灭火器",
    "policy-shield": "合规护盾",
    "budget-keeper": "公司钱包还活着",
    "speed-responder": "秒回选手",
    "multi-tasker": "三线并行",
    "human-touch": "不是复制粘贴",
    "no-timeout": "不让客户干等",
    comeback: "逆风翻盘",
    "rage-quit": "大不了不干了",
  };

  return titles[achievementId];
}

function getArrivalDelay(seed: number) {
  return minArrivalDelay + getSeededIndex(seed, maxArrivalDelay - minArrivalDelay + 1);
}

function getSeededIndex(seed: number, length: number) {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return Math.abs(Math.floor(x)) % length;
}

function getOutcomeLine(status: CustomerOutcome["status"]) {
  if (status === "resolved") {
    return "会话已结束：客户接受了当前处理方案。";
  }

  if (status === "compliance_escalation") {
    return "会话已升级：主管发现合规风险过高。";
  }

  if (status === "rage_quit") {
    return "硬刚结局：客服选择不再忍，客户直接投诉。";
  }

  return "会话已结束：客户提交了投诉记录。";
}

function getOutcomeLabel(status: CustomerOutcome["status"]) {
  if (status === "resolved") {
    return "已解决";
  }

  if (status === "compliance_escalation") {
    return "主管介入";
  }

  if (status === "rage_quit") {
    return "硬刚离席";
  }

  return "投诉";
}

function createMessage(speaker: ChatMessage["speaker"], text: string): ChatMessage {
  messageCounter += 1;

  return {
    id: `msg-${messageCounter}`,
    speaker,
    text,
  };
}
