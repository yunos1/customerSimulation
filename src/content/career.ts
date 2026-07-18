import { replyCards } from "./replyCards";
import { policies as workplacePolicies } from "./policies";
import { workplaceEvents } from "./events";
import { unlockableCards } from "./unlockableCards";
import type {
  CareerConfig,
  CareerDay,
  Grade,
  LevelConfig,
  Metrics,
  PolicyEntry,
  RandomEvent,
  ReplyCard,
} from "../game/types";

export type SupportModeId = "workplace" | "comedy" | "cyber" | "midnight" | "reversal";

export interface SupportModeConfig extends CareerConfig {
  id: SupportModeId;
  title: string;
  shortTitle: string;
  category: string;
  description: string;
  mapTitle: string;
  mapIntro: string;
  headerEyebrow: string;
  headerTitle: string;
  shiftBadge: string;
  accent: "workplace" | "comedy" | "cyber" | "midnight" | "reversal";
}

const defaultMetrics: Metrics = {
  satisfaction: 50,
  anger: 50,
  companyCost: 0,
  complianceRisk: 10,
  timeLeft: 160,
};

// 模式 1：真实职场模拟。保留原有三天职业线。
const workplaceDays: CareerDay[] = [
  {
    id: "internship-day-01",
    title: "实习第 1 天",
    briefing: "你被分配到售后接待席位。目标是稳住客户，也别把公司预算当灭火器。",
    baseMetrics: defaultMetrics,
    generation: {
      customerCount: 6,
    },
    passGrade: "C",
  },
  {
    id: "internship-day-02",
    title: "转正前一天",
    briefing: "主管开始盯你的单子。客户更难缠，预算也收紧了——别再靠发券糊弄。",
    baseMetrics: {
      satisfaction: 45,
      anger: 55,
      companyCost: 0,
      complianceRisk: 18,
      timeLeft: 150,
    },
    generation: {
      customerCount: 7,
      // 偏向较真与被动攻击型，模板和乱补偿会更容易翻车。
      typeWeights: {
        policy_checker: 2,
        passive_aggressive: 2,
        coupon_hunter: 1.5,
        angry_refund: 1,
        lost_package: 1,
      },
      metricOffsets: {
        satisfaction: -4,
        anger: 4,
      },
    },
    passGrade: "B",
  },
  {
    id: "conversion-exam",
    title: "转正考核",
    briefing: "今天的表现直接决定你能不能留下。预算与合规双紧，客户全是硬骨头。",
    baseMetrics: {
      satisfaction: 42,
      anger: 58,
      companyCost: 0,
      complianceRisk: 25,
      timeLeft: 140,
    },
    generation: {
      customerCount: 8,
      typeWeights: {
        policy_checker: 2.5,
        passive_aggressive: 2.5,
        coupon_hunter: 2,
        angry_refund: 1.5,
        lost_package: 1,
      },
      metricOffsets: {
        satisfaction: -8,
        anger: 8,
      },
    },
    passGrade: "B",
  },
];

const comedyPolicies: PolicyEntry[] = [
  {
    id: "absurd-not-a-joke",
    title: "离谱问题认真接待",
    category: "接待",
    body: "客户描述再荒诞，也需先确认设备、账号和日志；不得以玩笑、玄学或“正常现象”直接结束会话。",
    relatedTags: ["empathy", "investigate"],
  },
  {
    id: "weird-smart-device",
    title: "智能设备异常行为",
    category: "设备",
    body: "涉及自动创作、异常语音、错误投递和自发打印时，应收集截图、日志、固件版本和发生时间。",
    relatedTags: ["investigate", "policy"],
  },
  {
    id: "comedy-privacy",
    title: "家庭智能隐私边界",
    category: "隐私",
    body: "设备疑似读取家庭对话、食材、梦话或账号数据时，需发起隐私复核，不得用补偿替代删除或关闭路径。",
    relatedTags: ["policy", "supervisor"],
  },
  {
    id: "absurd-compensation",
    title: "荒诞损失补偿",
    category: "补偿",
    body: "离谱体验可提供小额安抚，但必须在查证和政策边界之后；先补偿会诱发更高要求。",
    relatedTags: ["compensation", "policy"],
  },
  {
    id: "viral-risk",
    title: "传播风险升级",
    category: "升级",
    body: "客户提到截图、直播、平台发布或媒体曝光时，应申请主管协助并给出明确回访时间。",
    relatedTags: ["supervisor", "investigate"],
  },
];

