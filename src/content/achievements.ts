import type { Achievement, AchievementId, GameState } from "../game/types";

export const achievements: Achievement[] = [
  {
    id: "first-save",
    title: "第一单稳住",
    description: "成功解决任意 1 位客户的会话。",
    category: "服务",
  },
  {
    id: "perfect-shift",
    title: "零投诉下班",
    description: "今日全部客户处理完毕，且没有投诉或主管介入。",
    category: "服务",
  },
  {
    id: "cool-headed",
    title: "情绪灭火器",
    description: "把一位初始怒气不低于 70 的客户成功稳住。",
    category: "服务",
  },
  {
    id: "policy-shield",
    title: "合规护盾",
    description: "合规风险压到 20 以下。",
    category: "合规",
  },
  {
    id: "budget-keeper",
    title: "公司钱包还活着",
    description: "今日结算时公司成本不超过 30 元。",
    category: "经营",
  },
  {
    id: "speed-responder",
    title: "秒回选手",
    description: "在客户接入 5 秒内完成一次回复。",
    category: "效率",
  },
  {
    id: "multi-tasker",
    title: "三线并行",
    description: "同时接待 3 个活跃客户。",
    category: "效率",
  },
  {
    id: "human-touch",
    title: "不是复制粘贴",
    description: "使用自由输入回复 3 次。",
    category: "技巧",
  },
  {
    id: "no-timeout",
    title: "不让客户干等",
    description: "今日结算时没有任何超过 2 分钟的等待提醒。",
    category: "效率",
  },
  {
    id: "comeback",
    title: "逆风翻盘",
    description: "把满意度低于 40 的客户成功处理到会话结束。",
    category: "技巧",
  },
  {
    id: "rage-quit",
    title: "大不了不干了",
    description: "对不可理喻客户直接怼回去，触发一次硬刚结局。",
    category: "技巧",
  },
];

export function getUnlockedAchievements(state: GameState): AchievementId[] {
  const unlocked = new Set(state.achievements);
  const resolvedOutcomes = state.outcomes.filter((outcome) => outcome.status === "resolved");

  unlockWhen(unlocked, "first-save", resolvedOutcomes.length >= 1);
  unlockWhen(unlocked, "cool-headed", state.achievementStats.savedAngryCustomerCount >= 1);
  unlockWhen(unlocked, "comeback", state.achievementStats.recoveredLowSatisfactionCount >= 1);
  unlockWhen(unlocked, "speed-responder", state.achievementStats.fastestReplySeconds <= 5);
  unlockWhen(unlocked, "multi-tasker", state.achievementStats.maxConcurrentSessions >= 3);
  unlockWhen(unlocked, "human-touch", state.achievementStats.freeReplyCount >= 3);
  unlockWhen(unlocked, "rage-quit", state.achievementStats.rageQuitCount >= 1);

  if (state.phase === "summary") {
    unlockWhen(unlocked, "perfect-shift", state.outcomes.every((outcome) => outcome.status === "resolved"));
    unlockWhen(
      unlocked,
      "policy-shield",
      state.metrics.complianceRisk <= 20 &&
        state.outcomes.every((outcome) => outcome.status !== "compliance_escalation"),
    );
    unlockWhen(unlocked, "budget-keeper", state.metrics.companyCost <= 30);
    unlockWhen(unlocked, "no-timeout", state.achievementStats.timeoutCount === 0);
  }

  return Array.from(unlocked);
}

function unlockWhen(unlocked: Set<AchievementId>, achievementId: AchievementId, condition: boolean) {
  if (condition) {
    unlocked.add(achievementId);
  }
}
