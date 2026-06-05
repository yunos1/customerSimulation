import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  defaultMeta,
  evaluateUnlocks,
  getModeProgress,
  loadMeta,
  migrate,
  recordDayResult,
  saveMeta,
} from "./meta";
import type { DayResult, MetaState } from "./meta";
import { career, supportModes } from "../content/career";
import { unlockableCards } from "../content/unlockableCards";

// meta 是元进度纯逻辑 + 薄 localStorage 边界。
// recordDayResult / migrate 是纯函数，重点测幂等、取 max、解锁、损坏回退。

const day1 = career.days[0].id; // internship-day-01, passGrade C
const day2 = career.days[1].id; // internship-day-02, passGrade B
const day3 = career.days[2].id; // conversion-exam
const comedyDay1 = supportModes.comedy.days[0].id;
const comedyDay2 = supportModes.comedy.days[1].id;

function makeResult(overrides: Partial<DayResult> = {}): DayResult {
  return {
    dayId: day1,
    grade: "B",
    achievements: [],
    resolvedCount: 4,
    complaintCount: 2,
    finalSatisfaction: 70,
    ...overrides,
  };
}

describe("defaultMeta", () => {
  it("初始只解锁第 1 天，无最佳评级与记录", () => {
    const meta = defaultMeta();

    expect(meta.activeModeId).toBe("workplace");
    expect(meta.currentDayId).toBe(day1);
    expect(meta.unlockedDayIds).toEqual([day1]);
    expect(meta.bestGrades).toEqual({});
    expect(getModeProgress(meta, "comedy").unlockedDayIds).toEqual([comedyDay1]);
    expect(getModeProgress(meta, "cyber").unlockedDayIds).toEqual([supportModes.cyber.days[0].id]);
    expect(meta.lifetimeAchievements).toEqual([]);
    expect(meta.records.totalRuns).toBe(0);
    expect(meta.unlockedCardIds).toEqual([]);
  });
});

describe("recordDayResult", () => {
  it("过关（B >= 第1天的 C）解锁下一天", () => {
    const meta = recordDayResult(defaultMeta(), makeResult({ dayId: day1, grade: "B" }));

    expect(meta.unlockedDayIds).toContain(day2);
    expect(meta.bestGrades[day1]).toBe("B");
  });

  it("未过关（D < C）不解锁下一天", () => {
    const meta = recordDayResult(defaultMeta(), makeResult({ dayId: day1, grade: "D" }));

    expect(meta.unlockedDayIds).toEqual([day1]);
    expect(meta.bestGrades[day1]).toBe("D");
  });

  it("最佳评级取 max：较差的后续结果不覆盖", () => {
    let meta = recordDayResult(defaultMeta(), makeResult({ dayId: day1, grade: "A" }));
    meta = recordDayResult(meta, makeResult({ dayId: day1, grade: "C" }));

    expect(meta.bestGrades[day1]).toBe("A");
  });

  it("最佳评级取 max：更好的后续结果会覆盖", () => {
    let meta = recordDayResult(defaultMeta(), makeResult({ dayId: day1, grade: "C" }));
    meta = recordDayResult(meta, makeResult({ dayId: day1, grade: "S" }));

    expect(meta.bestGrades[day1]).toBe("S");
  });

  it("成就并集去重", () => {
    let meta = recordDayResult(
      defaultMeta(),
      makeResult({ achievements: ["first-save", "cool-headed"] }),
    );
    meta = recordDayResult(meta, makeResult({ achievements: ["cool-headed", "no-timeout"] }));

    expect([...meta.lifetimeAchievements].sort()).toEqual(
      ["cool-headed", "first-save", "no-timeout"].sort(),
    );
  });

  it("records 累计（非幂等，靠调用方守卫）", () => {
    let meta = recordDayResult(defaultMeta(), makeResult({ resolvedCount: 4, complaintCount: 2 }));
    meta = recordDayResult(meta, makeResult({ resolvedCount: 3, complaintCount: 1 }));

    expect(meta.records.totalRuns).toBe(2);
    expect(meta.records.totalResolved).toBe(7);
    expect(meta.records.totalComplaints).toBe(3);
  });

  it("bestSatisfaction 取 max", () => {
    let meta = recordDayResult(defaultMeta(), makeResult({ finalSatisfaction: 60 }));
    meta = recordDayResult(meta, makeResult({ finalSatisfaction: 85 }));
    meta = recordDayResult(meta, makeResult({ finalSatisfaction: 70 }));

    expect(meta.records.bestSatisfaction).toBe(85);
  });

  it("解锁幂等：重复过关同一天不重复添加下一天", () => {
    let meta = recordDayResult(defaultMeta(), makeResult({ dayId: day1, grade: "B" }));
    const firstUnlocks = meta.unlockedDayIds;
    meta = recordDayResult(meta, makeResult({ dayId: day1, grade: "A" }));

    expect(meta.unlockedDayIds.filter((id) => id === day2)).toHaveLength(1);
    expect(meta.unlockedDayIds).toEqual([...firstUnlocks]);
  });

  it("未知天 id 不污染 meta（原样返回）", () => {
    const base = defaultMeta();
    const meta = recordDayResult(base, makeResult({ dayId: "no-such-day" }));

    expect(meta).toEqual(base);
  });

  it("不同模式的天数解锁互不污染", () => {
    const meta = recordDayResult(
      defaultMeta(),
      makeResult({ modeId: "comedy", dayId: comedyDay1, grade: "B" }),
    );

    expect(getModeProgress(meta, "comedy").unlockedDayIds).toContain(comedyDay2);
    expect(getModeProgress(meta, "workplace").unlockedDayIds).toEqual([day1]);
    expect(meta.currentDayId).toBe(comedyDay1);
  });

  it("最后一天过关不会越界解锁（无下一天）", () => {
    // 先把前两天解锁推进到第 3 天可用。
    let meta = defaultMeta();
    meta = recordDayResult(meta, makeResult({ dayId: day1, grade: "B" }));
    meta = recordDayResult(meta, makeResult({ dayId: day2, grade: "B" }));
    const beforeLast = meta.unlockedDayIds.length;
    meta = recordDayResult(meta, makeResult({ dayId: day3, grade: "S" }));

    // 第 3 天没有下一天，解锁数不应增加。
    expect(meta.unlockedDayIds.length).toBe(beforeLast);
    expect(meta.bestGrades[day3]).toBe("S");
  });
});