const comedyEvents: RandomEvent[] = [
  {
    id: "trend-hashtag",
    title: "热搜预警",
    description: "一条“冰箱写诗”的短视频开始发酵，所有客户都更在意你是否认真。",
    effects: {
      complianceRisk: 8,
      timeLeft: -5,
    },
  },
  {
    id: "meme-screenshot",
    title: "截图流出",
    description: "客服模板截图被做成表情包，继续复制粘贴会更危险。",
    effects: {
      satisfaction: -4,
      anger: 5,
      timeLeft: -4,
    },
  },
  {
    id: "engineer-laughing",
    title: "工程师笑场",
    description: "工程师群里都在看案例截图，升级处理需要多催一轮。",
    effects: {
      timeLeft: -7,
      complianceRisk: 3,
    },
  },
  {
    id: "live-clip-raid",
    title: "直播切片突袭",
    description: "客户说正在直播连麦售后，任何冷模板都可能被放大剪辑。",
    effects: {
      anger: 6,
      complianceRisk: 5,
      timeLeft: -5,
    },
  },
  {
    id: "pr-war-room",
    title: "公关临时群拉人",
    description: "公关要你 10 分钟内给出口径摘要，分心会拖慢工单。",
    effects: {
      timeLeft: -9,
      companyCost: 3,
    },
  },
];

const comedyDays: CareerDay[] = [
  {
    id: "comedy-shift-01",
    title: "奇怪电器夜班",
    briefing: "第一批离谱客户接入：冰箱写诗、音箱分手、包裹在屋顶。重点是先别笑出声。",
    baseMetrics: {
      satisfaction: 52,
      anger: 44,
      companyCost: 0,
      complianceRisk: 12,
      timeLeft: 165,
    },
    generation: {
      scenarioSet: "comedy",
      customerCount: 6,
      scenarioPool: ["comedy-fridge-poet", "comedy-speaker-breakup", "comedy-drone-rooftop"],
    },
    passGrade: "C",
  },
  {
    id: "comedy-shift-02",
    title: "直播间事故",
    briefing: "客户开始截图和直播，荒诞问题有了传播风险。别让一个模板回复成为全网素材。",
    baseMetrics: {
      satisfaction: 48,
      anger: 50,
      companyCost: 0,
      complianceRisk: 20,
      timeLeft: 150,
    },
    generation: {
      scenarioSet: "comedy",
      customerCount: 7,
      typeWeights: {
        passive_aggressive: 2,
        policy_checker: 2,
        angry_refund: 1.5,
        lost_package: 1,
        coupon_hunter: 1,
      },
      metricOffsets: {
        satisfaction: -3,
        anger: 5,
      },
    },
    passGrade: "B",
  },
  {
    id: "comedy-shift-03",
    title: "荒诞客服春晚",
    briefing: "所有离谱案例集中爆发。你要在笑点、规则和传播危机之间活着下班。",
    baseMetrics: {
      satisfaction: 45,
      anger: 55,
      companyCost: 0,
      complianceRisk: 28,
      timeLeft: 140,
    },
    generation: {
      scenarioSet: "comedy",
      customerCount: 8,
      typeWeights: {
        policy_checker: 2.3,
        passive_aggressive: 2.2,
        angry_refund: 1.8,
        coupon_hunter: 1.5,
        lost_package: 1.3,
      },
      metricOffsets: {
        satisfaction: -7,
        anger: 8,
      },
    },
    passGrade: "B",
  },
];

