import type {
  CustomInterviewInsight,
  InterviewDifficulty,
  InterviewCustomization,
  InterviewQuestion,
  InterviewRole,
  Interviewer,
} from "./types";

export const interviewRoles: InterviewRole[] = [
  {
    id: "frontend",
    title: "前端工程师",
    field: "技术岗位",
    mission: "把复杂业务做成稳定、顺手、可维护的界面体验。",
    competencies: ["工程基础", "组件设计", "性能意识", "协作沟通"],
    keywords: [
      "组件",
      "状态",
      "性能",
      "缓存",
      "测试",
      "可维护",
      "工程化",
      "用户体验",
      "接口",
      "复盘",
    ],
    starterQuestions: [
      "请你介绍一个最能代表你前端能力的项目。你负责了什么，最后结果如何？",
      "如果一个页面首屏明显变慢，你会怎么定位和优化？",
      "讲一次你和产品、后端意见不一致的经历，你是怎么推进的？",
    ],
  },
  {
    id: "product",
    title: "产品经理",
    field: "产品岗位",
    mission: "在用户价值、业务目标和资源约束之间做清晰判断。",
    competencies: ["需求判断", "用户洞察", "指标意识", "跨团队推进"],
    keywords: [
      "用户",
      "场景",
      "需求",
      "指标",
      "转化",
      "留存",
      "优先级",
      "验证",
      "数据",
      "业务",
    ],
    starterQuestions: [
      "请介绍一个你从 0 到 1 或从 1 到 N 推进过的产品项目。",
      "当业务方提出一个你认为价值不高的需求，你会怎么处理？",
      "如果核心指标连续两周下滑，你会如何拆解问题？",
    ],
  },
  {
    id: "sales",
    title: "销售/运营",
    field: "增长岗位",
    mission: "识别机会、推进成交，并把客户关系经营成可复用的方法。",
    competencies: ["目标拆解", "客户洞察", "转化推进", "复盘迭代"],
    keywords: [
      "客户",
      "线索",
      "转化",
      "成交",
      "复购",
      "目标",
      "渠道",
      "话术",
      "数据",
      "复盘",
    ],
    starterQuestions: [
      "请讲一个你成功拿下客户或提升转化的案例。",
      "面对一个迟迟不回复的高潜客户，你会如何推进？",
      "如果本月目标完成率只有 60%，你会怎么调整接下来的动作？",
    ],
  },
];

export const interviewers: Interviewer[] = [
  {
    id: "lin",
    name: "林老师",
    title: "温和型 HR",
    style: "关注表达、动机和岗位匹配，会给候选人较多展开空间。",
    pressure: 1,
    initials: "林",
  },
  {
    id: "chen",
    name: "陈经理",
    title: "业务主管",
    style: "重视结果、过程和取舍，会追问业务价值。",
    pressure: 2,
    initials: "陈",
  },
  {
    id: "zhou",
    name: "周工",
    title: "专业面试官",
    style: "喜欢细节、原理和边界条件，会拆项目里的真实贡献。",
    pressure: 3,
    initials: "周",
  },
  {
    id: "gao",
    name: "高总",
    title: "压力型终面官",
    style: "问题直接，要求候选人在质疑里保持结构和证据。",
    pressure: 4,
    initials: "高",
  },
];

export const difficultyLabels: Record<InterviewDifficulty, string> = {
  junior: "初级",
  mid: "中级",
  senior: "高级",
};

export const difficultyDescriptions: Record<InterviewDifficulty, string> = {
  junior: "重视表达完整、基础认知和学习潜力。",
  mid: "重视独立负责、协作推进和可量化结果。",
  senior: "重视复杂问题判断、方法沉淀和影响力。",
};

const sharedQuestions: Record<InterviewDifficulty, InterviewQuestion[]> = {
  junior: [
    {
      id: "intro",
      title: "自我介绍",
      prompt: "请用 1 分钟介绍你自己，并说明你为什么适合这个岗位。",
      focus: ["clarity", "structure", "roleFit"],
    },
    {
      id: "project",
      title: "项目经历",
      prompt: "请讲一个你参与度最高的项目，说明背景、你的动作和最终结果。",
      focus: ["structure", "evidence", "roleFit"],
    },
    {
      id: "growth",
      title: "成长复盘",
      prompt: "讲一次你做得不够好的经历。你后来具体改了什么？",
      focus: ["clarity", "resilience", "evidence"],
    },
  ],
  mid: [
    {
      id: "impact",
      title: "业务影响",
      prompt: "请讲一个你独立负责并产生明确结果的项目。你如何证明它有效？",
      focus: ["structure", "evidence", "roleFit"],
    },
    {
      id: "conflict",
      title: "冲突推进",
      prompt: "当团队目标、资源或观点发生冲突时，你如何推动事情继续往前走？",
      focus: ["clarity", "structure", "resilience"],
    },
    {
      id: "priority",
      title: "优先级判断",
      prompt: "如果同一周有多个紧急任务同时出现，你会怎么排序和沟通风险？",
      focus: ["structure", "roleFit", "resilience"],
    },
  ],
  senior: [
    {
      id: "strategy",
      title: "复杂判断",
      prompt: "请讲一次你在信息不完整的情况下做关键判断的经历。你如何降低误判风险？",
      focus: ["structure", "evidence", "resilience"],
    },
    {
      id: "influence",
      title: "影响力",
      prompt: "你如何让一个团队采用你的方案？请说明你改变了谁的判断，以及凭什么改变。",
      focus: ["clarity", "evidence", "roleFit"],
    },
    {
      id: "system",
      title: "体系沉淀",
      prompt: "过去的经验里，有没有一套你沉淀下来的方法，可以迁移到新团队？",
      focus: ["structure", "evidence", "roleFit"],
    },
  ],
};

