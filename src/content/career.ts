import { replyCards } from "./replyCards";
import { policies } from "./policies";
import { possibleEvents } from "./events";
import { unlockableCards } from "./unlockableCards";
import type { CareerConfig, CareerDay, LevelConfig, ReplyCard } from "../game/types";

// 短线 3 天职业模式：实习第1天 → 转正前 → 转正考核。
// 难度通过三个杠杆递增：客户数变多、起始指标更紧（满意度更低/预算更少/合规更高）、
// 场景权重偏向更难安抚的客户类型（policy_checker / passive_aggressive）。
// 客户对话、回复卡、政策、随机事件全部复用现有内容，难度只由 generation + baseMetrics 决定。

const days: CareerDay[] = [
  {
    id: "internship-day-01",
    title: "实习第 1 天",
    briefing: "你被分配到售后接待席位。目标是稳住客户，也别把公司预算当灭火器。",
    baseMetrics: {
      satisfaction: 50,
      anger: 50,
      companyCost: 0,
      complianceRisk: 10,
      timeLeft: 160,
    },
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

export const career: CareerConfig = {
  days,
  replyCards,
  policies,
  possibleEvents,
};

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
const gradeRank: Record<CareerDay["passGrade"], number> = {
  D: 0,
  C: 1,
  B: 2,
  A: 3,
  S: 4,
};

export function isPassingGrade(grade: keyof typeof gradeRank, passGrade: CareerDay["passGrade"]) {
  return gradeRank[grade] >= gradeRank[passGrade];
}
