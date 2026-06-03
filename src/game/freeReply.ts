import type { MetricDelta, ReplyCard, ToneTag } from "./types";

const tagPatterns: Array<[ToneTag, string[]]> = [
  ["apology", ["抱歉", "不好意思", "对不起", "歉意", "体验不好"]],
  ["empathy", ["理解", "着急", "辛苦", "影响", "感受", "别急"]],
  ["investigate", ["查", "核实", "确认", "订单", "记录", "截图", "视频", "工单"]],
  ["refund_check", ["退款", "退货", "售后", "质量", "复核", "返款"]],
  ["logistics", ["物流", "快递", "包裹", "中转", "丢件", "补发", "派送"]],
  ["policy", ["规则", "政策", "规定", "条款", "7天", "七天", "条件", "审核"]],
  ["compensation", ["补偿", "优惠券", "券", "赔", "红包", "减免", "补贴"]],
  ["reject", ["不行", "不能", "无法", "不支持", "拒绝", "不可以", "没办法"]],
  ["supervisor", ["主管", "升级", "经理", "专员", "上级", "人工复核"]],
  [
    "pushback",
    [
      "爱咋咋地",
      "不伺候",
      "不干了",
      "你去投诉",
      "随便投诉",
      "关我什么事",
      "你自己看着办",
      "别烦",
      "别跟我吵",
      "爱买不买",
    ],
  ],
  ["template", ["亲亲", "您好", "感谢", "耐心等待", "已反馈", "祝您生活愉快"]],
];

const tagEffects: Record<ToneTag, MetricDelta> = {
  apology: { satisfaction: 3, anger: -4, timeLeft: -2 },
  empathy: { satisfaction: 3, anger: -4, timeLeft: -2 },
  investigate: { satisfaction: 3, anger: -3, timeLeft: -4 },
  refund_check: { satisfaction: 5, anger: -4, complianceRisk: -2, timeLeft: -5 },
  logistics: { satisfaction: 5, anger: -4, timeLeft: -5 },
  policy: { satisfaction: 1, anger: -1, complianceRisk: -7, timeLeft: -4 },
  compensation: { satisfaction: 8, anger: -6, companyCost: 12, complianceRisk: 4, timeLeft: -3 },
  reject: { satisfaction: -7, anger: 8, complianceRisk: -6, timeLeft: -3 },
  supervisor: { satisfaction: 4, anger: -6, complianceRisk: -10, timeLeft: -8 },
  template: { satisfaction: -2, anger: 4, timeLeft: -2 },
  pushback: { satisfaction: -45, anger: 60, complianceRisk: 45, timeLeft: -3 },
};

export function buildFreeReplyCard(text: string): ReplyCard {
  const tags = detectToneTags(text);

  return {
    id: `free-${Date.now()}`,
    title: text,
    shortLabel: "自定义",
    description: "自由输入回复",
    tags,
    effects: buildEffects(tags),
  };
}

function detectToneTags(text: string): ToneTag[] {
  const normalizedText = text.trim().toLowerCase();
  const tags = tagPatterns
    .filter(([, patterns]) => patterns.some((pattern) => normalizedText.includes(pattern.toLowerCase())))
    .map(([tag]) => tag);

  if (tags.length === 0) {
    return ["template"];
  }

  return Array.from(new Set(tags));
}

function buildEffects(tags: ToneTag[]): MetricDelta {
  return tags.reduce<MetricDelta>(
    (effects, tag) => {
      const tagEffect = tagEffects[tag];

      return {
        satisfaction: (effects.satisfaction ?? 0) + (tagEffect.satisfaction ?? 0),
        anger: (effects.anger ?? 0) + (tagEffect.anger ?? 0),
        companyCost: (effects.companyCost ?? 0) + (tagEffect.companyCost ?? 0),
        complianceRisk: (effects.complianceRisk ?? 0) + (tagEffect.complianceRisk ?? 0),
        timeLeft: (effects.timeLeft ?? 0) + (tagEffect.timeLeft ?? 0),
      };
    },
    {},
  );
}