const cyberPolicies: PolicyEntry[] = [
  {
    id: "neural-data-boundary",
    title: "神经数据边界",
    category: "隐私",
    body: "记忆、梦境、情绪和语音片段属于高敏数据。疑似误用时必须查日志、说明用途并提供删除路径。",
    relatedTags: ["policy", "investigate"],
  },
  {
    id: "algorithmic-delivery",
    title: "自动系统异常",
    category: "调度",
    body: "无人配送、数字身份和推荐模型出现循环或误判时，应发起人工复核，不得仅引用系统状态。",
    relatedTags: ["logistics", "supervisor"],
  },
  {
    id: "incident-escalation",
    title: "事故升级条件",
    category: "升级",
    body: "涉及监管、媒体、隐私专员、数据删除或模型训练争议时，客服需申请主管或专员介入。",
    relatedTags: ["supervisor", "policy"],
  },
  {
    id: "cyber-refund",
    title: "高敏产品退款复核",
    category: "售后",
    body: "脑机、睡眠、数字身份等高敏服务发生质量或授权争议时，可按证据发起退款、停用或账单复核。",
    relatedTags: ["refund_check", "investigate"],
  },
  {
    id: "do-not-bury-clue",
    title: "异常线索留存",
    category: "线索",
    body: "客户提到陌生画面、协议变更、训练用途或循环轨迹时，必须留存关键线索，避免用模板掩盖事故。",
    relatedTags: ["investigate", "policy"],
  },
];

const cyberEvents: RandomEvent[] = [
  {
    id: "redacted-ticket",
    title: "工单被涂黑",
    description: "历史工单的关键字段突然被隐藏，合规压力上升。",
    effects: {
      complianceRisk: 10,
      timeLeft: -5,
    },
  },
  {
    id: "unknown-admin",
    title: "陌生管理员上线",
    description: "一个未署名管理员接管部分权限，主管介入变慢。",
    effects: {
      complianceRisk: 6,
      timeLeft: -8,
    },
  },
  {
    id: "data-retention-warning",
    title: "数据留存警报",
    description: "系统提示部分客户数据即将过期，再不查证会丢失关键线索。",
    effects: {
      timeLeft: -10,
    },
  },
  {
    id: "model-drift-alert",
    title: "模型漂移告警",
    description: "客户侧模型回复风格突变，查证链路多出一层人工复核。",
    effects: {
      timeLeft: -6,
      satisfaction: -3,
      complianceRisk: 4,
    },
  },
  {
    id: "ghost-session",
    title: "幽灵会话回放",
    description: "系统弹出一段你没参与过的历史对话片段，需要先确认是否串单。",
    effects: {
      anger: 4,
      timeLeft: -5,
      complianceRisk: 5,
    },
  },
];

const cyberDays: CareerDay[] = [
  {
    id: "cyber-shift-01",
    title: "记忆产品投诉",
    briefing: "未来科技公司的客服值班开始。客户的问题听起来像故障，也像第一条线索。",
    baseMetrics: {
      satisfaction: 47,
      anger: 56,
      companyCost: 0,
      complianceRisk: 24,
      timeLeft: 155,
    },
    generation: {
      scenarioSet: "cyber",
      customerCount: 6,
      scenarioPool: ["cyber-memory-ads", "cyber-delivery-loop", "cyber-terms-audit"],
      metricOffsets: {
        satisfaction: -2,
        anger: 3,
      },
    },
    passGrade: "C",
  },
  {
    id: "cyber-shift-02",
    title: "权限异常",
    briefing: "越来越多工单指向同一个数据层。你需要查证、留痕，也要避免被系统话术带偏。",
    baseMetrics: {
      satisfaction: 43,
      anger: 61,
      companyCost: 0,
      complianceRisk: 34,
      timeLeft: 145,
    },
    generation: {
      scenarioSet: "cyber",
      customerCount: 7,
      typeWeights: {
        policy_checker: 2.4,
        angry_refund: 2,
        passive_aggressive: 1.8,
        lost_package: 1.4,
        coupon_hunter: 1,
      },
      metricOffsets: {
        satisfaction: -5,
        anger: 6,
      },
    },
    passGrade: "B",
  },
  {
    id: "cyber-shift-03",
    title: "零号协议",
    briefing: "投诉背后的产品秘密浮出水面。每个回复都可能决定客户、公司和证据的去向。",
    baseMetrics: {
      satisfaction: 40,
      anger: 66,
      companyCost: 0,
      complianceRisk: 42,
      timeLeft: 135,
    },
    generation: {
      scenarioSet: "cyber",
      customerCount: 8,
      typeWeights: {
        policy_checker: 2.8,
        angry_refund: 2.3,
        passive_aggressive: 2,
        lost_package: 1.5,
        coupon_hunter: 1.2,
      },
      metricOffsets: {
        satisfaction: -8,
        anger: 9,
      },
    },
    passGrade: "B",
  },
];

