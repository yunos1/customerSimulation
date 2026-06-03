import type { Customer, CustomerRound, ReplyCard, ToneTag } from "./types";

type ReactionKind = "success" | "neutral" | "failure";

type ReactionRule = {
  cardIds?: string[];
  tags?: ToneTag[];
  kinds?: ReactionKind[];
  customerTypes?: Customer["type"][];
  lines: string[];
};

const reactionRules: ReactionRule[] = [
  {
    cardIds: ["template-reply"],
    customerTypes: ["angry_refund"],
    lines: [
      "你这句我一听就是模板。耳机坏了能不能先说怎么处理，别给我复制粘贴。",
      "先别祝我生活愉快，我现在一点都不愉快。退款复核到底能不能走？",
      "我视频都拍好了，你还回我这种标准话术？我不是来练客服阅读理解的。",
      "你这回答跟我的问题没接上。我要的是今天怎么处理，不是流程播报。",
    ],
  },
  {
    cardIds: ["template-reply"],
    customerTypes: ["lost_package"],
    lines: [
      "又是耐心等待。我的包裹卡在哪个中转站，你这句里一个字都没说。",
      "我自己也会看物流页面，别用模板把我打发走。",
      "你这回复太空了。能不能告诉我现在要不要建追踪工单？",
      "如果只是让我继续等，那我等来的可能只有更大的火气。",
    ],
  },
  {
    cardIds: ["template-reply"],
    customerTypes: ["coupon_hunter"],
    lines: [
      "模板我收到了，补偿方案我没收到。",
      "你这句说得很客气，但等于什么都没承诺。那到底有没有方案？",
      "别绕，我问的是能给到什么处理，不是客服话术完整度。",
      "这个回答太标准了，标准到像没看我的订单。",
    ],
  },
  {
    cardIds: ["template-reply"],
    lines: [
      "这句太像模板了，你先回答我刚才那个具体问题。",
      "标准话术我看懂了，但我的问题还没被处理。",
      "别急着收尾，我现在要的是明确下一步。",
      "如果只是发模板，我会默认你没有认真看这单。",
    ],
  },
  {
    cardIds: ["soft-apology"],
    kinds: ["success", "neutral"],
    lines: [
      "行，至少你先把我的情绪接住了。那下一步你准备怎么处理？",
      "你这么说我能缓一点，但别只停在安抚上。",
      "我不是非要为难你，我要的是有人真的把这事接住。",
      "态度可以，那你继续给我一个具体处理动作。",
    ],
  },
  {
    cardIds: ["soft-apology"],
    kinds: ["failure"],
    lines: [
      "光道歉没用，我的问题还是原封不动摆在这里。",
      "抱歉我听到了，方案呢？",
      "你要是真理解，就别只安慰我，给我能落地的处理。",
      "我现在不是来收道歉的，我是来解决问题的。",
    ],
  },
  {
    cardIds: ["check-order"],
    kinds: ["success", "neutral"],
    lines: [
      "可以，那你现在就查，别让我重复发一堆材料。",
      "查单可以，但你最好能告诉我查什么、多久回。",
      "你愿意核实就行，我等你的具体结果。",
      "那你把订单记录和处理节点对上，我听你下一步怎么说。",
    ],
  },
  {
    cardIds: ["check-order"],
    kinds: ["failure"],
    lines: [
      "你说查，但我没听到你要查什么、怎么查、多久回我。",
      "别把“我帮您看一下”当处理方案，你给我一个明确动作。",
      "空口说查不行，我需要你查完以后给结论。",
      "如果只是让我再发材料，那这事又回到原点了。",
    ],
  },
  {
    cardIds: ["refund-review"],
    customerTypes: ["angry_refund"],
    kinds: ["success", "neutral"],
    lines: [
      "好，你先复核退款资格。我要的是明确结论，不是继续拖。",
      "如果能按质量问题复核，那我先等你这一步。",
      "订单和视频我都能给，你别又让我从头解释一遍。",
      "这才像是在处理耳机问题。你告诉我复核后多久有结果。",
    ],
  },
  {
    cardIds: ["refund-review"],
    kinds: ["failure"],
    lines: [
      "你现在提退款复核有点对不上，我刚才问的重点不是这个。",
      "复核可以，但你得先说清楚按什么条件复核。",
      "别把复核当万能答案，我需要知道它能不能解决我这单。",
      "如果复核只是让我继续等，那我很难接受。",
    ],
  },
  {
    cardIds: ["refund-review"],
    lines: [
      "行，那你先把退款条件核清楚，别让我来回补材料。",
      "可以走复核，但你得给我一个清楚的反馈时间。",
      "那就按复核流程来，我要看到结论。",
      "你先核实资格，后面别又换一套说法。",
    ],
  },
  {
    cardIds: ["logistics-trace"],
    customerTypes: ["lost_package"],
    kinds: ["success", "neutral"],
    lines: [
      "终于说到物流了。你帮我看中转站到底卡在哪。",
      "可以，建追踪工单比让我干等靠谱多了。",
      "你给我一个追踪结果和回访时间，我还能再等等。",
      "这才是我想听的。你先确认它是不是异常件。",
    ],
  },
  {
    cardIds: ["logistics-trace"],
    kinds: ["failure"],
    lines: [
      "追物流可以，但我现在问的不只是包裹在哪，你别漏了处理方案。",
      "你说追踪，那后面是补发、退款还是继续等？",
      "只查物流不够，我还需要异常后的处理节点。",
      "如果查完还是一句耐心等待，那就没意义了。",
    ],
  },
  {
    cardIds: ["logistics-trace"],
    lines: [
      "行，你先把物流节点查清楚，再告诉我下一步。",
      "可以，你给我一个可追踪的工单或回访时间。",
      "那你先同步物流结果，别让我自己盯页面。",
      "你先查，我要听具体节点，不要泛泛而谈。",
    ],
  },
  {
    cardIds: ["quote-policy"],
    customerTypes: ["angry_refund"],
    lines: [
      "别拿规则挡问题。质量问题到底能不能走复核？",
      "政策我可以听，但你要先承认这不是我乱退。",
      "规则讲完了，然后呢？今天能不能给处理路径？",
      "如果政策里有复核条件，你就直接告诉我怎么走。",
    ],
  },
  {
    cardIds: ["quote-policy"],
    customerTypes: ["lost_package"],
    lines: [
      "规则我知道一点，但我的重点是包裹现在在哪里。",
      "政策节点可以说，但你得告诉我现在要不要建追踪工单。",
      "别只讲 48 小时 96 小时，你先确认这个件是不是异常。",
      "你把丢件后的补发/退款边界说清楚，我就知道该等到什么时候。",
    ],
  },
  {
    cardIds: ["quote-policy"],
    customerTypes: ["coupon_hunter"],
    kinds: ["success", "neutral"],
    lines: [
      "你先把规则边界说清楚也行，我听听。",
      "如果确实按规则不能给，那你把理由写清楚。",
      "行，你别乱承诺，按政策把可给和不能给的范围说清楚。",
      "我可以接受规则，但你得说明为什么我这单不适用。",
    ],
  },
  {
    cardIds: ["quote-policy"],
    kinds: ["failure"],
    lines: [
      "你这个政策说法太飘了，没落到我的订单上。",
      "条款不是挡箭牌，你得告诉我它怎么适用。",
      "我听到政策了，但没听到处理方案。",
      "别只念规则，给我一个按规则能推进的动作。",
    ],
  },
  {
    cardIds: ["quote-policy"],
    lines: [
      "规则可以讲，但你得告诉我这条规则怎么套到我的订单上。",
      "你把边界说清楚，我至少知道你不是随口糊弄。",
      "那你按政策给我一个明确处理路径，别只念条款。",
      "可以，你把适用条件和下一步一起说清楚。",
    ],
  },
  {
    cardIds: ["small-coupon"],
    customerTypes: ["coupon_hunter"],
    lines: [
      "既然能补偿，那是不是还能再申请高一点？",
      "你看，我就说这种情况应该有说法。还有别的方案吗？",
      "这个补偿我先记下，但我想确认是不是最高方案。",
      "有补偿就好说。你再帮我看下上限，别一上来就给最低档。",
    ],
  },
  {
    cardIds: ["small-coupon"],
    customerTypes: ["angry_refund", "lost_package"],
    lines: [
      "我现在不是来要券的，我要你把问题本身解决。",
      "补偿先放一边，你得先告诉我东西/退款到底怎么处理。",
      "给券不能替代处理问题，这个你别搞混了。",
      "你给我券，我的问题还是在原地，这不算解决。",
    ],
  },
  {
    cardIds: ["small-coupon"],
    lines: [
      "补偿我听到了，但它能不能解决我的核心问题？",
      "你先别急着给券，先说这单怎么处理。",
      "这个方案可以作为补充，但我还需要正式处理结论。",
      "如果只是补偿一下就结束，我不一定接受。",
    ],
  },
  {
    cardIds: ["firm-reject"],
    customerTypes: ["angry_refund"],
    lines: [
      "坏了就是坏了，你一句不支持就想结束？",
      "你这么拒绝我肯定不接受，我现在就要升级。",
      "我不是来听你说不行的，我要你给质量问题的处理办法。",
      "你拒绝可以，但得告诉我质量问题为什么不能复核。",
    ],
  },
  {
    cardIds: ["firm-reject"],
    customerTypes: ["coupon_hunter"],
    kinds: ["success", "neutral"],
    lines: [
      "不够好听，但至少你把边界说清楚了。",
      "那你把不能补偿的规则依据写清楚，我就不继续绕了。",
      "行，既然确实不能给，你别后面又换说法。",
      "我先接受这个解释，但体验分不会太高。",
    ],
  },
  {
    cardIds: ["firm-reject"],
    customerTypes: ["coupon_hunter"],
    kinds: ["failure"],
    lines: [
      "你拒绝得太快了，我会怀疑你根本没看订单。",
      "那我问最后一次：这个情况真的没有任何方案？",
      "你一句不能给就结束，我肯定不服。",
      "如果没有依据，那这听起来就是不想处理。",
    ],
  },
  {
    cardIds: ["firm-reject"],
    lines: [
      "你可以拒绝，但理由要讲清楚，不然我只会觉得你在推。",
      "直接说不行当然省事，但我的问题还在这里。",
      "你这个拒绝太硬了，我需要一个能落地的解释。",
      "可以按规则拒绝，但别把人晾在一句“不支持”里。",
    ],
  },
  {
    cardIds: ["call-supervisor"],
    customerTypes: ["angry_refund"],
    lines: [
      "可以，升级给能拍板的人，我不想在这里绕圈。",
      "主管介入可以，但你要告诉我多久有反馈。",
      "如果你权限不够，那就让有权限的人来看。",
      "行，升级复核我接受，但别升级完就没消息。",
    ],
  },
  {
    cardIds: ["call-supervisor"],
    customerTypes: ["lost_package"],
    lines: [
      "主管可以介入，但包裹追踪也得同步做。",
      "可以升级，不过你要给我工单号和回访时间。",
      "如果主管能确认丢件后的补发或退款，那就赶紧走。",
      "行，别只转给主管，你这边也先把物流异常查起来。",
    ],
  },
  {
    cardIds: ["call-supervisor"],
    customerTypes: ["coupon_hunter"],
    lines: [
      "主管能确认最终方案也行，我就是想知道上限。",
      "可以，你让能定规则的人给个准话。",
      "如果主管也说不能给，那你们把依据写明白。",
      "行，我等主管判断，但别拿升级当拖延。",
    ],
  },
  {
    cardIds: ["call-supervisor"],
    lines: [
      "可以，升级给能判断的人，但你要给反馈时间。",
      "主管介入我接受，别让我在这边空等。",
      "如果你权限不够，升级是合理的，但要有明确回访。",
      "行，那就升级处理，我要看到后续动作。",
    ],
  },
  {
    cardIds: ["push-back"],
    customerTypes: ["angry_refund"],
    lines: [
      "行，你这态度我记住了。投诉、差评、平台介入，一个都不会少。",
      "你这么说是吧？那我不跟你聊了，直接找平台。",
      "本来东西坏了就够烦，你还来这套。我现在就投诉。",
      "大不了不买你们家了，但这单我肯定追到底。",
    ],
  },
  {
    cardIds: ["push-back"],
    customerTypes: ["lost_package"],
    lines: [
      "包裹丢了你还这么说？行，我直接申请平台介入。",
      "你不想干可以，我的快递不能凭空消失。",
      "这态度我截图了，工单不用建了，我去投诉。",
      "我等了四天等来你这句，真有你们的。",
    ],
  },
  {
    cardIds: ["push-back"],
    customerTypes: ["coupon_hunter"],
    lines: [
      "行，那我也不客气了，差评和投诉我都安排。",
      "你这么硬，那我就找能管你的人聊。",
      "不给就不给，态度还这么冲，我肯定不接受。",
      "这服务体验我记下了，回头评价里见。",
    ],
  },
  {
    cardIds: ["push-back"],
    lines: [
      "行，你这态度我记住了。投诉、差评、平台介入，一个都不会少。",
      "既然你这么说，那我也没必要继续好好聊了。",
      "可以，这就是你们的服务态度，我截图了。",
      "那就别聊了，我直接走投诉流程。",
    ],
  },
  {
    tags: ["template"],
    lines: [
      "这句太像模板了，你先回答我刚才那个具体问题。",
      "标准话术我看懂了，但我的问题还没被处理。",
      "你这回答跟我说的事没接上。",
      "别急着收尾，我现在要的是明确下一步。",
    ],
  },
  {
    tags: ["apology", "empathy"],
    kinds: ["success", "neutral"],
    lines: [
      "行，至少你先把我的火气听进去了。那你继续说怎么处理。",
      "你这么说我能接受一点，但别只停在安慰上。",
      "我不需要你说得多漂亮，我需要后面真的能推进。",
      "态度我先认可，下一步给我具体一点。",
    ],
  },
  {
    tags: ["apology", "empathy"],
    kinds: ["failure"],
    lines: [
      "只共情不处理，我还是会觉得你在拖。",
      "我知道你在安抚我，但我的问题没变。",
      "这话听着舒服一点，可是方案在哪里？",
      "你理解归理解，事情还是要解决。",
    ],
  },
  {
    tags: ["investigate"],
    kinds: ["success", "neutral"],
    lines: [
      "可以，那你现在就查，别让我重复发一堆材料。",
      "查可以，但你最好能给我一个明确的下一步。",
      "你愿意核实就行，我等你的具体结果。",
      "那你先查清楚，别过会儿又让我重新解释。",
    ],
  },
  {
    tags: ["investigate"],
    kinds: ["failure"],
    lines: [
      "你说查，但我没听到你要查什么、怎么查、多久回我。",
      "别把“我帮您看一下”当处理方案，你给我一个明确动作。",
      "查可以，空口说查不行。",
      "你要查就查出结论，不要让我继续原地打转。",
    ],
  },
  {
    tags: ["refund_check"],
    customerTypes: ["angry_refund"],
    lines: [
      "好，你先复核退款资格。我要的是明确结论，不是继续拖。",
      "如果能按质量问题复核，那我先等你这一步。",
      "这才像是在回应我的退款问题。",
      "可以，但你得告诉我复核后多久有答复。",
    ],
  },
  {
    tags: ["refund_check"],
    lines: [
      "退款复核可以，但你要把条件说清楚。",
      "那你先核实资格，我等一个明确结果。",
      "可以走复核，但别让我反复补同样材料。",
      "你先看能不能进售后复核，给我结论。",
    ],
  },
  {
    tags: ["logistics"],
    customerTypes: ["lost_package"],
    lines: [
      "终于说到物流了。你帮我看中转站到底卡在哪。",
      "可以，建追踪工单比让我干等靠谱多了。",
      "你给我一个追踪结果和回访时间，我还能再等等。",
      "这才对，先确认包裹是不是异常。",
    ],
  },
  {
    tags: ["logistics"],
    lines: [
      "物流你先查清楚，我要的是具体节点。",
      "可以，你告诉我包裹状态和下一步处理。",
      "那你先同步物流结果，别只让我等。",
      "追踪可以，但要有回访时间。",
    ],
  },
  {
    tags: ["policy"],
    kinds: ["success", "neutral"],
    lines: [
      "规则可以讲，但你得告诉我这条规则怎么套到我的订单上。",
      "你把边界说清楚，我至少知道你不是随口糊弄。",
      "那你按政策给我一个明确处理路径，别只念条款。",
      "可以，你把适用条件说白了，我就知道该怎么走。",
    ],
  },
  {
    tags: ["policy"],
    kinds: ["failure"],
    lines: [
      "政策不是挡箭牌，你得说它和我这单有什么关系。",
      "别只念条款，我要听处理路径。",
      "你这个政策解释太泛了，没落到我的问题上。",
      "规则我听见了，下一步呢？",
    ],
  },
  {
    tags: ["compensation"],
    customerTypes: ["coupon_hunter"],
    lines: [
      "既然能补偿，那是不是还能再申请高一点？",
      "这个补偿我先记下，但我想确认是不是最高方案。",
      "有方案就好说，你再帮我看下上限。",
      "那还有没有别的补偿档位？",
    ],
  },
  {
    tags: ["compensation"],
    customerTypes: ["angry_refund", "lost_package"],
    lines: [
      "我现在不是来要券的，我要你把问题本身解决。",
      "补偿先放一边，你得先告诉我核心问题怎么处理。",
      "给券不能替代处理问题，这个你别搞混了。",
      "别用补偿绕开问题本身。",
    ],
  },
  {
    tags: ["compensation"],
    lines: [
      "补偿我听到了，但它不是完整方案。",
      "你先说明补偿之外怎么处理。",
      "这个可以作为补充，但我还要正式结论。",
      "如果只是给点补偿就结束，我不一定接受。",
    ],
  },
  {
    tags: ["reject"],
    kinds: ["success", "neutral"],
    lines: [
      "你可以拒绝，但理由要讲清楚，不然我只会觉得你在推。",
      "如果确实不能办，那你把依据和替代方案说清楚。",
      "行，边界我听到了，但你得给我能接受的解释。",
      "可以按规则拒绝，但别只丢一句不支持。",
    ],
  },
  {
    tags: ["reject"],
    kinds: ["failure"],
    lines: [
      "直接说不行当然省事，但我的问题还在这里。",
      "你这个拒绝太硬了，我需要一个能落地的解释。",
      "一句不能办解决不了问题。",
      "你拒绝得太快了，我很难相信你认真看了。",
    ],
  },
  {
    tags: ["supervisor"],
    kinds: ["success", "neutral"],
    lines: [
      "可以，升级给能拍板的人，我不想在这里绕圈。",
      "主管介入可以，但你要告诉我多久有反馈。",
      "如果你权限不够，那就让有权限的人来看。",
      "行，升级可以，但要给我明确回访时间。",
    ],
  },
  {
    tags: ["supervisor"],
    kinds: ["failure"],
    lines: [
      "别把升级当踢皮球，我要知道谁处理、多久回。",
      "主管可以找，但你现在也得先把问题说清楚。",
      "你要升级就给我工单和时间，不要只说转交。",
      "如果升级后还是没人回，那我一样会投诉。",
    ],
  },
  {
    tags: ["pushback"],
    lines: [
      "行，你这态度我记住了。投诉、差评、平台介入，一个都不会少。",
      "那就别聊了，我直接走投诉流程。",
      "可以，这就是你们的服务态度，我截图了。",
      "既然你这么说，我也没必要继续好好聊。",
    ],
  },
];

