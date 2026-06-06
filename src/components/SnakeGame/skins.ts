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

// 20 种食物 emoji
export const FOODS = [
  "🍎","🍓","🍇","🍉","🥭","🍋","🍒","🍑","🫐","🥝",
  "🍕","🍔","🍣","🍜","🍦","🎂","💎","🪙","⭐","⚡",
];

// 食物对应分值（index 对应 FOODS）
export const FOOD_VALUES = [
  1,1,1,1,2, 1,1,1,2,2,
  2,2,3,2,2, 3,5,5,3,4,
];