// 模式 4：深夜情绪客服。凌晨值班，客户需要的不是解决方案，是被听见。
const midnightPolicies: PolicyEntry[] = [
  {
    id: "midnight-slow-down",
    title: "放慢节奏优先",
    category: "接待",
    body: "凌晨接线不以处理速度为优先。客户情绪表达未完整前，不得直接跳至解决方案或结束会话。",
    relatedTags: ["empathy", "investigate"],
  },
  {
    id: "midnight-no-template",
    title: "禁用情感模板",
    category: "接待",
    body: "凌晨时段检测到模板话术（亲亲、呢、哦亲）将触发满意度惩罚。必须使用真实语气回应。",
    relatedTags: ["empathy"],
  },
  {
    id: "midnight-crisis-escalation",
    title: "情绪危机识别",
    category: "升级",
    body: "客户表达孤独、绝望或自我怀疑时，禁止绕回产品问题；需先确认对方状态并申请情绪专线介入。",
    relatedTags: ["supervisor", "empathy"],
  },
  {
    id: "midnight-no-rush",
    title: "不催挂线",
    category: "接待",
    body: "凌晨值班中，系统KPI不计接待时长。主动催促挂线将扣除满意度，哪怕问题已解决。",
    relatedTags: ["empathy", "policy"],
  },
];

const midnightEvents: RandomEvent[] = [
  {
    id: "midnight-silence",
    title: "沉默的电话",
    description: "客户接通后长时间不说话。等待比回复更重要。",
    effects: { timeLeft: -12 },
  },
  {
    id: "midnight-sob",
    title: "背景里有哭声",
    description: "客户在描述问题时声音哽咽，合规系统标记为高风险情绪工单。",
    effects: { complianceRisk: 8, satisfaction: 5 },
  },
  {
    id: "midnight-kpi-alert",
    title: "KPI预警推送",
    description: "系统弹出今日接待时长超标提醒，但你知道不能催。",
    effects: { complianceRisk: 5, timeLeft: -5 },
  },
  {
    id: "midnight-rain",
    title: "窗外暴雨",
    description: "线路有杂音，客户反复确认你还在，节奏必须更慢。",
    effects: { timeLeft: -8, satisfaction: 2 },
  },
  {
    id: "midnight-handoff",
    title: "白班遗留单",
    description: "白班把未闭环的情绪单甩到你这边，上下文残缺。",
    effects: { timeLeft: -7, anger: 4, complianceRisk: 3 },
  },
];