export function getReactionLine(
  customer: Customer,
  round: CustomerRound,
  card: ReplyCard,
  reactionKind: ReactionKind,
  seed: number,
) {
  const cardRules = reactionRules.filter((rule) =>
    rule.cardIds?.includes(card.id) && matchesContext(rule, customer, reactionKind),
  );
  const tagRules = reactionRules.filter((rule) =>
    !rule.cardIds &&
    rule.tags?.some((tag) => card.tags.includes(tag)) &&
    matchesContext(rule, customer, reactionKind),
  );
  const candidateRules = pickMostRelevantRules(
    cardRules.length > 0 ? cardRules : tagRules,
    customer,
    round,
    card,
  );

  if (candidateRules.length > 0) {
    const mixedSeed = seed + hashString(`${customer.id}:${round.id}:${card.id}:${reactionKind}`);
    const lines = candidateRules.flatMap((rule) => rule.lines);

    return pickLine(lines, mixedSeed);
  }

  if (reactionKind === "success") {
    return round.successLine;
  }

  if (reactionKind === "failure") {
    return round.failureLine;
  }

  return round.neutralLine;
}

function matchesContext(rule: ReactionRule, customer: Customer, reactionKind: ReactionKind) {
  return (
    (!rule.kinds || rule.kinds.includes(reactionKind)) &&
    (!rule.customerTypes || rule.customerTypes.includes(customer.type))
  );
}