export function getInterviewQuestions(
  role: InterviewRole,
  difficulty: InterviewDifficulty,
  customization?: InterviewCustomization,
): InterviewQuestion[] {
  const roleQuestion = role.starterQuestions[difficulty === "junior" ? 0 : difficulty === "mid" ? 1 : 2];
  const customInsight = buildCustomInterviewInsight(role, customization);

  return [
    ...customInsight.prompts,
    {
      id: `${role.id}-role-fit`,
      title: `${role.title}匹配度`,
      prompt: roleQuestion,
      focus: ["roleFit", "evidence", "structure"],
      source: "role",
    },
    ...sharedQuestions[difficulty].map((question) => ({ ...question, source: "shared" as const })),
  ];
}

export function buildCustomInterviewInsight(
  role: InterviewRole,
  customization?: InterviewCustomization,
): CustomInterviewInsight {
  const jdSignals = extractSignals(customization?.jdText ?? "", role.keywords);
  const resumeSignals = extractSignals(customization?.resumeText ?? "", role.keywords);
  const keywords = Array.from(new Set([...jdSignals, ...resumeSignals, ...role.keywords.slice(0, 4)])).slice(0, 8);
  const hasCustomization = jdSignals.length > 0 || resumeSignals.length > 0;

  if (!hasCustomization) {
    return {
      keywords,
      jdSignals,
      resumeSignals,
      prompts: [],
    };
  }

  const jdFocus = jdSignals[0] ?? keywords[0] ?? role.competencies[0];
  const resumeFocus = resumeSignals[0] ?? keywords[1] ?? role.competencies[1];
  const bridgeFocus = jdSignals.find((signal) => resumeSignals.includes(signal)) ?? jdFocus;

  return {
    keywords,
    jdSignals,
    resumeSignals,
    prompts: [
      {
        id: `${role.id}-custom-bridge`,
        title: "JD 定制追问",
        prompt: `这份岗位信息里很看重“${jdFocus}”。请结合你的经历说明：你为什么能胜任这一点？最好给出具体场景、动作和结果。`,
        focus: ["roleFit", "evidence", "structure"],
        source: "custom",
        evidenceHints: [jdFocus, bridgeFocus],
      },
      {
        id: `${role.id}-custom-resume`,
        title: "简历细节核验",
        prompt: `你的材料里出现了“${resumeFocus}”。如果我是面试官，我会追问：这件事里你本人最关键的贡献是什么，如何证明不是团队自然结果？`,
        focus: ["evidence", "clarity", "resilience"],
        source: "custom",
        evidenceHints: [resumeFocus],
      },
    ],
  };
}

function extractSignals(text: string, roleKeywords: string[]) {
  const normalized = text.trim();

  if (!normalized) {
    return [];
  }

  const candidates = [
    ...roleKeywords,
    "增长",
    "转化",
    "留存",
    "性能",
    "架构",
    "组件",
    "数据",
    "用户",
    "项目",
    "团队",
    "沟通",
    "推进",
    "复盘",
    "成本",
    "效率",
    "质量",
    "交付",
    "策略",
    "客户",
    "指标",
  ];

  const keywordHits = candidates.filter((keyword) => normalized.includes(keyword));
  const phraseHits = Array.from(normalized.matchAll(/[A-Za-z][A-Za-z0-9+#.-]{1,20}|[\u4e00-\u9fa5]{2,8}/g))
    .map((match) => match[0])
    .filter((word) => word.length >= 2 && !isWeakSignal(word))
    .slice(0, 18);

  return Array.from(new Set([...keywordHits, ...phraseHits])).slice(0, 8);
}

function isWeakSignal(word: string) {
  return [
    "我们",
    "负责",
    "岗位",
    "要求",
    "相关",
    "工作",
    "能力",
    "经验",
    "熟悉",
    "进行",
    "以及",
    "通过",
    "一个",
    "这个",
    "需要",
  ].includes(word);
}