const midnightDays: CareerDay[] = [
  {
    id: "midnight-shift-01",
    title: "凌晨一点的接线",
    briefing: "大多数人睡着了，打来电话的人往往不只是为了退货。放慢节奏，先听，再说。",
    baseMetrics: {
      satisfaction: 40,
      anger: 35,
      companyCost: 0,
      complianceRisk: 8,
      timeLeft: 180,
    },
    generation: {
      customerCount: 5,
      typeWeights: {
        passive_aggressive: 2.5,
        policy_checker: 1,
        lost_package: 2,
        coupon_hunter: 0.5,
        angry_refund: 1,
      },
    },
    passGrade: "C",
  },
  {
    id: "midnight-shift-02",
    title: "情绪工单夜",
    briefing: "客户的产品问题越来越像借口。真正的诉求藏在话缝里，用模板会让他们挂断。",
    baseMetrics: {
      satisfaction: 35,
      anger: 40,
      companyCost: 0,
      complianceRisk: 14,
      timeLeft: 165,
    },
    generation: {
      customerCount: 6,
      typeWeights: {
        passive_aggressive: 3,
        lost_package: 2,
        policy_checker: 1.5,
        angry_refund: 1,
        coupon_hunter: 0.3,
      },
      metricOffsets: { satisfaction: -4, anger: 3 },
    },
    passGrade: "B",
  },
  {
    id: "midnight-shift-03",
    title: "黎明前的最后一班",
    briefing: "今晚最难的几个来电全在这里。有人在等你接，别让他们感觉只是一个工单编号。",
    baseMetrics: {
      satisfaction: 30,
      anger: 45,
      companyCost: 0,
      complianceRisk: 20,
      timeLeft: 155,
    },
    generation: {
      customerCount: 7,
      typeWeights: {
        passive_aggressive: 3.5,
        lost_package: 2.5,
        policy_checker: 1.5,
        angry_refund: 1.2,
        coupon_hunter: 0.3,
      },
      metricOffsets: { satisfaction: -6, anger: 5 },
    },
    passGrade: "B",
  },
];

// 模式 5：投诉专员反转局。你是审查其他客服的专员，判定回复是否合规。
const reversalPolicies: PolicyEntry[] = [
  {
    id: "reversal-evidence-first",
    title: "先看证据再定性",
    category: "审查",
    body: "判定客服回复违规前，必须核查完整工单记录和客户原始描述；不得依赖摘要或系统自动标记。",
    relatedTags: ["investigate", "policy"],
  },
  {
    id: "reversal-proportional",
    title: "处罚与情节相符",
    category: "处罚",
    body: "首次违规、诱导性场景和明显恶意操作适用不同处罚等级。一律重判会引发客服集体投诉。",
    relatedTags: ["policy", "supervisor"],
  },
  {
    id: "reversal-protect-whistleblower",
    title: "保护举报人",
    category: "合规",
    body: "客服举报同事或上级违规时，不得向被举报方泄露举报来源；违者触发内部合规上报。",
    relatedTags: ["policy", "supervisor"],
  },
  {
    id: "reversal-customer-side",
    title: "客户立场复核",
    category: "审查",
    body: "审查中若发现客服有充分理由但客户描述有误，可裁定为无责，并启动客户端申诉标记。",
    relatedTags: ["investigate", "refund_check"],
  },
];

const reversalEvents: RandomEvent[] = [
  {
    id: "reversal-union-threat",
    title: "客服工会施压",
    description: "本周处罚率超标，工会代表发来抗议信，所有案件复核时间延长。",
    effects: { timeLeft: -10, complianceRisk: 6 },
  },
  {
    id: "reversal-viral-case",
    title: "案件曝光",
    description: "一起你审查过的案件被媒体报道，当时的处罚结论受到公开质疑。",
    effects: { satisfaction: -6, complianceRisk: 10 },
  },
  {
    id: "reversal-false-complaint",
    title: "虚假投诉涌入",
    description: "某客服被竞争对手刷单式投诉，需要人工筛查，工作量骤增。",
    effects: { timeLeft: -8, companyCost: 5 },
  },
  {
    id: "reversal-legal-hold",
    title: "法务冻结卷宗",
    description: "法务要求相关工单进入保全，你只能在受限字段里继续审查。",
    effects: { timeLeft: -9, complianceRisk: 7 },
  },
  {
    id: "reversal-internal-leak",
    title: "内部聊天截图外泄",
    description: "审查群里的半句吐槽流出，客户与媒体同时施压。",
    effects: { anger: 5, complianceRisk: 8, satisfaction: -4 },
  },
];

