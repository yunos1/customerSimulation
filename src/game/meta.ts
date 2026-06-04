import { career, getCareerDay, getNextDayId, isPassingGrade } from "../content/career";
import { unlockableCards } from "../content/unlockableCards";
import type { AchievementId, Grade, UnlockCondition } from "./types";

// 元进度（meta-progression）：跨浏览器会话持久化的「生涯」状态。
//
// 关键架构决策：meta-state 独立于 per-run 的 GameState。
// reducer 的纯函数性依赖于永不触碰 localStorage / Date.now / Math.random；
// meta 只在粗粒度时刻（一天结束、成就解锁）变化，绝不该每秒 TICK 写盘。
// 因此这里全部是纯逻辑 + 一个薄薄的 localStorage 边界，由 useMetaProgress 调用。

export interface MetaRecords {
  /** 完成（跑到 summary）的值班天数累计。 */
  totalRuns: number;
  /** 累计解决的客户数。 */
  totalResolved: number;
  /** 累计未解决（投诉 / 主管介入 / 硬刚离席）的客户数。 */
  totalComplaints: number;
  /** 历史最高最终满意度。 */
  bestSatisfaction: number;
}

export interface MetaState {
  /** 玩家当前选中 / 最近进入的天。 */
  currentDayId: string;
  /** 已解锁的天 id。 */
  unlockedDayIds: string[];
  /** 每天的历史最佳评级。 */
  bestGrades: Record<string, Grade>;
  /** 生涯累计解锁的成就（跨天并集）。 */
  lifetimeAchievements: AchievementId[];
  /** 生涯记录。 */
  records: MetaRecords;
  /** 已解锁的回复卡 id（Phase 3 用，此处先建空数组）。 */
  unlockedCardIds: string[];
}

// 一天结束时由 App 从 GameState 提取的事实，喂给 recordDayResult。
// 只携带纯数据，不含任何 React / DOM / 引擎引用，便于单测。
export interface DayResult {
  dayId: string;
  grade: Grade;
  /** 本次值班解锁的成就（GameState.achievements）。 */
  achievements: AchievementId[];
  /** 本次解决的客户数。 */
  resolvedCount: number;
  /** 本次未解决的客户数。 */
  complaintCount: number;
  /** 本次最终满意度（summary.totals.satisfaction）。 */
  finalSatisfaction: number;
}

const STORAGE_KEY = "customer-sim:meta";
const META_VERSION = 1;

interface PersistedMeta {
  version: number;
  data: MetaState;
}

export function defaultMeta(): MetaState {
  const firstDay = career.days[0];

  return {
    currentDayId: firstDay.id,
    unlockedDayIds: [firstDay.id],
    bestGrades: {},
    lifetimeAchievements: [],
    records: {
      totalRuns: 0,
      totalResolved: 0,
      totalComplaints: 0,
      bestSatisfaction: 0,
    },
    unlockedCardIds: [],
  };
}

// 纯 merge：把一天的结果并入 meta，返回新对象（不可变）。
//
// 幂等性说明：
// - bestGrades（取 max）、unlockedDayIds（集合并）、lifetimeAchievements（集合并）天然幂等，
//   重复调用同一结果不会改变它们。
// - records 的累计计数（totalRuns / totalResolved / totalComplaints）**不是**幂等的，
//   重复调用会重复累加。防重复计数由调用方（useMetaProgress 经 App 的 ref 守卫）保证：
//   每个 summary 只调用一次。详见 plan 的 Phase 2 风险说明。
export function recordDayResult(meta: MetaState, result: DayResult): MetaState {
  const day = getCareerDay(result.dayId);

  if (!day) {
    // 未知天 id：不动 meta，避免脏数据污染持久化。
    return meta;
  }

  // 最佳评级取 max：若旧评级已经达到（>=）本次评级，保留旧的。
  const previousGrade = meta.bestGrades[result.dayId];
  const bestGrade =
    previousGrade && isPassingGrade(previousGrade, result.grade) ? previousGrade : result.grade;
  const bestGrades = { ...meta.bestGrades, [result.dayId]: bestGrade };

  // 过关则解锁下一天。
  let unlockedDayIds = meta.unlockedDayIds;

  if (isPassingGrade(result.grade, day.passGrade)) {
    const nextDayId = getNextDayId(result.dayId);

    if (nextDayId && !unlockedDayIds.includes(nextDayId)) {
      unlockedDayIds = [...unlockedDayIds, nextDayId];
    }
  }

  // 成就并集。
  const lifetimeAchievements = Array.from(
    new Set([...meta.lifetimeAchievements, ...result.achievements]),
  );

  const records: MetaRecords = {
    totalRuns: meta.records.totalRuns + 1,
    totalResolved: meta.records.totalResolved + result.resolvedCount,
    totalComplaints: meta.records.totalComplaints + result.complaintCount,
    bestSatisfaction: Math.max(meta.records.bestSatisfaction, result.finalSatisfaction),
  };

  // 用并入后的 records / 成就重新推导解锁的卡。
  // 解锁单调：已解锁的卡不会因为后续数据回落而消失（用集合并保证）。
  const nextMeta: MetaState = {
    ...meta,
    bestGrades,
    unlockedDayIds,
    lifetimeAchievements,
    records,
  };

  return {
    ...nextMeta,
    unlockedCardIds: evaluateUnlocks(nextMeta),
  };
}

