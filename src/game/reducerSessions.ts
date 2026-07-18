import { difficultyPresets, holiday as holidayCfg } from "./balance";
import { getActiveRound } from "./customerFlow";
import { applyShiftDelta } from "./scoring";
import type { Customer, CustomerSession, GameState } from "./types";
import {
  countActiveSessions,
  createMessage,
  getArrivalDelay,
  getOutcomeLabel,
  getOutcomeLine,
  getPreferredSessionId,
  getSeededIndex,
  idCounters,
  maxOpenSessions,
  pickSessionMetrics,
  randomEventChance,
  replaceSession,
  timeoutAlertSeconds,
} from "./reducerShared";
import { createTimeLimitOutcome } from "./reducerReply";
import { refreshAchievements, shouldSummarize, summarize } from "./reducerSummary";

export function selectSession(state: GameState, sessionId: string): GameState {
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

export function openTimeoutAlert(state: GameState, sessionId: string): GameState {
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

export function connectRandomCustomer(state: GameState, seed: number): GameState {
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

export function maybeTriggerRandomEvent(state: GameState, seed: number): GameState {
  const availableEvents = state.level.possibleEvents.filter(
    (event) => !state.triggeredEventIds.includes(event.id),
  );

  if (availableEvents.length === 0 || getSeededIndex(seed, randomEventChance) !== 0) {
    return state;
  }

  const event = availableEvents[getSeededIndex(seed + idCounters.messageCounter, availableEvents.length)];
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

export function closeActiveSessionsForTimeLimit(state: GameState): GameState {
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

export function createSession(customer: Customer): CustomerSession {
  const firstRound = getActiveRound(customer, 0);
  idCounters.sessionCounter += 1;

  return {
    id: `session-${idCounters.sessionCounter}-${customer.id}`,
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

export function pickRandomUnconnectedCustomer(state: GameState, seed: number) {
  const candidates = state.level.customers.filter(
    (customer) => !state.connectedCustomerIds.includes(customer.id),
  );

  if (candidates.length === 0) {
    return undefined;
  }

  return candidates[getSeededIndex(seed, candidates.length)];
}

export function hasAvailableCustomer(state: GameState) {
  return state.connectedCustomerIds.length < state.level.customers.length;
}