const reversalDays: CareerDay[] = [
  {
    id: "reversal-shift-01",
    title: "第一批案卷",
    briefing: "你是新晋投诉专员。桌上是三起工单，客服的回复看起来没问题——但真的吗？",
    baseMetrics: {
      satisfaction: 55,
      anger: 30,
      companyCost: 0,
      complianceRisk: 15,
      timeLeft: 160,
    },
    generation: {
      customerCount: 5,
      typeWeights: {
        policy_checker: 3,
        passive_aggressive: 2,
        angry_refund: 1.5,
        lost_package: 1,
        coupon_hunter: 0.5,
      },
    },
    passGrade: "C",
  },
  {
    id: "reversal-shift-02",
    title: "灰色地带",
    briefing: "这批案件没有明显对错。客服的每个回复都有道理，客户的每个投诉也有立场。你必须做决定。",
    baseMetrics: {
      satisfaction: 50,
      anger: 38,
      companyCost: 0,
      complianceRisk: 25,
      timeLeft: 148,
    },
    generation: {
      customerCount: 6,
      typeWeights: {
        policy_checker: 3,
        passive_aggressive: 2.5,
        angry_refund: 2,
        lost_package: 1.5,
        coupon_hunter: 1,
      },
      metricOffsets: { satisfaction: -4, anger: 5 },
    },
    passGrade: "B",
  },
  {
    id: "reversal-shift-03",
    title: "内部举报",
    briefing: "一名客服举报了主管违规操作，案件牵连十几条工单。你查得越深，压力越大。",
    baseMetrics: {
      satisfaction: 44,
      anger: 48,
      companyCost: 0,
      complianceRisk: 38,
      timeLeft: 138,
    },
    generation: {
      customerCount: 7,
      typeWeights: {
        policy_checker: 3.5,
        passive_aggressive: 2.8,
        angry_refund: 2.2,
        lost_package: 1.8,
        coupon_hunter: 1,
      },
      metricOffsets: { satisfaction: -7, anger: 8 },
    },
    passGrade: "B",
  },
];

export const supportModes: Record<SupportModeId, SupportModeConfig> = {
  workplace: {
    id: "workplace",
    title: "真实职场模拟",
    shortTitle: "真实职场",
    category: "规则 / 压力 / 道德选择",
    description: "偏工单系统与职场讽刺，在满意度、成本和合规之间做取舍。",
    mapTitle: "转正之路",
    mapIntro: "从实习到转正考核，难度逐天提升。达到每天的过关评级才能解锁下一天。",
    headerEyebrow: "Simulator Box · Customer Support",
    headerTitle: "亲亲，这边不建议呢",
    shiftBadge: "实习席位 · 售后 03",
    accent: "workplace",
    days: workplaceDays,
    replyCards,
    policies: workplacePolicies,
    possibleEvents: workplaceEvents,
  },
  comedy: {
    id: "comedy",
    title: "荒诞喜剧客服",
    shortTitle: "荒诞喜剧",
    category: "离谱客户 / 短关卡 / 传播风险",
    description: "客户的问题越来越不讲理，但每个荒唐问题背后都有真实售后结构。",
    mapTitle: "离谱值班表",
    mapIntro: "从奇怪电器到直播事故，问题越荒诞越要认真接待。别让笑场变成投诉证据。",
    headerEyebrow: "Simulator Box · Absurd Support",
    headerTitle: "您好，冰箱的诗我看到了",
    shiftBadge: "夜班席位 · 怪事专线",
    accent: "comedy",
    days: comedyDays,
    replyCards,
    policies: comedyPolicies,
    possibleEvents: comedyEvents,
  },
  cyber: {
    id: "cyber",
    title: "赛博悬疑客服",
    shortTitle: "赛博悬疑",
    category: "未来产品 / 隐私线索 / 工单解谜",
    description: "你在未来科技公司接线，客户投诉逐渐揭开产品背后的秘密。",
    mapTitle: "异常工单链",
    mapIntro: "每一天的投诉都像一枚碎片。查证、留痕、升级，别让关键线索被系统吞掉。",
    headerEyebrow: "Simulator Box · Cyber Support",
    headerTitle: "欢迎接入零号协议",
    shiftBadge: "深夜席位 · 神经产品组",
    accent: "cyber",
    days: cyberDays,
    replyCards,
    policies: cyberPolicies,
    possibleEvents: cyberEvents,
  },
  midnight: {
    id: "midnight",
    title: "深夜情绪客服",
    shortTitle: "深夜情绪",
    category: "共情 / 反KPI / 情绪危机",
    description: "凌晨值班，客户打来的电话不只是投诉。放慢节奏，先听见人，再解决问题。",
    mapTitle: "凌晨值班表",
    mapIntro: "效率不是今晚的答案。用模板会让他们挂断，真心才能撑过这一班。",
    headerEyebrow: "Simulator Box · Midnight Support",
    headerTitle: "您好，我在，说吧",
    shiftBadge: "凌晨席位 · 情绪专线",
    accent: "midnight",
    days: midnightDays,
    replyCards,
    policies: midnightPolicies,
    possibleEvents: midnightEvents,
  },
  reversal: {
    id: "reversal",
    title: "投诉专员反转局",
    shortTitle: "反转局",
    category: "审查 / 灰色地带 / 内部博弈",
    description: "你不是客服，你是审查客服的人。每一份工单都是别人的失误，也可能是陷阱。",
    mapTitle: "案卷审查室",
    mapIntro: "判定合规不只是对错问题。处罚太重引发工会，太轻让客户上热搜，怎么选都是压力。",
    headerEyebrow: "Simulator Box · Reversal Mode",
    headerTitle: "案卷已到，请开始审查",
    shiftBadge: "专员席位 · 投诉复核组",
    accent: "reversal",
    days: reversalDays,
    replyCards,
    policies: reversalPolicies,
    possibleEvents: reversalEvents,
  },
};

