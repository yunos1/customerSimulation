import { describe, expect, it } from "vitest";
import { buildDaySummary, scoreReply } from "./scoring";
import type {
  CoachingStats,
  Customer,
  CustomerOutcome,
  CustomerRound,
  Metrics,
  ReplyCard,
} from "./types";

// 这些测试在 Phase 0 数值抽取后锁住现有评分行为。
// 任何后续平衡调整若改变这些断言，都应是有意为之并同步更新。

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: "c1",
    name: "测试客户",
    handle: "tester",
    type: "angry_refund",
    issue: "issue",
    opening: "opening",
    initialMetrics: { satisfaction: 40, anger: 70 },
    patience: 60,
    profileNotes: [],
    rounds: [],
    ...overrides,
  };
}

function makeRound(overrides: Partial<CustomerRound> = {}): CustomerRound {
  return {
    id: "r1",
    prompt: "prompt",
    preferredTags: [],
    riskyTags: [],
    successLine: "success",
    neutralLine: "neutral",
    failureLine: "failure",
    ...overrides,
  };
}

function makeCard(overrides: Partial<ReplyCard> = {}): ReplyCard {
  return {
    id: "card1",
    title: "card",
    shortLabel: "c",
    description: "d",
    tags: [],
    effects: {},
    ...overrides,
  };
}

describe("scoreReply", () => {
  it("命中 preferredTags 时加满意度、减怒气（每标签 +8/-7）", () => {
    const customer = makeCustomer({ type: "lost_package" });
    const round = makeRound({ preferredTags: ["logistics", "investigate"] });
    // 用一张无 effects、无客户类型修正干扰的卡，隔离 preferred 命中贡献。
    const card = makeCard({ tags: ["logistics", "investigate"], effects: {} });

    const { delta } = scoreReply(customer, round, card, {
      previousReply: undefined,
      templateUseCount: 0,
    });

    // lost_package 命中 logistics/investigate 还有客户类型修正 (+5 satisfaction, reactionBias)
    // 这里只断言 preferred 命中两次的基础贡献存在且方向正确。
    expect(delta.satisfaction).toBeGreaterThan(0);
    expect(delta.anger).toBeLessThan(0);
  });

  it("踩中 riskyTags 时减满意度、加怒气、加合规风险", () => {
    const customer = makeCustomer({ type: "policy_checker" });
    const round = makeRound({ preferredTags: ["policy"], riskyTags: ["template"] });
    const card = makeCard({ tags: ["template"], effects: {} });

    const { delta } = scoreReply(customer, round, card, {
      previousReply: undefined,
      templateUseCount: 0,
    });

    expect(delta.anger).toBeGreaterThan(0);
    expect((delta.complianceRisk ?? 0)).toBeGreaterThan(0);
  });

  it("纯命中触发 success，纯踩雷触发 failure", () => {
    const round = makeRound({ preferredTags: ["refund_check"], riskyTags: ["template"] });
    const success = scoreReply(
      makeCustomer(),
      round,
      makeCard({ tags: ["refund_check"] }),
      { previousReply: undefined, templateUseCount: 0 },
    );
    expect(success.reactionKind).toBe("success");

    const failure = scoreReply(
      makeCustomer(),
      round,
      makeCard({ tags: ["template"] }),
      { previousReply: undefined, templateUseCount: 0 },
    );
    expect(failure.reactionKind).toBe("failure");
  });

  it("连招：先 empathy 再 investigate 触发正向 comboNote", () => {
    const round = makeRound({ preferredTags: ["investigate"] });
    const { feedback } = scoreReply(
      makeCustomer({ type: "lost_package" }),
      round,
      makeCard({ tags: ["investigate"] }),
      { previousReply: { cardId: "prev", tags: ["empathy"] }, templateUseCount: 0 },
    );

    expect(feedback.comboNotes.length).toBeGreaterThan(0);
  });

  it("时机风险：连续模板触发 timingRiskNote", () => {
    const round = makeRound();
    const { feedback } = scoreReply(
      makeCustomer(),
      round,
      makeCard({ tags: ["template"] }),
      { previousReply: { cardId: "prev", tags: ["template"] }, templateUseCount: 0 },
    );

    expect(feedback.timingRiskNotes.length).toBeGreaterThan(0);
  });
});

const emptyCoaching: CoachingStats = {
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
};

function makeOutcome(status: CustomerOutcome["status"], satisfaction = 80, anger = 20): CustomerOutcome {
  return {
    customerId: "c",
    customerName: "n",
    status,
    satisfaction,
    anger,
    notes: [],
  };
}

describe("buildDaySummary 评级阈值", () => {
  // score = avgSat*0.45 + timeLeft*0.06 - cost*0.18 - risk*0.32 - complaints*12
  // 固定 cost=0/risk=0/无投诉，用 avgSat 与 timeLeft 精确命中各评级边界 (S72/A58/B42/C26)。
  function metricsWith(satisfaction: number, timeLeft = 0): Metrics {
    return { satisfaction, anger: 0, companyCost: 0, complianceRisk: 0, timeLeft };
  }
  // 单个 resolved outcome ⇒ avgSatisfaction = 其 satisfaction。
  function gradeFor(avgSat: number, timeLeft = 0) {
    return buildDaySummary(
      metricsWith(avgSat, timeLeft),
      [makeOutcome("resolved", avgSat, 0)],
      emptyCoaching,
      0,
    ).grade;
  }

  it("score=72 命中 S（avgSat=100, timeLeft=450 ⇒ 45+27=72）", () => {
    // 0.45*100 + 0.06*450 = 45 + 27 = 72 ⇒ S（>=72）。
    expect(gradeFor(100, 450)).toBe("S");
  });

  it("score 略低于 72 ⇒ A（timeLeft=440 ⇒ 71.4）", () => {
    expect(gradeFor(100, 440)).toBe("A"); // 45+26.4=71.4 ⇒ A (>=58)
  });

  it("score=58 命中 A 下界（avgSat=100, timeLeft≈216.7 ⇒ ~58）", () => {
    // 0.45*100 + 0.06*217 = 45 + 13.02 = 58.02 ⇒ A。
    expect(gradeFor(100, 217)).toBe("A");
  });

  it("score=42 命中 B 下界（avgSat=80, timeLeft=100 ⇒ 36+6=42）", () => {
    expect(gradeFor(80, 100)).toBe("B"); // >=42
  });

  it("score≈26 命中 C 下界（avgSat=40, timeLeft=134 ⇒ 18+8.04=26.04）", () => {
    expect(gradeFor(40, 134)).toBe("C"); // >=26
  });

  it("score 略低于 26 ⇒ D（avgSat=40, timeLeft=130 ⇒ 25.8）", () => {
    expect(gradeFor(40, 130)).toBe("D"); // 18+7.8=25.8 < 26
  });

  it("满意度低 + 多投诉 ⇒ D", () => {
    const summary = buildDaySummary(
      metricsWith(20),
      [makeOutcome("complaint", 20, 80), makeOutcome("complaint", 20, 80)],
      emptyCoaching,
      0,
    );
    expect(summary.grade).toBe("D");
  });

  it("任意 rage_quit ⇒ 直接 D（即便满意度满）", () => {
    const summary = buildDaySummary(
      metricsWith(100, 450),
      [makeOutcome("rage_quit", 0, 100)],
      emptyCoaching,
      0,
    );
    expect(summary.grade).toBe("D");
  });
});
