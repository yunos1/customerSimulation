import type { UnlockableCard } from "../game/types";

// 高级回复卡：基础 10 张牌之外，靠生涯里程碑解锁的额外工具。
// 设计原则：
// - 复用现有 ToneTag，scoring 四层逻辑无需改动即可正确处理这些牌。
// - 每张牌填补基础牌的空档（更强的安抚 / 更高效的合规 / 更省成本的补偿），
//   让积累进度真正改变策略空间，而非单纯堆数值。
// - 解锁条件单调（达到即永久解锁），符合元进度直觉。

export const unlockableCards: UnlockableCard[] = [
  {
    // 共情 + 查证一步到位，比单独「安抚」「查单」更省时间——奖励熟练玩家的节奏。
    card: {
      id: "empathy-investigate",
      title: "共情倾听同时拉起后台记录",
      shortLabel: "共情查证",
      description: "一边安抚情绪一边核对事实，省去来回切换的时间。",
      tags: ["empathy", "investigate"],
      effects: {
        satisfaction: 11,
        anger: -13,
        timeLeft: -7,
      },
    },
    condition: { kind: "totalResolved", count: 10 },
    hint: "累计解决 10 位客户",
  },
  {
    // 精准合规话术：拉合规的同时不像「拒绝」那样激怒客户，给较真客户的更优解。
    card: {
      id: "precise-policy",
      title: "援引具体条款逐项说明",
      shortLabel: "精准合规",
      description: "把政策讲透，既压住合规风险又不点燃情绪，对较真客户尤其有效。",
      tags: ["policy", "investigate"],
      effects: {
        satisfaction: 4,
        anger: -5,
        complianceRisk: -18,
        timeLeft: -8,
      },
    },
    condition: { kind: "achievement", id: "policy-shield" },
    hint: "解锁成就「合规护盾」",
  },
  {
    // 增值服务替代发券：高满意度且零公司成本，奖励控本玩家。
    card: {
      id: "value-service",
      title: "提供增值服务而非现金补偿",
      shortLabel: "增值服务",
      description: "用专属服务安抚客户，满意度拉满却不烧公司预算。",
      tags: ["compensation", "empathy"],
      effects: {
        satisfaction: 14,
        anger: -11,
        companyCost: 4,
        timeLeft: -6,
      },
    },
    condition: { kind: "achievement", id: "budget-keeper" },
    hint: "解锁成就「预算守门人」",
  },
  {
    // 老练话术：转正考核级别的全能牌，需要打满几天才拿得到。
    card: {
      id: "veteran-deescalate",
      title: "老练话术快速降温并给方案",
      shortLabel: "老练话术",
      description: "资深客服的临场反应：一句话稳住情绪并抛出可执行方案。",
      tags: ["empathy", "apology", "investigate"],
      effects: {
        satisfaction: 13,
        anger: -16,
        complianceRisk: -4,
        timeLeft: -8,
      },
    },
    condition: { kind: "totalRuns", count: 5 },
    hint: "完成 5 次值班",
  },
  {
    card: {
      id: "zero-template-closer",
      title: "全程真诚应答，一针见血收尾",
      shortLabel: "真诚收尾",
      description: "不用模板的人专属：用真实表达拉高满意度并快速结单。",
      tags: ["empathy", "apology"],
      effects: {
        satisfaction: 16,
        anger: -14,
        timeLeft: -5,
      },
    },
    condition: { kind: "achievement", id: "no-template-shift" },
    hint: "解锁成就「全程真人服务」",
  },
  {
    card: {
      id: "policy-first-resolve",
      title: "查证完毕后给出有据可查的结论",
      shortLabel: "有据结案",
      description: "先查证再讲政策的标准流程奖励：大幅压住合规风险。",
      tags: ["policy", "investigate"],
      effects: {
        satisfaction: 6,
        anger: -8,
        complianceRisk: -22,
        timeLeft: -9,
      },
    },
    condition: { kind: "achievement", id: "investigate-policy-combo" },
    hint: "解锁成就「先查再说」",
  },
];
