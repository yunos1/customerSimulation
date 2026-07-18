import { describe, expect, it } from "vitest";
import { getUnlockedAchievements } from "../content/achievements";
import { getNextReplyStats } from "./reducerReply";
import type {
  Customer,
  CustomerOutcome,
  CustomerSession,
  GameState,
  ReplyCard,
} from "./types";

function baseCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: "c1",
    name: "测试客户",
    handle: "tester",
    type: "policy_checker",
    issue: "测试问题",
    opening: "你好",
    initialMetrics: { satisfaction: 50, anger: 50 },
    patience: 50,
    profileNotes: [],
    rounds: [
      {
        id: "r1",
        prompt: "请处理",
        preferredTags: ["investigate", "policy"],
        riskyTags: ["template"],
        successLine: "好",
        neutralLine: "嗯",
        failureLine: "不行",
      },
    ],
    ...overrides,
  };
}

function baseSession(overrides: Partial<CustomerSession> = {}): CustomerSession {
  const customer = overrides.customer ?? baseCustomer();
  return {
    id: "s1",
    customer,
    status: "active",
    activeRoundIndex: 0,
    metrics: { ...customer.initialMetrics },
    messages: [],
    elapsedSeconds: 3,
    timeoutAlertDismissed: false,
    timeoutCounted: false,
    replyHistory: [],
    ...overrides,
  };
}

function emptyAchievementStats() {
  return {
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
  };
}

function baseState(overrides: Partial<GameState> = {}): GameState {
  return {
    level: {
      id: "t",
      title: "t",
      briefing: "b",
      baseMetrics: {
        satisfaction: 50,
        anger: 50,
        companyCost: 0,
        complianceRisk: 10,
        timeLeft: 100,
      },
      customers: [],
      replyCards: [],
      policies: [],
      possibleEvents: [],
    },
    phase: "player_reply",
    metrics: {
      satisfaction: 50,
      anger: 50,
      companyCost: 0,
      complianceRisk: 10,
      timeLeft: 100,
    },
    sessions: [],
    connectedCustomerIds: [],
    shiftMessages: [],
    nextArrivalIn: 10,
    outcomes: [],
    achievements: [],
    triggeredEventIds: [],
    achievementStats: emptyAchievementStats(),
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
    messageCounter: 0,
    sessionCounter: 0,
    runId: 1,
    fatigue: 0,
    ...overrides,
  };
}

const investigateCard: ReplyCard = {
  id: "inv",
  title: "我先帮您核实",
  shortLabel: "查证",
  description: "核实订单与证据",
  tags: ["investigate"],
  effects: {},
};

const policyCard: ReplyCard = {
  id: "pol",
  title: "按政策说明",
  shortLabel: "政策",
  description: "说明适用政策",
  tags: ["policy"],
  effects: {},
};

const apologyCard: ReplyCard = {
  id: "apo",
  title: "抱歉",
  shortLabel: "致歉",
  description: "表达歉意",
  tags: ["apology"],
  effects: {},
};

const resolved: CustomerOutcome = {
  customerId: "c1",
  customerName: "测试客户",
  status: "resolved",
  satisfaction: 90,
  anger: 10,
  notes: [],
};

describe("getNextReplyStats investigate→policy combo", () => {
  it("上一张 investigate + 本张 policy 计 1 次连击（不要求已解决）", () => {
    const session = baseSession({
      replyHistory: [{ cardId: "inv", tags: ["investigate"] }],
    });
    const stats = getNextReplyStats(baseState(), session, policyCard, undefined, false);
    expect(stats.investigatePolicyComboCount).toBe(1);
  });

  it("上一张不是 investigate 则不计", () => {
    const session = baseSession({
      replyHistory: [{ cardId: "apo", tags: ["apology"] }],
    });
    const stats = getNextReplyStats(baseState(), session, policyCard, undefined, false);
    expect(stats.investigatePolicyComboCount).toBe(0);
  });

  it("本张不是 policy 则不计", () => {
    const session = baseSession({
      replyHistory: [{ cardId: "inv", tags: ["investigate"] }],
    });
    const stats = getNextReplyStats(baseState(), session, investigateCard, undefined, false);
    expect(stats.investigatePolicyComboCount).toBe(0);
  });

  it("可累计，且与 outcome 无关", () => {
    const session = baseSession({
      replyHistory: [{ cardId: "inv", tags: ["investigate"] }],
    });
    const state = baseState({
      achievementStats: {
        ...emptyAchievementStats(),
        investigatePolicyComboCount: 2,
      },
    });
    const stats = getNextReplyStats(state, session, policyCard, resolved, false);
    expect(stats.investigatePolicyComboCount).toBe(3);
    expect(stats.resolvedCount).toBe(1);
  });
});

describe("getUnlockedAchievements investigate-policy-combo", () => {
  it("combo 计数达到 3 解锁成就", () => {
    const state = baseState({
      achievementStats: {
        ...emptyAchievementStats(),
        investigatePolicyComboCount: 3,
      },
    });
    expect(getUnlockedAchievements(state)).toContain("investigate-policy-combo");
  });

  it("不足 3 不解锁", () => {
    const state = baseState({
      achievementStats: {
        ...emptyAchievementStats(),
        investigatePolicyComboCount: 2,
      },
    });
    expect(getUnlockedAchievements(state)).not.toContain("investigate-policy-combo");
  });
});

describe("getNextReplyStats consecutiveNoTimeout", () => {
  it("无超时则 +1", () => {
    const stats = getNextReplyStats(
      baseState(),
      baseSession({ timeoutCounted: false }),
      apologyCard,
      undefined,
      false,
    );
    expect(stats.consecutiveNoTimeoutCount).toBe(1);
  });

  it("本会话已超时则清零", () => {
    const state = baseState({
      achievementStats: {
        ...emptyAchievementStats(),
        consecutiveNoTimeoutCount: 2,
      },
    });
    const stats = getNextReplyStats(
      state,
      baseSession({ timeoutCounted: true }),
      apologyCard,
      undefined,
      false,
    );
    expect(stats.consecutiveNoTimeoutCount).toBe(0);
  });
});
