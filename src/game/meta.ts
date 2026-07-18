import {
  getCareerDay,
  getNextDayId,
  isPassingGrade,
  supportModeOrder,
  supportModes,
  type SupportModeId,
} from "../content/career";
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
  /** 历史最快单次回复（秒）。Infinity 表示尚无记录。 */
  bestReplySeconds: number;
}

export interface ModeProgress {
  /** 玩家当前选中 / 最近进入的天。 */
  currentDayId: string;
  /** 已解锁的天 id。 */
  unlockedDayIds: string[];
  /** 每天的历史最佳评级。 */
  bestGrades: Record<string, Grade>;
}

export interface MetaState {
  /** 当前选择的客服风格模式。 */
  activeModeId: SupportModeId;
  /** 每个模式独立的职业线进度。 */
  modes: Record<SupportModeId, ModeProgress>;
  /** 生涯累计解锁的成就（跨模式并集）。 */
  lifetimeAchievements: AchievementId[];
  /** 生涯记录（跨模式累计）。 */
  records: MetaRecords;
  /** 已解锁的回复卡 id。 */
  unlockedCardIds: string[];
  /**
   * 最近一次本地变更时间（epoch ms）。用于云同步冲突时偏好「较新」的选择态
   *（activeModeId / currentDayId）。累计型字段仍按字段级 max/union 合并。
   */
  updatedAt?: number;
}

// 兼容旧调用方和旧测试使用的扁平字段。
export type LegacyMetaFields = ModeProgress;
export type MetaStateWithLegacy = MetaState & LegacyMetaFields;

// 一天结束时由 App 从 GameState 提取的事实，喂给 recordDayResult。
// 只携带纯数据，不含任何 React / DOM / 引擎引用，便于单测。
export interface DayResult {
  modeId?: SupportModeId;
  dayId: string;
  grade: Grade;
  achievements: AchievementId[];
  resolvedCount: number;
  complaintCount: number;
  finalSatisfaction: number;
  /** 本次最快单次回复（秒），来自 achievementStats.fastestReplySeconds。 */
  fastestReplySeconds?: number;
}

export const STORAGE_KEY = "customer-sim:meta";
const META_VERSION = 2;
const legacyModeId: SupportModeId = "workplace";

interface PersistedMeta {
  version: number;
  data: MetaState;
}

export function defaultMeta(activeModeId: SupportModeId = legacyModeId): MetaStateWithLegacy {
  return withLegacyFields({
    activeModeId,
    modes: buildDefaultModeProgressMap(),
    lifetimeAchievements: [],
    records: {
      totalRuns: 0,
      totalResolved: 0,
      totalComplaints: 0,
      bestSatisfaction: 0,
      bestReplySeconds: Number.POSITIVE_INFINITY,
    },
    unlockedCardIds: [],
    // 默认不写 updatedAt，保证 defaultMeta() 可稳定比较；有实质变更时再打戳。
  });
}

/**
 * 字段级合并本地与远端进度，避免「remoteRuns > localRuns 整包覆盖」丢档。
 *
 * - 累计/最优：max / min（bestReplySeconds 越低越好）
 * - 集合：成就、解锁卡、每天解锁 id 取并集
 * - 评级：更好的 grade 胜出
 * - 选择态（activeMode / currentDay）：updatedAt 较新者优先，否则更「进度深」的一侧
 * - 解锁卡最后再走 evaluateUnlocks，保证条件推导与单调性
 */
