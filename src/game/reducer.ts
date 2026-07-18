import { buildRandomizedCustomers } from "./customerGenerator";
import type {
  GameAction,
  GameState,
  LevelConfig,
} from "./types";
import {
  appendAgentMessage,
  chooseReply,
  createMessage,
  getActiveSession,
  getArrivalDelay,
  getSessionById,
  idCounters,
  openTimeoutAlert,
  replaceSession,
  selectSession,
  startDay,
  submitFreeReply,
  tick,
} from "./reducerHelpers";

export { getActiveSession };

export function createInitialState(level: LevelConfig, seed = Date.now()): GameState {
  // 重置 scratch 计数器；下面的 createMessage 会推进 messageCounter。
  idCounters.messageCounter = 0;
  idCounters.sessionCounter = 0;
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
    messageCounter: idCounters.messageCounter,
    sessionCounter: idCounters.sessionCounter,
    runId,
    fatigue: 0,
  };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  // 把 state 里的计数器同步到模块级 scratch 变量，内部各 createMessage/createSession
  // 照常推进它们；出口再写回结果。这样 reducer 对外是纯函数：同一 (state, action)
  // 永远得到同一结果，StrictMode 双调用也不会让 id / seed 漂移。
  idCounters.messageCounter = state.messageCounter;
  idCounters.sessionCounter = state.sessionCounter;

  const nextState = runReducer(state, action);

  if (nextState === state) {
    return state;
  }

  return {
    ...nextState,
    messageCounter: idCounters.messageCounter,
    sessionCounter: idCounters.sessionCounter,
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
