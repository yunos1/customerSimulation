import type { RandomEvent } from "../game/types";

export const possibleEvents: RandomEvent[] = [
  {
    id: "system-lag",
    title: "系统卡顿",
    description: "工单后台响应变慢，本轮处理时间减少。",
    effects: {
      timeLeft: -8,
    },
  },
  {
    id: "supervisor-away",
    title: "主管离线",
    description: "主管正在开会，升级处理会额外消耗时间。",
    effects: {
      timeLeft: -6,
      complianceRisk: 4,
    },
  },
];