export function mergeMetaProgress(local: MetaState, remote: MetaState): MetaStateWithLegacy {
  const localAt = local.updatedAt ?? 0;
  const remoteAt = remote.updatedAt ?? 0;
  const preferRemoteSelection = remoteAt > localAt;

  const records: MetaRecords = {
    totalRuns: Math.max(local.records.totalRuns, remote.records.totalRuns),
    totalResolved: Math.max(local.records.totalResolved, remote.records.totalResolved),
    totalComplaints: Math.max(local.records.totalComplaints, remote.records.totalComplaints),
    bestSatisfaction: Math.max(local.records.bestSatisfaction, remote.records.bestSatisfaction),
    bestReplySeconds: Math.min(
      local.records.bestReplySeconds ?? Number.POSITIVE_INFINITY,
      remote.records.bestReplySeconds ?? Number.POSITIVE_INFINITY,
    ),
  };

  const lifetimeAchievements = Array.from(
    new Set([...local.lifetimeAchievements, ...remote.lifetimeAchievements]),
  );

  const modes = supportModeOrder.reduce<Record<SupportModeId, ModeProgress>>(
    (acc, modeId) => {
      const a = getModeProgress(local, modeId);
      const b = getModeProgress(remote, modeId);
      acc[modeId] = mergeModeProgress(a, b, preferRemoteSelection);
      return acc;
    },
    {} as Record<SupportModeId, ModeProgress>,
  );

  const activeModeId = preferRemoteSelection
    ? remote.activeModeId
    : localAt > remoteAt
      ? local.activeModeId
      : pickRicherActiveMode(local, remote);

  const draft: MetaState = {
    activeModeId,
    modes,
    lifetimeAchievements,
    records,
    unlockedCardIds: Array.from(new Set([...local.unlockedCardIds, ...remote.unlockedCardIds])),
    updatedAt: Math.max(localAt, remoteAt, Date.now()),
  };

  return withLegacyFields({
    ...draft,
    unlockedCardIds: evaluateUnlocks(draft),
  });
}

function mergeModeProgress(
  local: ModeProgress,
  remote: ModeProgress,
  preferRemoteSelection: boolean,
): ModeProgress {
  const unlockedDayIds = Array.from(new Set([...local.unlockedDayIds, ...remote.unlockedDayIds]));
  const dayIds = new Set([...Object.keys(local.bestGrades), ...Object.keys(remote.bestGrades)]);
  const bestGrades: Record<string, Grade> = {};

  for (const dayId of dayIds) {
    const lg = local.bestGrades[dayId];
    const rg = remote.bestGrades[dayId];
    if (lg && rg) {
      bestGrades[dayId] = betterGrade(lg, rg);
    } else {
      bestGrades[dayId] = (lg ?? rg)!;
    }
  }

  let currentDayId: string;
  if (preferRemoteSelection) {
    currentDayId = remote.currentDayId;
  } else if (local.unlockedDayIds.length !== remote.unlockedDayIds.length) {
    currentDayId =
      local.unlockedDayIds.length >= remote.unlockedDayIds.length
        ? local.currentDayId
        : remote.currentDayId;
  } else {
    currentDayId = local.currentDayId;
  }

  if (!unlockedDayIds.includes(currentDayId)) {
    currentDayId = unlockedDayIds[unlockedDayIds.length - 1] ?? local.currentDayId;
  }

  return { currentDayId, unlockedDayIds, bestGrades };
}

function betterGrade(a: Grade, b: Grade): Grade {
  // isPassingGrade(x, y) 意为 x 是否达到门槛 y（x 不差于 y）
  if (isPassingGrade(a, b) && !isPassingGrade(b, a)) return a;
  if (isPassingGrade(b, a) && !isPassingGrade(a, b)) return b;
  return a;
}

function pickRicherActiveMode(local: MetaState, remote: MetaState): SupportModeId {
  const localDepth = modeDepth(local);
  const remoteDepth = modeDepth(remote);
  if (remoteDepth > localDepth) return remote.activeModeId;
  return local.activeModeId;
}

function modeDepth(meta: MetaState): number {
  return supportModeOrder.reduce(
    (sum, modeId) => sum + getModeProgress(meta, modeId).unlockedDayIds.length,
    0,
  );
}

export function getModeProgress(meta: MetaState, modeId: SupportModeId): ModeProgress {
  return meta.modes[modeId] ?? defaultModeProgress(modeId);
}

export function selectMode(meta: MetaState, modeId: SupportModeId): MetaStateWithLegacy {
  if (meta.activeModeId === modeId && meta.modes[modeId]) {
    return withLegacyFields(meta);
  }

  return withLegacyFields({
    ...meta,
    activeModeId: modeId,
    modes: ensureModeProgressMap(meta.modes),
    updatedAt: Date.now(),
  });
}

export function selectDay(meta: MetaState, modeId: SupportModeId, dayId: string): MetaStateWithLegacy {
  const modeProgress = getModeProgress(meta, modeId);

  if (modeProgress.currentDayId === dayId) {
    return withLegacyFields(meta);
  }

  return withLegacyFields({
    ...meta,
    activeModeId: modeId,
    modes: {
      ...ensureModeProgressMap(meta.modes),
      [modeId]: {
        ...modeProgress,
        currentDayId: dayId,
      },
    },
    updatedAt: Date.now(),
  });
}