// 从 records + 成就推导当前应解锁的高级回复卡 id 列表。
// 纯函数：只读 meta，不产生副作用。与已解锁集合取并，保证解锁不可逆。
export function evaluateUnlocks(meta: MetaState): string[] {
  const unlocked = new Set(meta.unlockedCardIds);

  for (const entry of unlockableCards) {
    if (meetsCondition(meta, entry.condition)) {
      unlocked.add(entry.card.id);
    }
  }

  return Array.from(unlocked);
}

function meetsCondition(meta: MetaState, condition: UnlockCondition): boolean {
  switch (condition.kind) {
    case "totalResolved":
      return meta.records.totalResolved >= condition.count;
    case "totalRuns":
      return meta.records.totalRuns >= condition.count;
    case "bestSatisfaction":
      return meta.records.bestSatisfaction >= condition.value;
    case "achievement":
      return meta.lifetimeAchievements.includes(condition.id);
    default:
      return false;
  }
}

// ── localStorage 边界（唯一的 I/O，全部 try/catch 包裹） ──

export function loadMeta(): MetaState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return defaultMeta();
    }

    return migrate(JSON.parse(raw));
  } catch {
    // 解析失败 / localStorage 不可用：优雅回退到默认，不崩。
    return defaultMeta();
  }
}

export function saveMeta(meta: MetaState): void {
  try {
    const envelope: PersistedMeta = { version: META_VERSION, data: meta };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
  } catch {
    // localStorage 不可用（隐私模式 / 配额满）：静默降级，游戏仍可玩，只是不持久化。
  }
}

// 把解析出的任意 JSON 迁移成当前版本的 MetaState。
// 损坏 / 旧版本 → defaultMeta；当前 v1 数据 → 逐字段校验回填（防部分字段损坏）。
export function migrate(parsed: unknown): MetaState {
  if (!isRecord(parsed)) {
    return defaultMeta();
  }

  // 未知或旧版本：当前仅 v1，无升级路径，安全起见整体重置。
  // 未来加版本时在此按 version switch 逐步升级。
  if (parsed.version !== META_VERSION || !isRecord(parsed.data)) {
    return defaultMeta();
  }

  return coerceMetaState(parsed.data);
}

// 逐字段校验：任一字段类型不对就用默认值兜底，最大化保留有效数据。
function coerceMetaState(data: Record<string, unknown>): MetaState {
  const base = defaultMeta();

  return {
    currentDayId: isNonEmptyString(data.currentDayId) ? data.currentDayId : base.currentDayId,
    unlockedDayIds:
      isStringArray(data.unlockedDayIds) && data.unlockedDayIds.length > 0
        ? data.unlockedDayIds
        : base.unlockedDayIds,
    bestGrades: isGradeRecord(data.bestGrades) ? data.bestGrades : base.bestGrades,
    lifetimeAchievements: isStringArray(data.lifetimeAchievements)
      ? (data.lifetimeAchievements as AchievementId[])
      : base.lifetimeAchievements,
    records: coerceRecords(data.records, base.records),
    unlockedCardIds: isStringArray(data.unlockedCardIds) ? data.unlockedCardIds : base.unlockedCardIds,
  };
}

function coerceRecords(value: unknown, base: MetaRecords): MetaRecords {
  if (!isRecord(value)) {
    return base;
  }

  return {
    totalRuns: isFiniteNumber(value.totalRuns) ? value.totalRuns : base.totalRuns,
    totalResolved: isFiniteNumber(value.totalResolved) ? value.totalResolved : base.totalResolved,
    totalComplaints: isFiniteNumber(value.totalComplaints)
      ? value.totalComplaints
      : base.totalComplaints,
    bestSatisfaction: isFiniteNumber(value.bestSatisfaction)
      ? value.bestSatisfaction
      : base.bestSatisfaction,
  };
}

const VALID_GRADES: readonly Grade[] = ["S", "A", "B", "C", "D"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isGradeRecord(value: unknown): value is Record<string, Grade> {
  if (!isRecord(value)) {
    return false;
  }

  return Object.values(value).every(
    (grade) => typeof grade === "string" && VALID_GRADES.includes(grade as Grade),
  );
}