describe("migrate", () => {
  it("非对象 → defaultMeta", () => {
    expect(migrate(null)).toEqual(defaultMeta());
    expect(migrate("garbage")).toEqual(defaultMeta());
    expect(migrate(42)).toEqual(defaultMeta());
  });

  it("版本不匹配 → defaultMeta", () => {
    const stale = { version: 999, data: defaultMeta() };

    expect(migrate(stale)).toEqual(defaultMeta());
  });

  it("缺 data → defaultMeta", () => {
    expect(migrate({ version: 1 })).toEqual(defaultMeta());
  });

  it("当前版本有效数据原样回填", () => {
    const data: MetaState = {
      ...defaultMeta(),
      activeModeId: "comedy",
      modes: {
        ...defaultMeta().modes,
        comedy: {
          currentDayId: comedyDay2,
          unlockedDayIds: [comedyDay1, comedyDay2],
          bestGrades: { [comedyDay1]: "A" },
        },
      },
    };

    const result = migrate({ version: 2, data });

    expect(result.activeModeId).toBe("comedy");
    expect(result.currentDayId).toBe(comedyDay2);
    expect(result.unlockedDayIds).toEqual([comedyDay1, comedyDay2]);
    expect(result.bestGrades).toEqual({ [comedyDay1]: "A" });
  });

  it("部分字段损坏 → 该字段回退默认，其余保留", () => {
    const data = {
      ...defaultMeta(),
      activeModeId: "comedy",
      modes: {
        comedy: {
          currentDayId: comedyDay2,
          bestGrades: { [comedyDay1]: "X" }, // 非法 Grade
          unlockedDayIds: "not-an-array",
        },
      },
    };

    const result = migrate({ version: 2, data });

    expect(result.currentDayId).toBe(comedyDay2); // 有效字段保留
    expect(result.bestGrades).toEqual({}); // 非法 grade record 回退
    expect(result.unlockedDayIds).toEqual([comedyDay1]); // 非数组回退
  });

  it("空 unlockedDayIds 数组回退默认（至少第1天可玩）", () => {
    const data = {
      ...defaultMeta(),
      modes: {
        ...defaultMeta().modes,
        workplace: {
          currentDayId: day1,
          unlockedDayIds: [],
          bestGrades: {},
        },
      },
    };
    const result = migrate({ version: 2, data });

    expect(result.unlockedDayIds).toEqual([day1]);
  });

  it("v1 扁平存档迁移到真实职场模式", () => {
    const data = {
      currentDayId: day2,
      unlockedDayIds: [day1, day2],
      bestGrades: { [day1]: "A" },
      lifetimeAchievements: ["first-save"],
      records: {
        totalRuns: 1,
        totalResolved: 4,
        totalComplaints: 0,
        bestSatisfaction: 80,
      },
      unlockedCardIds: [],
    };

    const result = migrate({ version: 1, data });

    expect(result.activeModeId).toBe("workplace");
    expect(getModeProgress(result, "workplace").currentDayId).toBe(day2);
    expect(getModeProgress(result, "workplace").unlockedDayIds).toEqual([day1, day2]);
    expect(getModeProgress(result, "comedy").unlockedDayIds).toEqual([comedyDay1]);
  });
});

