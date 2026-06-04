import { useCallback, useEffect, useState } from "react";
import {
  defaultMeta,
  loadMeta,
  recordDayResult as mergeDayResult,
  saveMeta,
} from "../game/meta";
import type { DayResult, MetaState } from "../game/meta";

export interface UseMetaProgress {
  meta: MetaState;
  /** 切换当前选中的天（进入值班时调用）。 */
  selectDay: (dayId: string) => void;
  /** 一天结束时并入结果：更新最佳评级 / 解锁 / 记录。调用方需保证每个 summary 只调一次。 */
  recordDayResult: (result: DayResult) => void;
  /** 重置整条生涯到初始状态。 */
  resetCareer: () => void;
}

export function useMetaProgress(): UseMetaProgress {
  // 懒初始化：只在挂载时读一次 localStorage。
  // StrictMode 下 useState 的初始化器只调用一次，不会双读，因此安全。
  const [meta, setMeta] = useState<MetaState>(() => loadMeta());

  // 持久化：只在 meta 对象变化时写盘。
  // 关键——依赖数组是 [meta]，而非 GameState；1 秒 TICK 不触碰 meta，
  // 因此永远不会进入这条写盘路径。
  useEffect(() => {
    saveMeta(meta);
  }, [meta]);

  const selectDay = useCallback((dayId: string) => {
    setMeta((prev) => (prev.currentDayId === dayId ? prev : { ...prev, currentDayId: dayId }));
  }, []);

  const recordDayResult = useCallback((result: DayResult) => {
    setMeta((prev) => mergeDayResult(prev, result));
  }, []);

  const resetCareer = useCallback(() => {
    setMeta(defaultMeta());
  }, []);

  return { meta, selectDay, recordDayResult, resetCareer };
}
