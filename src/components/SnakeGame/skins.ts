// 10 套蛇皮肤 + 20 种食物定义

export interface SkinDef {
  name: string;
  head: string;       // 头部颜色
  body: string[];     // 身体渐变色数组
  glow?: string;      // 发光颜色
  trailOpacity?: number;
}

export const SKINS: SkinDef[] = [
  { name: "霓虹电光", head: "#00f5ff", body: ["#00f5ff", "#7b2fff", "#4a00e0"], glow: "#00f5ff" },
  { name: "烈焰火蛇", head: "#ff6b00", body: ["#ff6b00", "#ff3d00", "#8b0000"], glow: "#ff4500", trailOpacity: 0.4 },
  { name: "极光冰晶", head: "#e0f7fa", body: ["#e0f7fa", "#4dd0e1", "#006064"], glow: "#80deea" },
  { name: "彩虹糖果", head: "#ff69b4", body: ["#ff69b4", "#ffd700", "#00fa9a", "#87cefa", "#da70d6"], glow: undefined },
  { name: "赛博朋克", head: "#f0e000", body: ["#f0e000", "#1a1a1a", "#f0e000", "#1a1a1a"], glow: "#f0e000" },
  { name: "幽灵暗影", head: "#c084fc", body: ["#c084fc", "#581c87", "#1e1b4b"], glow: "#a855f7", trailOpacity: 0.2 },
  { name: "翠竹青蛇", head: "#86efac", body: ["#86efac", "#16a34a", "#14532d"] },
  { name: "银河星尘", head: "#e2e8f0", body: ["#e2e8f0", "#3b82f6", "#1e1b4b"], glow: "#93c5fd" },
  { name: "熔岩地狱", head: "#fca5a5", body: ["#fca5a5", "#dc2626", "#450a0a"], glow: "#ef4444" },
  { name: "像素复古", head: "#4ade80", body: ["#4ade80", "#166534", "#4ade80", "#166534"] },
];

// ── 食物分层 ──────────────────────────────────────────────────────────────────
// tier 0 基础（静态）、tier 1 中级（呼吸浮动）、tier 2 高级（旋转光环强发光）
// type 仍为全局 emoji 索引，FOODS 顺序按 tier 连续排列，便于客户端按 type 取图。

export interface FoodTierDef {
  emojis: string[];   // 该 tier 的 emoji
  values: number[];   // 对应分值（随机权重池）
  glow: string;       // 动效发光色
}

export const FOOD_TIERS: FoodTierDef[] = [
  // tier 0 基础：水果 / 常见食物，分值低，无动效
  {
    emojis: ["🍎","🍓","🍇","🍉","🥭","🍋","🍒","🍑","🫐","🥝","🍕","🍔","🍣","🍜"],
    values: [1, 1, 1, 2, 2],
    glow: "#7cffa0",
  },
  // tier 1 中级：甜点 / 钱币，分值中等，呼吸 + 上下浮动
  {
    emojis: ["🍦","🎂","🍩","🧁","🍰","🪙"],
    values: [3, 4, 5],
    glow: "#ffd700",
  },
  // tier 2 高级：稀有珍宝，分值高，旋转 + 光环 + 强发光
  {
    emojis: ["💎","👑","⭐","⚡","🔥","🌟"],
    values: [8, 10, 15],
    glow: "#00f5ff",
  },
];

// 扁平化 emoji 列表（type = 全局索引），以及 type -> tier 映射表
export const FOODS: string[] = FOOD_TIERS.flatMap((t) => t.emojis);

export const FOOD_TYPE_TIER: number[] = FOOD_TIERS.flatMap((t, ti) => t.emojis.map(() => ti));

// 每个 tier 在全局 FOODS 中的起始 type 索引
export const FOOD_TIER_OFFSET: number[] = (() => {
  const offsets: number[] = [];
  let acc = 0;
  for (const t of FOOD_TIERS) { offsets.push(acc); acc += t.emojis.length; }
  return offsets;
})();

// ── 技能食物 ────────────────────────────────────────────────────────────────
// 服务端权威实现效果，客户端据 food.skill 渲染、HUD 显示 buff。
// 顺序须与 src/snake-room.ts 的 SKILLS 一致（靠 key 关联，不依赖索引）。

export interface SkillDef {
  key: string;        // 唯一标识，前后端一致
  emoji: string;
  color: string;      // 光晕 / HUD 颜色
  label: string;      // 中文名
  durationMs: number; // 持续型 buff 时长；0 = 瞬发（地雷/荆棘）
}

export const SKILL_FOODS: SkillDef[] = [
  { key: "boost",  emoji: "⚡",  color: "#ffe600", label: "加速", durationMs: 10000 },
  { key: "slow",   emoji: "❄️",  color: "#7fdfff", label: "减速", durationMs: 5000 },
  { key: "mine",   emoji: "💣",  color: "#ff3b3b", label: "地雷", durationMs: 0 },
  { key: "thorn",  emoji: "🌵",  color: "#5fbf6f", label: "荆棘", durationMs: 0 },
  { key: "shield", emoji: "🛡️", color: "#4da6ff", label: "护盾", durationMs: 6000 },
  { key: "magnet", emoji: "🧲",  color: "#ff8c42", label: "磁铁", durationMs: 8000 },
  { key: "double", emoji: "💰",  color: "#ffd700", label: "双倍", durationMs: 8000 },
  { key: "ghost",  emoji: "👻",  color: "#c9b6ff", label: "穿身", durationMs: 6000 },
];

export const SKILL_BY_KEY: Record<string, SkillDef> = Object.fromEntries(
  SKILL_FOODS.map((s) => [s.key, s]),
);
