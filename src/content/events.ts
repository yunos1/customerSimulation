import type { RandomEvent } from "../game/types";

/** 真实职场模式默认事件池（也导出为 possibleEvents 兼容旧引用）。 */
export const workplaceEvents: RandomEvent[] = [
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
  {
    id: "queue-spike",
    title: "进线高峰",
    description: "促销页误触导致进线暴涨，你的处理带宽被挤占。",
    effects: {
      timeLeft: -10,
      anger: 3,
    },
  },
  {
    id: "policy-hotpatch",
    title: "政策热更新",
    description: "合规组刚推送了退款口径修订，照旧答复会抬高风险。",
    effects: {
      complianceRisk: 6,
      timeLeft: -4,
    },
  },
  {
    id: "vip-watchlist",
    title: "重点客户盯梢",
    description: "运营把一位高价值客户标成重点，满意度波动会被放大审视。",
    effects: {
      satisfaction: -3,
      complianceRisk: 3,
    },
  },
  {
    id: "kb-outage",
    title: "知识库抽风",
    description: "内部知识库部分词条 404，查证要比平时多绕一圈。",
    effects: {
      timeLeft: -7,
      satisfaction: -2,
    },
  },
];

/** @deprecated 使用 workplaceEvents；保留别名以免旧 import 断裂。 */
export const possibleEvents = workplaceEvents;
