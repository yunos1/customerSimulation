import { useCallback, useEffect, useState } from "react";
import {
  defaultMeta,
  loadMeta,
  recordDayResult as mergeDayResult,
  selectDay as mergeSelectedDay,
  selectMode as mergeSelectedMode,
  saveMeta,
  STORAGE_KEY,
  migrate,
} from "../game/meta";
import type { DayResult, MetaState } from "../game/meta";
import type { SupportModeId } from "../content/career";

export interface UseMetaProgress {
  meta: MetaState;
  /** 切换客服玩法模式。 */
  selectMode: (modeId: SupportModeId) => void;
  /** 切换当前选中的天（进入值班时调用）。 */
  selectDay: (modeId: SupportModeId, dayId: string) => void;
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
  useEffect(() => {
    saveMeta(meta);
  }, [meta]);

  // 多标签页同步：其他标签页写盘时合并最新数据。
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== STORAGE_KEY || e.newValue == null) return;
      try {
        const incoming = migrate(JSON.parse(e.newValue));
        setMeta(incoming);
      } catch {
        // 解析失败：忽略，保持当前 meta 不变
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const selectMode = useCallback((modeId: SupportModeId) => {
    setMeta((prev) => mergeSelectedMode(prev, modeId));
  }, []);

  const selectDay = useCallback((modeId: SupportModeId, dayId: string) => {
    setMeta((prev) => mergeSelectedDay(prev, modeId, dayId));
  }, []);

  const recordDayResult = useCallback((result: DayResult) => {
    setMeta((prev) => mergeDayResult(prev, result));
  }, []);

  const resetCareer = useCallback(() => {
    setMeta(defaultMeta());
  }, []);

  return { meta, selectMode, selectDay, recordDayResult, resetCareer };
}
