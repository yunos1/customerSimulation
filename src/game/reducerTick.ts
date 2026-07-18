import { fatigue as fatigueCfg, holiday as holidayCfg } from "./balance";
import type { CustomerSession, GameState } from "./types";
import {
  countActiveSessions,
  createMessage,
  getArrivalDelay,
  idCounters,
  maxOpenSessions,
  randomEventChance,
  replaceSession,
  timeoutAlertSeconds,
} from "./reducerShared";
import {
  closeActiveSessionsForTimeLimit,
  connectRandomCustomer,
  hasAvailableCustomer,
  maybeTriggerRandomEvent,
} from "./reducerSessions";
import { refreshAchievements, shouldSummarize, summarize } from "./reducerSummary";

export function startDay(state: GameState, seed: number): GameState {
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

export function tick(state: GameState, seed: number): GameState {
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
      return connectRandomCustomer(nextStateWithAchievements, seed + idCounters.messageCounter + idCounters.sessionCounter);
    }

    return { ...nextStateWithAchievements, nextArrivalIn };
  }

  return nextStateWithAchievements;
}

export function applyFatiguePenalty(state: GameState): GameState {
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
