import type { MetricDelta, ReplyAssessment, ReplyCard, ReplyReactionKind, ToneTag } from "./types";

const orderedToneTags: ToneTag[] = [
  "pushback",
  "apology",
  "empathy",
  "investigate",
  "refund_check",
  "logistics",
  "policy",
  "compensation",
  "reject",
  "supervisor",
  "template",
];

const concreteToneTags: ToneTag[] = [
  "apology",
  "empathy",
  "investigate",
  "refund_check",
  "logistics",
  "policy",
  "compensation",
  "reject",
  "supervisor",
];

const tagRules: Array<{ tag: ToneTag; patterns: RegExp[]; weight?: number }> = [
  {
    tag: "pushback",
    patterns: [
      /爱咋咋地/,
      /不伺候/,
      /不干了/,
      /你去投诉/,
      /随便投诉/,
      /关我什么事/,
      /自己看着办/,
      /别烦/,
      /别跟我吵/,
      /爱买不买/,
    ],
    weight: 5,
  },
  {
    tag: "apology",
    patterns: [
      /抱歉|不好意思|对不起|歉意|很遗憾/,
      /体验.*(不好|不佳)|给.*带来.*(不便|麻烦|影响)/,
      /(耽误|影响).*时间/,
      /是我们.*(没做好|不到位)/,
    ],
  },
  {
    tag: "empathy",
    patterns: [
      /理解(?!与支持|您的理解)|明白|知道.*(着急|担心|不方便|困扰)|能体会/,
      /确实.*(着急|影响|麻烦|不方便)/,
      /换成我也|别急|辛苦|感受/,
      /(老人|孩子|急用|等着用|请假).*?(不方便|着急|影响|耽误)?/,
    ],
  },
  {
    tag: "investigate",
    patterns: [
      /查|核实|确认|看一下|帮.*看|查一下|核对/,
      /订单|记录|截图|视频|凭证|编号|后台|系统/,
      /工单|提交|跟进|回访|同步|反馈|处理进度/,
      /原因|情况|节点|详情|信息/,
      /(先|马上|现在|这边|我来).*(处理|跟进|看|查|核实|确认)/,
    ],
  },
  {
    tag: "refund_check",
    patterns: [
      /退款|退货|售后|返款|退回/,
      /质量|故障|坏了|杂音|破损|二手/,
      /复核.*(退款|退货|售后|价保)|退款.*复核/,
      /价保|保价|申请.*(通过|驳回|复核)/,
    ],
  },
  {
    tag: "logistics",
    patterns: [
      /物流|快递|包裹|中转|丢件|补发|派送|签收/,
      /运单|站点|网点|配送|发货|延误|揽收/,
      /安装|师傅|上门|预约|改约|到场/,
    ],
  },
  {
    tag: "policy",
    patterns: [
      /规则|政策|规定|条款|条件|标准|依据|范围|流程/,
      /7天|七天|时效|节点|活动类型|页面说明|平台规则/,
      /(按|根据|依据|按照).*(规则|政策|条款|标准|流程|范围)/,
      /(符合|不符合|超出).*(规则|政策|范围|条件)/,
    ],
  },
  {
    tag: "compensation",
    patterns: [
      /补偿|优惠券|赔偿|赔付|红包|减免|补贴/,
      /给.*(券|红包|补偿|赔付|补贴|减免)/,
    ],
  },
  {
    tag: "reject",
    patterns: [
      /不行|不能|无法|不支持|拒绝|不可以|没办法|办不到/,
      /不能.*(直接|立刻|马上).*(退|赔|补偿|退款)/,
      /无法.*(承诺|保证|直接处理)/,
      /超出.*(范围|政策|权限)/,
    ],
  },
  {
    tag: "supervisor",
    patterns: [
      /主管|升级|经理|专员|上级|人工复核/,
      /专人|高级客服|二线|团队|介入|加急/,
      /升级.*(处理|复核|工单|主管)/,
    ],
  },
];

const templatePatterns = [
  /亲亲/,
  /您好/,
  /感谢.*(理解|支持|耐心)/,
  /耐心等待|请您耐心|已反馈|已经反馈/,
  /祝.*(生活|购物).*愉快/,
  /这边.*为您.*处理/,
  /非常抱歉.*带来不便/,
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
    // 基于文本内容的确定性 id（不用 Date.now()）：保证 reducer 纯函数特性，
    // StrictMode 双调用与重放都能得到一致的 reaction seed。前缀 free- 确保不与
    // reactions.ts 中的具名 cardId 规则相撞，自由回复只走 tag 规则。
    id: `free-${hashText(text)}`,
    title: text,
    shortLabel: "自定义",
    description: "自由输入回复",
    tags,
    effects: buildEffects(tags),
  };
}

export function buildAssessedReplyCard(text: string, assessment?: ReplyAssessment): ReplyCard {
  const fallbackCard = buildFreeReplyCard(text);

  if (!assessment || assessment.tags.length === 0) {
    return fallbackCard;
  }

  const tags = reconcileAssessedTags(normalizeToneTags(assessment.tags), fallbackCard.tags);

  if (tags.length === 0) {
    return fallbackCard;
  }

  return {
    ...fallbackCard,
    tags,
    effects: mergeDelta(buildEffects(tags), sanitizeEffectAdjustments(assessment.effectAdjustments)),
  };
}

