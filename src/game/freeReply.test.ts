import { describe, expect, it } from "vitest";
import { buildAssessedReplyCard, buildFreeReplyCard, normalizeReplyAssessment } from "./freeReply";

describe("buildFreeReplyCard", () => {
  it("识别自然表达里的查证、物流和回访意图，而不是降级成模板", () => {
    const card = buildFreeReplyCard(
      "我先看一下中转站和运单节点，给你建追踪工单，今天内回访处理进度。",
    );

    expect(card.tags).toEqual(expect.arrayContaining(["investigate", "logistics"]));
    expect(card.tags).not.toContain("template");
  });

  it("识别有边界但不生硬的政策说明", () => {
    const card = buildFreeReplyCard(
      "我会按价保页面的活动范围和下单时间节点复核，能不能通过会给你明确依据。",
    );

    expect(card.tags).toEqual(expect.arrayContaining(["policy", "refund_check", "investigate"]));
    expect(card.tags).not.toContain("template");
  });

  it("明显复制粘贴式回复仍会判为模板", () => {
    const card = buildFreeReplyCard("亲亲您好，感谢您的理解，请您耐心等待，祝您生活愉快。");

    expect(card.tags).toEqual(["template"]);
  });
});

describe("buildAssessedReplyCard", () => {
  it("使用AI评估标签和小幅数值修正覆盖自由回复本地判断", () => {
    const card = buildAssessedReplyCard("我来处理。", {
      tags: ["empathy", "investigate"],
      effectAdjustments: { satisfaction: 4, anger: -3 },
      reactionKind: "success",
      coachingNote: "具体承接了客户情绪和下一步",
      confidence: 0.8,
    });

    expect(card.tags).toEqual(["empathy", "investigate"]);
    expect(card.effects.satisfaction).toBeGreaterThan(6);
    expect(card.effects.anger).toBeLessThan(-7);
  });

  it("AI误判的pushback不会覆盖本地安全判断", () => {
    const card = buildAssessedReplyCard("能的", {
      tags: ["pushback", "refund_check"],
      effectAdjustments: { satisfaction: 4, anger: -4 },
      reactionKind: "success",
      coachingNote: "短答承诺继续处理",
      confidence: 0.8,
    });

    expect(card.tags).toContain("refund_check");
    expect(card.tags).not.toContain("pushback");
  });

  it("明确怼客户的自由回复仍会保留pushback", () => {
    const card = buildAssessedReplyCard("爱咋咋地，你去投诉吧。", {
      tags: ["refund_check"],
      reactionKind: "failure",
      confidence: 0.8,
    });

    expect(card.tags).toContain("pushback");
  });
});

describe("normalizeReplyAssessment", () => {
  it("过滤非法标签并限制数值修正范围", () => {
    const assessment = normalizeReplyAssessment({
      tags: ["investigate", "unknown", "template"],
      reactionKind: "success",
      effectAdjustments: { satisfaction: 99, anger: -99 },
      coachingNote: "清楚说明了下一步",
      confidence: 2,
    });

    expect(assessment).toEqual({
      tags: ["investigate"],
      reactionKind: "success",
      effectAdjustments: { satisfaction: 10, anger: -10 },
      coachingNote: "清楚说明了下一步",
      confidence: 1,
    });
  });
});
