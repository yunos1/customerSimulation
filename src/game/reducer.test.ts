import { describe, expect, it } from "vitest";
import { activeDay } from "../content/levels";
import { createInitialState, gameReducer, getActiveSession } from "./reducer";
import type { GameState } from "./types";

// 锁住 reducer 的确定性与核心状态机行为，作为 Phase 1 引擎改造前的基线。

describe("createInitialState", () => {
  it("同 seed 产出完全相同的初始 state（StrictMode 可重现保证）", () => {
    const a = createInitialState(activeDay, 555);
    const b = createInitialState(activeDay, 555);

    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("初始 phase 为 intro，无活跃会话", () => {
    const state = createInitialState(activeDay, 1);

    expect(state.phase).toBe("intro");
    expect(state.sessions).toHaveLength(0);
    expect(state.activeSessionId).toBeUndefined();
  });

  it("初始 metrics 取自 level.baseMetrics", () => {
    const state = createInitialState(activeDay, 1);

    expect(state.metrics).toEqual(activeDay.baseMetrics);
  });

  it("计数器从干净状态开始（messageCounter 反映开场系统消息）", () => {
    const state = createInitialState(activeDay, 1);

    expect(state.sessionCounter).toBe(0);
    expect(state.messageCounter).toBe(state.shiftMessages.length);
  });
});

describe("gameReducer 纯函数性", () => {
  it("对同一 (state, action) 重复调用得到相同结果", () => {
    const initial = createInitialState(activeDay, 88);
    const once = gameReducer(initial, { type: "START_DAY", seed: 88 });
    const twice = gameReducer(initial, { type: "START_DAY", seed: 88 });

    expect(JSON.stringify(once)).toBe(JSON.stringify(twice));
    // 原始 state 不被突变。
    expect(initial.phase).toBe("intro");
  });

  it("intro 阶段未知 action 返回原引用", () => {
    const initial = createInitialState(activeDay, 1);
    const next = gameReducer(initial, { type: "TICK", seed: 1 });

    // TICK 在 intro 阶段是 no-op，应返回同一引用。
    expect(next).toBe(initial);
  });
});

describe("START_DAY", () => {
  it("从 intro 进入 player_reply 并接入首位客户", () => {
    const initial = createInitialState(activeDay, 100);
    const started = gameReducer(initial, { type: "START_DAY", seed: 100 });

    expect(started.phase).toBe("player_reply");
    expect(started.sessions.length).toBeGreaterThan(0);
    expect(getActiveSession(started)).toBeDefined();
  });
});

describe("ADD_AGENT_MESSAGE", () => {
  it("连续预插入同一条客服回复时保持幂等，避免聊天区重复两条", () => {
    let state = createInitialState(activeDay, 100);
    state = gameReducer(state, { type: "START_DAY", seed: 100 });

    const session = getActiveSession(state);
    expect(session).toBeDefined();

    state = gameReducer(state, {
      type: "ADD_AGENT_MESSAGE",
      sessionId: session!.id,
      text: "我先帮你查订单节点。",
    });
    state = gameReducer(state, {
      type: "ADD_AGENT_MESSAGE",
      sessionId: session!.id,
      text: "我先帮你查订单节点。",
    });

    const updatedSession = getActiveSession(state);
    const matchingAgentMessages = updatedSession!.messages.filter(
      (message) => message.speaker === "agent" && message.text === "我先帮你查订单节点。",
    );

    expect(matchingAgentMessages).toHaveLength(1);
  });

  it("预插入硬刚回复后进入特殊结局时不会再次插入同一条客服回复", () => {
    let state = createInitialState(activeDay, 100);
    state = gameReducer(state, { type: "START_DAY", seed: 100 });

    const session = getActiveSession(state);
    const pushBackCard = state.level.replyCards.find((card) => card.id === "push-back");
    expect(session).toBeDefined();
    expect(pushBackCard).toBeDefined();

    state = gameReducer(state, {
      type: "ADD_AGENT_MESSAGE",
      sessionId: session!.id,
      text: pushBackCard!.title,
    });
    state = gameReducer(state, {
      type: "CHOOSE_REPLY",
      cardId: pushBackCard!.id,
      sessionId: session!.id,
    });

    const updatedSession = state.sessions.find((candidate) => candidate.id === session!.id);
    const matchingAgentMessages = updatedSession!.messages.filter(
      (message) => message.speaker === "agent" && message.text === pushBackCard!.title,
    );

    expect(matchingAgentMessages).toHaveLength(1);
  });

  it("带同一replyId的AI结算回调重复到达时只处理一次", () => {
    let state = createInitialState(activeDay, 100);
    state = gameReducer(state, { type: "START_DAY", seed: 100 });

    const session = getActiveSession(state);
    const replyId = "reply-once";
    expect(session).toBeDefined();

    state = gameReducer(state, {
      type: "ADD_AGENT_MESSAGE",
      sessionId: session!.id,
      text: "发起退款资格复核",
      replyId,
    });
    state = gameReducer(state, {
      type: "CHOOSE_REPLY",
      cardId: "refund-review",
      sessionId: session!.id,
      replyId,
      aiReactionLine: "可以，那你现在给我复核。",
    });

    const afterFirstResolve = state.sessions.find((candidate) => candidate.id === session!.id)!;
    const messageCountAfterFirstResolve = afterFirstResolve.messages.length;
    const roundIndexAfterFirstResolve = afterFirstResolve.activeRoundIndex;

    state = gameReducer(state, {
      type: "CHOOSE_REPLY",
      cardId: "refund-review",
      sessionId: session!.id,
      replyId,
      aiReactionLine: "可以，那你现在给我复核。",
    });

    const afterDuplicateResolve = state.sessions.find((candidate) => candidate.id === session!.id)!;

    expect(afterDuplicateResolve.messages).toHaveLength(messageCountAfterFirstResolve);
    expect(afterDuplicateResolve.activeRoundIndex).toBe(roundIndexAfterFirstResolve);
  });
});

describe("AI语义结算", () => {
  it("客户明确接受复核方案时自由回复可提前判定已解决", () => {
    let state = createInitialState(activeDay, 100);
    state = gameReducer(state, { type: "START_DAY", seed: 100 });

    const session = getActiveSession(state);
    expect(session).toBeDefined();

    state = gameReducer(state, {
      type: "SUBMIT_FREE_REPLY",
      sessionId: session!.id,
      text: "好的，我给你补充复核时效，今天内发起退款复核并同步正式反馈。",
      aiReactionLine: "行，有退款复核和正式反馈，我先等你们结果。",
      aiAssessment: {
        tags: ["refund_check", "investigate"],
        reactionKind: "success",
        customerIntent: "accepted",
        issueResolved: true,
        effectAdjustments: { satisfaction: 4, anger: -4 },
        coachingNote: "承接了复核诉求和反馈时间",
        confidence: 0.9,
      },
    });

    const updatedSession = state.sessions.find((candidate) => candidate.id === session!.id)!;

    expect(updatedSession.status).toBe("resolved");
    expect(updatedSession.outcome?.status).toBe("resolved");
  });

  it("客户仍在追问反馈时效时不会被提前结案", () => {
    let state = createInitialState(activeDay, 100);
    state = gameReducer(state, { type: "START_DAY", seed: 100 });

    const session = getActiveSession(state);
    expect(session).toBeDefined();

    state = gameReducer(state, {
      type: "SUBMIT_FREE_REPLY",
      sessionId: session!.id,
      text: "好的，我给你发起退款复核。",
      aiReactionLine: "可以，但你得告诉我复核后多久有答复。",
      aiAssessment: {
        tags: ["refund_check", "investigate"],
        reactionKind: "success",
        customerIntent: "still_concerned",
        issueResolved: false,
        effectAdjustments: { satisfaction: 4, anger: -4 },
        coachingNote: "承接了复核诉求，但客户仍追问时效",
        nextAgentFocus: "补充复核时效和回访方式",
        confidence: 0.9,
      },
    });

    const updatedSession = state.sessions.find((candidate) => candidate.id === session!.id)!;

    expect(updatedSession.status).toBe("active");
    expect(updatedSession.outcome).toBeUndefined();
  });

  it("AI误贴pushback标签的普通短答不会触发硬刚结局", () => {
    let state = createInitialState(activeDay, 100);
    state = gameReducer(state, { type: "START_DAY", seed: 100 });

    const session = getActiveSession(state);
    expect(session).toBeDefined();

    state = gameReducer(state, {
      type: "SUBMIT_FREE_REPLY",
      sessionId: session!.id,
      text: "能的",
      aiReactionLine: "可以，那你先给我走退款复核。",
      aiAssessment: {
        tags: ["pushback", "refund_check"],
        reactionKind: "success",
        customerIntent: "accepted",
        issueResolved: true,
        effectAdjustments: { satisfaction: 4, anger: -4 },
        coachingNote: "短答承诺继续处理",
        confidence: 0.9,
      },
    });

    const updatedSession = state.sessions.find((candidate) => candidate.id === session!.id)!;

    expect(updatedSession.outcome?.status).not.toBe("rage_quit");
    expect(state.achievementStats.rageQuitCount).toBe(0);
  });

  it("快捷回复会被AI复判，客户仍缺信息时不按旧数值阈值强行结案", () => {
    let state = createInitialState(activeDay, 100);
    state = gameReducer(state, { type: "START_DAY", seed: 100 });

    const session = getActiveSession(state);
    expect(session).toBeDefined();

    state = gameReducer(state, {
      type: "CHOOSE_REPLY",
      sessionId: session!.id,
      cardId: "small-coupon",
      aiReactionLine: "优惠券先别说，我要知道这单到底是谁负责、多久给结果。",
      aiAssessment: {
        tags: ["compensation", "template"],
        reactionKind: "neutral",
        customerIntent: "needs_info",
        issueResolved: false,
        effectAdjustments: { satisfaction: -3, anger: 4, complianceRisk: 4 },
        coachingNote: "补偿来得太早，客户还在要责任和时效",
        nextAgentFocus: "先补订单责任归属和明确反馈时间",
        confidence: 0.9,
      },
    });

    const updatedSession = state.sessions.find((candidate) => candidate.id === session!.id)!;

    expect(updatedSession.status).toBe("active");
    expect(updatedSession.outcome).toBeUndefined();
    expect(updatedSession.replyHistory[updatedSession.replyHistory.length - 1]?.tags).toEqual([
      "compensation",
    ]);
  });
});

describe("收尾条件（间接验证 shouldSummarize）", () => {
  // 驱动一整天：反复 TICK 推进时间并接入客户，对每个活跃会话不断选回复直到结束。
  // 全部客户连接且无活跃会话后，phase 应转为 summary 并生成 summary。
  it("处理完所有客户后进入 summary", () => {
    let state = createInitialState(activeDay, 2024);
    state = gameReducer(state, { type: "START_DAY", seed: 2024 });

    // 上限步数防止意外死循环。
    for (let step = 0; step < 5000 && state.phase !== "summary"; step += 1) {
      const session = getActiveSession(state);

      if (session && session.status === "active") {
        // 用一张稳妥的卡持续回复，推进会话走向结束。
        state = gameReducer(state, { type: "CHOOSE_REPLY", cardId: "refund-review" });
      } else {
        state = gameReducer(state, { type: "TICK", seed: step + 1 });
      }
    }

    expect(state.phase).toBe("summary");
    expect(state.summary).toBeDefined();
    expect(state.outcomes.length).toBeGreaterThan(0);
  });
});

describe("RESTART_DAY", () => {
  it("重置回 intro 阶段", () => {
    let state: GameState = createInitialState(activeDay, 1);
    state = gameReducer(state, { type: "START_DAY", seed: 1 });
    state = gameReducer(state, { type: "RESTART_DAY", level: activeDay, seed: 2 });

    expect(state.phase).toBe("intro");
    expect(state.sessions).toHaveLength(0);
  });
});

describe("LOAD_DAY", () => {
  it("加载指定 level 并进入 intro 阶段", () => {
    const initial = createInitialState(activeDay, 1);
    const loaded = gameReducer(initial, { type: "LOAD_DAY", level: activeDay, seed: 7 });

    expect(loaded.phase).toBe("intro");
    expect(loaded.level.id).toBe(activeDay.id);
    expect(loaded.sessions).toHaveLength(0);
  });
});
