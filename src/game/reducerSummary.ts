import { getUnlockedAchievements } from "../content/achievements";
import { difficultyPresets } from "./balance";
import { buildDaySummary } from "./scoring";
import type { AchievementId, GameState } from "./types";
import { createMessage, getPreferredSessionId } from "./reducerShared";

export function summarize(state: GameState): GameState {
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

export function shouldSummarize(state: GameState) {
  return (
    state.connectedCustomerIds.length >= state.level.customers.length &&
    state.sessions.length > 0 &&
    state.sessions.every((session) => session.status !== "active")
  );
}

export function refreshAchievements(state: GameState): GameState {
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

export function getAchievementTitle(achievementId: AchievementId) {
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

