import { getUnlockedAchievements } from "../content/achievements";
import { difficultyPresets, fatigue as fatigueCfg, holiday as holidayCfg, sessionTiming } from "./balance";
import { buildRandomizedCustomers } from "./customerGenerator";
import { buildAssessedReplyCard } from "./freeReply";
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
  ReplyAssessment,
  ReplyCard,
  ReplyReactionKind,
} from "./types";

const timeoutAlertSeconds = sessionTiming.timeoutAlertSeconds;
const maxOpenSessions = sessionTiming.maxOpenSessions;
const minArrivalDelay = sessionTiming.minArrivalDelay;
const maxArrivalDelay = sessionTiming.maxArrivalDelay;
const randomEventChance = sessionTiming.randomEventChance;
/** 单会话消息列表最多保留条数，超出时截去最早的非系统消息（保留首条系统接入消息）。 */
const maxSessionMessages = 80;

let messageCounter = 0;
let sessionCounter = 0;

export function createInitialState(level: LevelConfig, seed = Date.now()): GameState {
  // 重置 scratch 计数器；下面的 createMessage 会推进 messageCounter。
  messageCounter = 0;
  sessionCounter = 0;
  const runId = seed;

  const randomizedLevel = {
    ...level,
    customers: buildRandomizedCustomers(level.customers, seed, level.generation),
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
      investigatePolicyComboCount: 0,
      consecutiveNoTimeoutCount: 0,
    },
    coachingStats: {
      replyCount: 0,
      matchedTagHits: 0,
      riskyTagHits: 0,
      comboHitCount: 0,
      timingRiskCount: 0,
      templateFatigueCount: 0,
      templateUseCount: 0,
      compensationUseCount: 0,
      policyUseCount: 0,
      investigationUseCount: 0,
      empathyUseCount: 0,
      supervisorUseCount: 0,
      pushbackUseCount: 0,
      freeReplyUseCount: 0,
      recentTimingRiskNotes: [],
    },
    // 写回 scratch 计数器的当前值（上面 shiftMessages 已推进了 messageCounter）。
    messageCounter,
    sessionCounter,
    runId,
    fatigue: 0,
  };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  // 把 state 里的计数器同步到模块级 scratch 变量，内部各 createMessage/createSession
  // 照常推进它们；出口再写回结果。这样 reducer 对外是纯函数：同一 (state, action)
  // 永远得到同一结果，StrictMode 双调用也不会让 id / seed 漂移。
  messageCounter = state.messageCounter;
  sessionCounter = state.sessionCounter;

  const nextState = runReducer(state, action);

  if (nextState === state) {
    return state;
  }

  return {
    ...nextState,
    messageCounter,
    sessionCounter,
  };
}

function runReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "LOAD_DAY":
      // 进入/切换到某一天：用该天的 level 重建初始 state（intro 阶段）。
      return createInitialState(action.level, action.seed);

    case "START_DAY":
      return startDay(state, action.seed);

    case "TICK":
      return tick(state, action.seed);

    case "SELECT_SESSION":
      return selectSession(state, action.sessionId);

    case "OPEN_TIMEOUT_ALERT":
      return openTimeoutAlert(state, action.sessionId);

    case "CHOOSE_REPLY":
      return chooseReply(
        state,
        action.cardId,
        action.sessionId,
        action.aiReactionLine,
        action.aiAssessment,
        action.replyId,
      );

    case "SUBMIT_FREE_REPLY":
      return submitFreeReply(
        state,
        action.text,
        action.sessionId,
        action.aiReactionLine,
        action.aiAssessment,
        action.replyId,
      );

    case "ADD_AGENT_MESSAGE": {
      const session = getSessionById(state, action.sessionId);
      if (!session) return state;
      const lastMessage = session.messages[session.messages.length - 1];
      if (lastMessage?.speaker === "agent" && lastMessage.text.trim() === action.text.trim()) {
        return state;
      }
      const nextSession = {
        ...session,
        pendingReplyId: action.replyId ?? session.pendingReplyId,
        messages: appendAgentMessage(session.messages, action.text, action.replyId),
      };
      return { ...state, sessions: replaceSession(state.sessions, nextSession) };
    }

    case "RESTART_DAY":
      // 重试当前天：由调用方传入要重置到的 level（不再硬编码 activeDay）。
      // createInitialState 内部会重置 scratch 计数器。
      return createInitialState(action.level, action.seed);

    default:
      return state;
  }
}