// 纯 merge：把一天的结果并入 meta，返回新对象（不可变）。
//
// 幂等性说明：
// - bestGrades（取 max）、unlockedDayIds（集合并）、lifetimeAchievements（集合并）天然幂等，
//   重复调用同一结果不会改变它们。
// - records 的累计计数（totalRuns / totalResolved / totalComplaints）**不是**幂等的，
//   重复调用会重复累加。防重复计数由调用方（useMetaProgress 经 App 的 ref 守卫）保证：
//   每个 summary 只调用一次。
export function recordDayResult(meta: MetaState, result: DayResult): MetaStateWithLegacy {
  const modeId = result.modeId ?? meta.activeModeId ?? legacyModeId;
  const config = supportModes[modeId] ?? supportModes[legacyModeId];
  const day = getCareerDay(result.dayId, config);

  if (!day) {
    // 未知天 id：不动 meta，避免脏数据污染持久化。
    return withLegacyFields(meta);
  }

  const currentModeProgress = getModeProgress(meta, modeId);

  // 最佳评级取 max：若旧评级已经达到（>=）本次评级，保留旧的。
  const previousGrade = currentModeProgress.bestGrades[result.dayId];
  const bestGrade =
    previousGrade && isPassingGrade(previousGrade, result.grade) ? previousGrade : result.grade;
  const bestGrades = { ...currentModeProgress.bestGrades, [result.dayId]: bestGrade };

  // 过关则解锁下一天。
  let unlockedDayIds = currentModeProgress.unlockedDayIds;

  if (isPassingGrade(result.grade, day.passGrade)) {
    const nextDayId = getNextDayId(result.dayId, config);

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
    bestReplySeconds: Math.min(
      meta.records.bestReplySeconds ?? Number.POSITIVE_INFINITY,
      result.fastestReplySeconds ?? Number.POSITIVE_INFINITY,
    ),
  };

  // 用并入后的 records / 成就重新推导解锁的卡。
  // 解锁单调：已解锁的卡不会因为后续数据回落而消失（用集合并保证）。
  const nextMeta: MetaState = {
    ...meta,
    activeModeId: modeId,
    modes: {
      ...ensureModeProgressMap(meta.modes),
      [modeId]: {
        currentDayId: currentModeProgress.currentDayId,
        unlockedDayIds,
        bestGrades,
      },
    },
    lifetimeAchievements,
    records,
  };

  return withLegacyFields({
    ...nextMeta,
    unlockedCardIds: evaluateUnlocks(nextMeta),
    updatedAt: Date.now(),
  });
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

export function loadMeta(): MetaStateWithLegacy {
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
    const envelope: PersistedMeta = { version: META_VERSION, data: stripLegacyFields(meta) };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
  } catch {
    // localStorage 不可用（隐私模式 / 配额满）：静默降级，游戏仍可玩，只是不持久化。
  }
}

// 把解析出的任意 JSON 迁移成当前版本的 MetaState。
// 损坏 → defaultMeta；v1 数据 → 迁移进 workplace；v2 数据 → 逐字段校验回填。
export function migrate(parsed: unknown): MetaStateWithLegacy {
  if (!isRecord(parsed)) {
    return defaultMeta();
  }

  if (parsed.version === 1 && isRecord(parsed.data)) {
    return migrateV1Meta(parsed.data);
  }

  if (parsed.version !== META_VERSION || !isRecord(parsed.data)) {
    return defaultMeta();
  }

  return coerceMetaState(parsed.data);
}

function migrateV1Meta(data: Record<string, unknown>): MetaStateWithLegacy {
  const base = defaultMeta();
  const workplace = coerceModeProgress(data, legacyModeId);

  return withLegacyFields({
    activeModeId: legacyModeId,
    modes: {
      ...base.modes,
      [legacyModeId]: workplace,
    },
    lifetimeAchievements: isStringArray(data.lifetimeAchievements)
      ? (data.lifetimeAchievements as AchievementId[])
      : base.lifetimeAchievements,
    records: coerceRecords(data.records, base.records),
    unlockedCardIds: isStringArray(data.unlockedCardIds) ? data.unlockedCardIds : base.unlockedCardIds,
  });
}

