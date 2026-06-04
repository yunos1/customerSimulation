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