export const supportModeOrder: SupportModeId[] = ["workplace", "comedy", "cyber", "midnight", "reversal"];

// 兼容旧引用：默认职业线仍指向模式 1。
export const career: SupportModeConfig = supportModes.workplace;

// 把一天的 CareerDay 适配成引擎消费的 LevelConfig。
// 引擎契约完全不变：它只认 LevelConfig，职业线的差异都落到 generation / baseMetrics 上。
//
// unlockedCardIds：玩家已解锁的高级卡 id。基础牌恒定可用，解锁的高级牌**追加**到牌组末尾，
// 因此默认（空）即原始 10 张基础牌，不影响第 1 天体验与既有快照。
export function buildLevelConfig(
  day: CareerDay,
  config: CareerConfig = career,
  unlockedCardIds: string[] = [],
): LevelConfig {
  return {
    id: day.id,
    title: day.title,
    briefing: day.briefing,
    baseMetrics: day.baseMetrics,
    customers: [], // 由 createInitialState 经 buildRandomizedCustomers 按 generation 生成。
    replyCards: buildDeck(config.replyCards, unlockedCardIds),
    policies: config.policies,
    possibleEvents: config.possibleEvents,
    generation: day.generation,
  };
}

// 基础牌 + 已解锁的高级牌（按 unlockableCards 定义顺序追加，保持稳定）。
function buildDeck(baseCards: ReplyCard[], unlockedCardIds: string[]): ReplyCard[] {
  if (unlockedCardIds.length === 0) {
    return baseCards;
  }

  const unlockedSet = new Set(unlockedCardIds);
  const extraCards = unlockableCards
    .filter((entry) => unlockedSet.has(entry.card.id))
    .map((entry) => entry.card);

  return extraCards.length > 0 ? [...baseCards, ...extraCards] : baseCards;
}

export function getSupportMode(modeId: SupportModeId): SupportModeConfig {
  return supportModes[modeId] ?? supportModes.workplace;
}

export function getCareerDay(dayId: string, config: CareerConfig = career): CareerDay | undefined {
  return config.days.find((day) => day.id === dayId);
}

export function getNextDayId(dayId: string, config: CareerConfig = career): string | undefined {
  const index = config.days.findIndex((day) => day.id === dayId);

  if (index < 0 || index >= config.days.length - 1) {
    return undefined;
  }

  return config.days[index + 1].id;
}

// 评级是否达到过关线。Grade 越好排序值越高。
const gradeRank: Record<Grade, number> = {
  D: 0,
  C: 1,
  B: 2,
  A: 3,
  S: 4,
};

export function isPassingGrade(grade: Grade, passGrade: Grade) {
  return gradeRank[grade] >= gradeRank[passGrade];
}