// 逐字段校验：任一字段类型不对就用默认值兜底，最大化保留有效数据。
function coerceMetaState(data: Record<string, unknown>): MetaStateWithLegacy {
  const base = defaultMeta();
  const activeModeId = isSupportModeId(data.activeModeId) ? data.activeModeId : base.activeModeId;

  return withLegacyFields({
    activeModeId,
    modes: isRecord(data.modes) ? coerceModeProgressMap(data.modes) : base.modes,
    lifetimeAchievements: isStringArray(data.lifetimeAchievements)
      ? (data.lifetimeAchievements as AchievementId[])
      : base.lifetimeAchievements,
    records: coerceRecords(data.records, base.records),
    unlockedCardIds: isStringArray(data.unlockedCardIds) ? data.unlockedCardIds : base.unlockedCardIds,
    updatedAt: isFiniteNumber(data.updatedAt) ? data.updatedAt : undefined,
  });
}

function coerceModeProgressMap(value: Record<string, unknown>) {
  return supportModeOrder.reduce<Record<SupportModeId, ModeProgress>>(
    (modes, modeId) => ({
      ...modes,
      [modeId]: coerceModeProgress(value[modeId], modeId),
    }),
    {} as Record<SupportModeId, ModeProgress>,
  );
}

function ensureModeProgressMap(modes: Partial<Record<SupportModeId, ModeProgress>> | undefined) {
  return supportModeOrder.reduce<Record<SupportModeId, ModeProgress>>(
    (nextModes, modeId) => ({
      ...nextModes,
      [modeId]: modes?.[modeId] ?? defaultModeProgress(modeId),
    }),
    {} as Record<SupportModeId, ModeProgress>,
  );
}

function buildDefaultModeProgressMap() {
  return supportModeOrder.reduce<Record<SupportModeId, ModeProgress>>(
    (modes, modeId) => ({
      ...modes,
      [modeId]: defaultModeProgress(modeId),
    }),
    {} as Record<SupportModeId, ModeProgress>,
  );
}

function defaultModeProgress(modeId: SupportModeId): ModeProgress {
  const firstDay = supportModes[modeId].days[0];

  return {
    currentDayId: firstDay.id,
    unlockedDayIds: [firstDay.id],
    bestGrades: {},
  };
}

function coerceModeProgress(value: unknown, modeId: SupportModeId): ModeProgress {
  const base = defaultModeProgress(modeId);

  if (!isRecord(value)) {
    return base;
  }

  return {
    currentDayId: isKnownDayId(modeId, value.currentDayId)
      ? value.currentDayId
      : base.currentDayId,
    unlockedDayIds:
      isStringArray(value.unlockedDayIds) && value.unlockedDayIds.some((dayId) => isKnownDayId(modeId, dayId))
        ? value.unlockedDayIds.filter((dayId) => isKnownDayId(modeId, dayId))
        : base.unlockedDayIds,
    bestGrades: isGradeRecord(value.bestGrades) ? filterKnownBestGrades(value.bestGrades, modeId) : base.bestGrades,
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
    bestReplySeconds: isFiniteNumber(value.bestReplySeconds)
      ? value.bestReplySeconds
      : base.bestReplySeconds,
  };
}

function withLegacyFields(meta: MetaState): MetaStateWithLegacy {
  const progress = getModeProgress(meta, meta.activeModeId);

  return {
    ...meta,
    currentDayId: progress.currentDayId,
    unlockedDayIds: progress.unlockedDayIds,
    bestGrades: progress.bestGrades,
  };
}

function stripLegacyFields(meta: MetaState): MetaState {
  return {
    activeModeId: meta.activeModeId,
    modes: ensureModeProgressMap(meta.modes),
    lifetimeAchievements: meta.lifetimeAchievements,
    records: meta.records,
    unlockedCardIds: meta.unlockedCardIds,
    updatedAt: meta.updatedAt,
  };
}

function filterKnownBestGrades(bestGrades: Record<string, Grade>, modeId: SupportModeId) {
  return Object.entries(bestGrades).reduce<Record<string, Grade>>((filtered, [dayId, grade]) => {
    if (isKnownDayId(modeId, dayId)) {
      filtered[dayId] = grade;
    }

    return filtered;
  }, {});
}

function isKnownDayId(modeId: SupportModeId, dayId: unknown): dayId is string {
  return typeof dayId === "string" && supportModes[modeId].days.some((day) => day.id === dayId);
}

function isSupportModeId(value: unknown): value is SupportModeId {
  return typeof value === "string" && value in supportModes;
}

const VALID_GRADES: readonly Grade[] = ["S", "A", "B", "C", "D"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