describe("evaluateUnlocks", () => {
  // 解锁卡 fixture（从 unlockableCards 按条件类型取，避免硬编码 id 漂移）。
  const resolveCard = unlockableCards.find((c) => c.condition.kind === "totalResolved")!;
  const runsCard = unlockableCards.find((c) => c.condition.kind === "totalRuns")!;
  const achievementCard = unlockableCards.find((c) => c.condition.kind === "achievement")!;

  it("初始无解锁", () => {
    expect(evaluateUnlocks(defaultMeta())).toEqual([]);
  });

  it("达到 totalResolved 阈值解锁对应卡", () => {
    const base = defaultMeta();
    const meta: MetaState = { ...base, records: { ...base.records, totalResolved: 1000 } };

    expect(evaluateUnlocks(meta)).toContain(resolveCard.card.id);
  });

  it("达到 totalRuns 阈值解锁对应卡", () => {
    const base = defaultMeta();
    const meta: MetaState = { ...base, records: { ...base.records, totalRuns: 1000 } };

    expect(evaluateUnlocks(meta)).toContain(runsCard.card.id);
  });

  it("获得指定成就解锁对应卡", () => {
    if (achievementCard.condition.kind !== "achievement") {
      throw new Error("fixture mismatch");
    }

    const meta: MetaState = {
      ...defaultMeta(),
      lifetimeAchievements: [achievementCard.condition.id],
    };

    expect(evaluateUnlocks(meta)).toContain(achievementCard.card.id);
  });

  it("解锁单调：已解锁的卡即使条件回落也保留", () => {
    const base = defaultMeta();
    const meta: MetaState = {
      ...base,
      unlockedCardIds: ["some-previously-unlocked-card"],
      records: { ...base.records, totalResolved: 0 },
    };

    expect(evaluateUnlocks(meta)).toContain("some-previously-unlocked-card");
  });

  it("recordDayResult 在达到阈值时填充 unlockedCardIds", () => {
    if (resolveCard.condition.kind !== "totalResolved") {
      throw new Error("fixture mismatch");
    }

    const meta = recordDayResult(
      defaultMeta(),
      makeResult({ dayId: day1, grade: "B", resolvedCount: resolveCard.condition.count }),
    );

    expect(meta.unlockedCardIds).toContain(resolveCard.card.id);
  });
});

describe("loadMeta / saveMeta（localStorage 边界）", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
      clear: () => store.clear(),
    });
  });

  it("空存储 → defaultMeta", () => {
    expect(loadMeta()).toEqual(defaultMeta());
  });

  it("save 后 load 往返一致", () => {
    const meta = recordDayResult(defaultMeta(), makeResult({ dayId: day1, grade: "A" }));
    saveMeta(meta);

    expect(loadMeta()).toEqual(meta);
  });

  it("损坏的 JSON → 优雅回退 defaultMeta", () => {
    localStorage.setItem("customer-sim:meta", "{not valid json");

    expect(loadMeta()).toEqual(defaultMeta());
  });
});