export function normalizeReplyAssessment(value: unknown): ReplyAssessment | undefined {
  if (!isRecord(value)) return undefined;

  const tags = Array.isArray(value.tags)
    ? normalizeToneTags(value.tags.filter(isToneTag))
    : [];

  if (tags.length === 0) {
    return undefined;
  }

  const reactionKind = isReactionKind(value.reactionKind) ? value.reactionKind : undefined;
  const coachingNote =
    typeof value.coachingNote === "string" && value.coachingNote.trim()
      ? value.coachingNote.trim().slice(0, 90)
      : undefined;
  const confidence =
    typeof value.confidence === "number" && Number.isFinite(value.confidence)
      ? Math.max(0, Math.min(1, value.confidence))
      : undefined;

  return {
    tags,
    ...(reactionKind ? { reactionKind } : {}),
    ...(coachingNote ? { coachingNote } : {}),
    ...(confidence !== undefined ? { confidence } : {}),
    effectAdjustments: sanitizeEffectAdjustments(value.effectAdjustments),
  };
}

function hashText(text: string): number {
  return Array.from(text).reduce((hash, char) => {
    return (hash * 31 + char.charCodeAt(0)) % 1000000007;
  }, 7);
}

function detectToneTags(text: string): ToneTag[] {
  const normalizedText = normalizeText(text);
  const scoreByTag = new Map<ToneTag, number>();

  for (const rule of tagRules) {
    const matchedCount = rule.patterns.filter((pattern) => pattern.test(normalizedText)).length;

    if (matchedCount > 0) {
      scoreByTag.set(rule.tag, matchedCount * (rule.weight ?? 1));
    }
  }

  if (isLikelyTemplateOnly(normalizedText, scoreByTag)) {
    return ["template"];
  }

  if (mentionsActionWithoutSpecificTag(normalizedText, scoreByTag)) {
    scoreByTag.set("investigate", Math.max(scoreByTag.get("investigate") ?? 0, 1));
  }

  const tags: ToneTag[] = orderedToneTags.filter((tag) => (scoreByTag.get(tag) ?? 0) > 0);

  if (tags.length === 0) {
    return ["empathy", "investigate"];
  }

  return tags.filter((tag) => tag !== "template" || !hasConcreteIntent(tags));
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

function normalizeText(text: string) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[，。！？；、,.!?;:："'“”‘’（）()[\]{}<>《》]/g, " ")
    .replace(/\s+/g, " ");
}

function isLikelyTemplateOnly(text: string, scoreByTag: Map<ToneTag, number>) {
  const hasTemplatePhrase = templatePatterns.some((pattern) => pattern.test(text));

  if (!hasTemplatePhrase) return false;
  if (!hasConcreteIntent(Array.from(scoreByTag.keys()))) return true;

  const concreteScore = concreteToneTags.reduce((sum, tag) => sum + (scoreByTag.get(tag) ?? 0), 0);
  return concreteScore <= 1 && text.length <= 36;
}

function hasConcreteIntent(tags: ToneTag[]) {
  return tags.some((tag) => concreteToneTags.includes(tag));
}

function mentionsActionWithoutSpecificTag(text: string, scoreByTag: Map<ToneTag, number>) {
  if (hasConcreteIntent(Array.from(scoreByTag.keys()))) {
    return false;
  }

  return /处理|跟进|安排|回访|解决|看下|看看|帮你|马上/.test(text);
}

function normalizeToneTags(tags: ToneTag[]): ToneTag[] {
  const unique = new Set(tags);
  const sortedTags = orderedToneTags.filter((tag) => unique.has(tag));
  const concreteTags = sortedTags.filter((tag) => tag !== "template" || !hasConcreteIntent(sortedTags));

  return concreteTags.length > 0 ? concreteTags : ["template"];
}

function reconcileAssessedTags(assessmentTags: ToneTag[], fallbackTags: ToneTag[]): ToneTag[] {
  const allowPushback = fallbackTags.includes("pushback");
  const mergedTags = allowPushback
    ? [...assessmentTags, "pushback" as const]
    : assessmentTags.filter((tag) => tag !== "pushback");
  const sortedTags = orderedToneTags.filter((tag) => mergedTags.includes(tag));

  return sortedTags.filter((tag) => tag !== "template" || !hasConcreteIntent(sortedTags));
}

function sanitizeEffectAdjustments(value: unknown): MetricDelta {
  if (!isRecord(value)) return {};

  const adjustments: MetricDelta = {};
  for (const metric of metricKeys) {
    const rawValue = value[metric];

    if (typeof rawValue !== "number" || !Number.isFinite(rawValue)) continue;

    adjustments[metric] = Math.max(-10, Math.min(10, Math.round(rawValue)));
  }

  return adjustments;
}

function mergeDelta(base: MetricDelta, extra: MetricDelta): MetricDelta {
  return metricKeys.reduce<MetricDelta>((nextDelta, metric) => {
    const value = (base[metric] ?? 0) + (extra[metric] ?? 0);

    if (value !== 0) {
      nextDelta[metric] = value;
    }

    return nextDelta;
  }, {});
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isToneTag(value: unknown): value is ToneTag {
  return typeof value === "string" && orderedToneTags.includes(value as ToneTag);
}

function isReactionKind(value: unknown): value is ReplyReactionKind {
  return value === "success" || value === "neutral" || value === "failure";
}

const metricKeys: Array<keyof MetricDelta> = [
  "satisfaction",
  "anger",
  "companyCost",
  "complianceRisk",
  "timeLeft",
];