export function getActiveSession(state: GameState) {
  return state.sessions.find((session) => session.id === state.activeSessionId);
}

function getSessionById(state: GameState, sessionId: string) {
  return state.sessions.find((session) => session.id === sessionId);
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

  // timeLeft 不再随每秒时钟流逝，改为纯粹的「处理精力」——只被玩家的回复动作消耗。
  // 这样玩家可以从容读客户、想策略，而不是被秒表追着提前下班。
  // 「等待 2 分钟红色提醒」基于真实 elapsedSeconds，独立保留，仍鼓励多线切换。
  // 只展开活跃会话，其余直接返回原引用，减少每秒 GC 压力。
  let sessionsChanged = false;
  const nextSessions = state.sessions.map((session): CustomerSession => {
    if (session.status !== "active") {
      return session;
    }
    sessionsChanged = true;
    return {
      ...session,
      elapsedSeconds: session.elapsedSeconds + 1,
      timeoutCounted:
        session.timeoutCounted || session.elapsedSeconds + 1 >= timeoutAlertSeconds,
    };
  });
  const tickedSessions = sessionsChanged ? nextSessions : state.sessions;
  const newTimeoutAlertCount = tickedSessions.filter(
    (session, index) =>
      session.status === "active" &&
      session.timeoutCounted &&
      !state.sessions[index]?.timeoutCounted,
  ).length;

  const nextState: GameState = {
    ...state,
    sessions: tickedSessions,
    // 疲劳值每秒自然恢复
    fatigue: Math.max(0, state.fatigue - fatigueCfg.recoveryPerTick),
    activeSessionId: state.activeSessionId,
    achievementStats:
      newTimeoutAlertCount > 0
        ? {
            ...state.achievementStats,
            timeoutCount: state.achievementStats.timeoutCount + newTimeoutAlertCount,
          }
        : state.achievementStats,
  };

  // 疲劳满时对所有活跃会话施加满意度惩罚（通过 shiftMetrics 传导）
  const stateAfterFatigue =
    nextState.fatigue >= 100
      ? applyFatiguePenalty(nextState)
      : nextState;

  const nextStateWithEvent = maybeTriggerRandomEvent(stateAfterFatigue, seed);
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

  // 节假日：最大并发 +1，到达间隔压缩
  const effectiveMaxSessions =
    maxOpenSessions + (state.level.isHoliday ? holidayCfg.extraMaxSessions : 0);

  if (
    hasAvailableCustomer(nextStateWithAchievements) &&
    countActiveSessions(nextStateWithAchievements.sessions) < effectiveMaxSessions
  ) {
    const arrivalDecrement =
      state.level.isHoliday ||
      state.fatigue >= fatigueCfg.pressureThreshold
        ? 2  // 节假日 / 疲劳压力下到达更快
        : 1;
    const nextArrivalIn = Math.max(0, state.nextArrivalIn - arrivalDecrement);

    if (nextArrivalIn <= 0) {
      return connectRandomCustomer(nextStateWithAchievements, seed + messageCounter + sessionCounter);
    }

    return { ...nextStateWithAchievements, nextArrivalIn };
  }

  return nextStateWithAchievements;
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

function chooseReply(
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

function submitFreeReply(
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

function answerSession(
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

  if (card.tags.includes("pushback")) {
    return pushBackAtCustomer(state, session, card, isFreeReply, replyId);
  }

  const { delta, reactionKind, feedback } = scoreReply(session.customer, round, card, {
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
      card,
      reactionKind,
      messageCounter + session.elapsedSeconds + nextRoundIndex,
    );
  const outcome = maybeBuildOutcome(
    session.customer,
    round,
    nextRoundIndex,
    nextOutcomeMetrics,
    {
      card,
      isAiReactionLine: usedAiLine,
      reactionKind,
      reactionLine,
    },
  );
  const baseMessages = trimSessionMessages([
    ...appendAgentMessage(session.messages, card.title, replyId),
    createMessage("customer", reactionLine),
    createMessage("system", feedback.message),
  ]);
  const nextCoachingStats = getNextCoachingStats(state, card, feedback, isFreeReply);

  if (outcome) {
    const nextSession: CustomerSession = {
      ...session,
      activeRoundIndex: nextRoundIndex,
      metrics: nextSessionMetrics,
      replyHistory: [...session.replyHistory, createReplyMemory(card)],
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
    replyHistory: [...session.replyHistory, createReplyMemory(card)],
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
    achievementStats: getNextReplyStats(state, session, undefined, isFreeReply),
    coachingStats: nextCoachingStats,
  });
}

function pushBackAtCustomer(
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
    replyHistory: [],
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
  resolutionContext?: {
    card: ReplyCard;
    isAiReactionLine: boolean;
    reactionKind: ReplyReactionKind;
    reactionLine: string;
  },
) {
  if (
    metrics.anger >= 100 ||
    metrics.satisfaction <= 10 ||
    metrics.complianceRisk >= 100
  ) {
    return createOutcome(customer, metrics);
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

function shouldAcceptResolutionFromReaction(
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

function hasResolutionIntent(card: ReplyCard) {
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

function hasOpenConcern(line: string) {
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
  const preset = state.level.generation?.difficultyPreset;
  const gradeOffset = preset ? difficultyPresets[preset].gradeOffset : 0;
  const summary = buildDaySummary(
    state.metrics,
    state.outcomes,
    state.coachingStats,
    state.achievementStats.timeoutCount,
    gradeOffset,
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

function normalizeAiReactionLine(line?: string) {
  const trimmedLine = line?.trim();

  if (!trimmedLine) {
    return undefined;
  }

  return trimmedLine.length > 400 ? `${trimmedLine.slice(0, 400)}...` : trimmedLine;
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
    investigatePolicyComboCount:
      state.achievementStats.investigatePolicyComboCount +
      (session.replyHistory.length >= 1 &&
       session.replyHistory[session.replyHistory.length - 1].tags.includes("investigate") &&
       isResolved ? 1 : 0),
    consecutiveNoTimeoutCount:
      session.timeoutCounted
        ? 0
        : state.achievementStats.consecutiveNoTimeoutCount + 1,
  };
}

function getNextCoachingStats(
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

function getPreviousReply(session: CustomerSession) {
  return session.replyHistory[session.replyHistory.length - 1];
}

function createReplyMemory(card: ReplyCard) {
  return {
    cardId: card.id,
    tags: card.tags,
  };
}

function refreshAchievements(state: GameState): GameState {
  const nextAchievements = getUnlockedAchievements(state);
  const newlyUnlockedAchievements = nextAchievements.filter(
    (achievementId) => !state.achievements.includes(achievementId),
  );

  // 没有新解锁时 nextAchievements 与 state.achievements 内容相同（解锁集合只增不减），
  // 直接返回原 state 以保持引用稳定，避免每秒 tick 都生成新数组拖累下游记忆化。
  if (newlyUnlockedAchievements.length === 0) {
    return state;
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
    "no-template-shift": "全程真人服务",
    "investigate-policy-combo": "先查再说",
    "no-timeout-streak": "连续及时响应",
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

function createMessage(speaker: ChatMessage["speaker"], text: string, replyId?: string): ChatMessage {
  messageCounter += 1;

  return {
    id: `msg-${messageCounter}`,
    speaker,
    text,
    ...(replyId ? { replyId } : {}),
  };
}

function appendAgentMessage(messages: ChatMessage[], text: string, replyId?: string): ChatMessage[] {
  const lastMessage = messages[messages.length - 1];

  if (
    lastMessage?.speaker === "agent" &&
    lastMessage.text.trim() === text.trim() &&
    (!replyId || lastMessage.replyId === replyId || !lastMessage.replyId)
  ) {
    return messages;
  }

  return trimSessionMessages([...messages, createMessage("agent", text, replyId)]);
}

function canResolvePendingReply(session: CustomerSession, replyId?: string) {
  if (replyId) {
    return session.pendingReplyId === replyId;
  }

  return !session.pendingReplyId;
}

/** 会话消息超过上限时，保留首条系统消息（接入提示）+ 最近的 maxSessionMessages-1 条。 */
function trimSessionMessages(messages: ChatMessage[]): ChatMessage[] {
  if (messages.length <= maxSessionMessages) return messages;
  return [messages[0], ...messages.slice(-(maxSessionMessages - 1))];
}

/** 疲劳满时对所有活跃会话施加满意度惩罚。 */
function applyFatiguePenalty(state: GameState): GameState {
  const penalty = fatigueCfg.maxFatigueSatisfactionPenalty;
  let changed = false;
  const sessions = state.sessions.map((session) => {
    if (session.status !== "active") return session;
    changed = true;
    return {
      ...session,
      metrics: {
        ...session.metrics,
        satisfaction: Math.max(0, session.metrics.satisfaction - penalty),
      },
    };
  });
  return changed ? { ...state, sessions } : state;
}
