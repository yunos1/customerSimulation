import { describe, expect, it } from "vitest";
import { buildCustomInterviewInsight, getInterviewQuestions, interviewRoles, interviewers } from "./content";
import { buildInterviewSummary, buildRetryComparison, scoreInterviewAnswer } from "./engine";

const role = interviewRoles[0];
const interviewer = interviewers[1];
const question = getInterviewQuestions(role, "mid")[0];

describe("interview scoring", () => {
  it("rewards structured answers with role keywords and evidence", () => {
    const strongAnswer = scoreInterviewAnswer(
      "背景是一个订单页面首屏慢的问题，目标是把 LCP 从 4.2 秒降到 2.1 秒。我负责组件拆分、接口缓存和图片懒加载，先用性能面板定位瓶颈，再和后端确认接口字段。上线后一周转化提升 8%，投诉减少 20%，复盘后把性能检查加入发布流程。",
      question,
      role,
      "mid",
      interviewer,
    );
    const weakAnswer = scoreInterviewAnswer(
      "我做过前端项目，主要就是写页面，也会和同事沟通，整体效果还可以。",
      question,
      role,
      "mid",
      interviewer,
    );

    expect(strongAnswer.score).toBeGreaterThan(weakAnswer.score);
    expect(strongAnswer.metrics.evidence).toBeGreaterThan(weakAnswer.metrics.evidence);
    expect(strongAnswer.followUp).toContain("追问");
  });

  it("builds a summary with suggestions and a hiring signal", () => {
    const answer = scoreInterviewAnswer(
      "背景是我们要提升用户体验，我先确认目标和数据，再推动组件、状态和测试优化。结果页面错误率下降 15%，复盘后形成检查清单。",
      question,
      role,
      "mid",
      interviewer,
    );
    const summary = buildInterviewSummary([answer], role, "mid", interviewer);

    expect(summary.totalScore).toBeGreaterThan(0);
    expect(summary.suggestions.length).toBeGreaterThan(0);
    expect(summary.modelAnswer).toContain(role.title);
  });

  it("adds custom questions from JD and resume snippets", () => {
    const customization = {
      jdText: "岗位要求关注前端性能、组件设计、数据指标和用户体验。",
      resumeText: "我负责订单页性能优化，推动缓存、组件拆分和错误率监控。",
    };
    const customQuestions = getInterviewQuestions(role, "mid", customization);
    const insight = buildCustomInterviewInsight(role, customization);

    expect(customQuestions[0].source).toBe("custom");
    expect(customQuestions.some((item) => item.prompt.includes("岗位信息"))).toBe(true);
    expect(insight.prompts.length).toBe(2);
  });

  it("compares retry answers and reports score improvement", () => {
    const weakAnswer = scoreInterviewAnswer(
      "我做过页面优化，效果还可以。",
      question,
      role,
      "mid",
      interviewer,
    );
    const retryAnswer = scoreInterviewAnswer(
      "背景是订单页首屏慢，目标是把 LCP 从 4 秒降到 2 秒。我负责组件拆分、缓存和监控，上线后转化提升 8%，并把复盘清单加入发布流程。",
      question,
      role,
      "mid",
      interviewer,
      weakAnswer,
    );
    const comparison = buildRetryComparison(weakAnswer, retryAnswer);

    expect(retryAnswer.score).toBeGreaterThan(weakAnswer.score);
    expect(comparison.scoreDelta).toBeGreaterThan(0);
    expect(retryAnswer.concern.length).toBeGreaterThan(0);
    expect(retryAnswer.improvedAnswer.length).toBeGreaterThan(20);
  });

  it("mentions customization signals in the model answer", () => {
    const customization = {
      jdText: "岗位要求熟悉性能优化和组件设计。",
      resumeText: "项目经历包含性能监控和组件库建设。",
    };
    const answer = scoreInterviewAnswer(
      "背景是组件库维护，我负责性能监控和组件设计，结果缺陷减少 18%。",
      question,
      role,
      "mid",
      interviewer,
      undefined,
      customization,
    );
    const summary = buildInterviewSummary([answer], role, "mid", interviewer, customization);

    expect(summary.modelAnswer).toContain("JD/简历");
    expect(summary.modelAnswer).toContain("性能");
  });
});
