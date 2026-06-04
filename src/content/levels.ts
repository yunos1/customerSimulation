import { buildLevelConfig, career } from "./career";
import type { LevelConfig } from "../game/types";

// activeDay 现在是职业线第一天的 LevelConfig 别名，保持对旧引用（如测试、初始加载）的兼容。
// 多关卡逻辑统一走 career.ts。
export const activeDay: LevelConfig = buildLevelConfig(career.days[0]);