function pickMostRelevantRules(
  rules: ReactionRule[],
  customer: Customer,
  round: CustomerRound,
  card: ReplyCard,
) {
  if (rules.length === 0) {
    return [];
  }

  const scoredRules = rules.map((rule) => ({
    rule,
    score: getRuleScore(rule, customer, round, card),
  }));
  const bestScore = Math.max(...scoredRules.map(({ score }) => score));

  return scoredRules
    .filter(({ score }) => score === bestScore)
    .map(({ rule }) => rule);
}

function getRuleScore(
  rule: ReactionRule,
  customer: Customer,
  round: CustomerRound,
  card: ReplyCard,
) {
  const primaryTag = card.tags[0];
  let score = 0;

  if (rule.cardIds?.includes(card.id)) {
    score += 80;
  }

  if (rule.customerTypes?.includes(customer.type)) {
    score += 24;
  }

  if (rule.kinds) {
    score += 8;
  }

  if (primaryTag && rule.tags?.includes(primaryTag)) {
    score += 10;
  }

  if (rule.tags?.some((tag) => round.preferredTags.includes(tag))) {
    score += 6;
  }

  if (rule.tags?.some((tag) => round.riskyTags.includes(tag))) {
    score += 3;
  }

  return score;
}

function pickLine(lines: string[], seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  const index = Math.abs(Math.floor(x)) % lines.length;

  return lines[index];
}

function hashString(value: string) {
  return Array.from(value).reduce((hash, char) => {
    return (hash * 31 + char.charCodeAt(0)) % 100000;
  }, 7);
}
