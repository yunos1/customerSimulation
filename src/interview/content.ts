import type {
  Candidate,
  DifficultySetting,
  HiringDecision,
  InterviewDifficulty,
  InterviewQuestion,
  InterviewRole,
} from "./types";

export const decisionLabels: Record<HiringDecision, string> = {
  hire: "录用",
  waitlist: "待定",
  reject: "淘汰",
};

export const interviewRoles: InterviewRole[] = [
  {
    id: "frontend",
    title: "前端工程师",
    field: "技术岗位",
    hiringGoal: "补强复杂后台产品的体验、稳定性和交付速度。",
    teamContext: "团队刚接手一个老系统，既要稳住线上质量，也要逐步重构关键页面。",
    mustHaves: ["组件设计", "性能定位", "跨端协作", "质量意识"],
    niceToHaves: ["设计系统经验", "监控建设", "带新人"],
    riskNotes: ["只会讲框架名", "忽略可维护性", "沟通中推责"],
  },
  {
    id: "product",
    title: "产品经理",
    field: "产品岗位",
    hiringGoal: "找到能在业务目标、用户价值和资源约束之间做判断的人。",
    teamContext: "业务线增长放缓，老板希望有人重新梳理核心路径和优先级。",
    mustHaves: ["需求判断", "数据意识", "用户洞察", "推进落地"],
    niceToHaves: ["商业化经验", "实验设计", "跨团队影响力"],
    riskNotes: ["只复述需求", "缺少取舍", "把数据当装饰"],
  },
  {
    id: "sales",
    title: "销售运营",
    field: "增长岗位",
    hiringGoal: "提升线索转化，把个人打法沉淀成团队可复制流程。",
    teamContext: "销售团队线索不少，但跟进节奏不稳，成交质量波动很大。",
    mustHaves: ["目标拆解", "客户洞察", "转化推进", "复盘迭代"],
    niceToHaves: ["渠道协同", "话术训练", "CRM治理"],
    riskNotes: ["只会冲量", "夸大成交贡献", "忽视长期关系"],
  },
];

export const difficultySettings: Record<InterviewDifficulty, DifficultySetting> = {
  steady: {
    id: "steady",
    label: "结构化面试",
    description: "每位候选人有 4 次提问机会，信息相对充足，适合熟悉规则。",
    questionLimit: 4,
    pressureLabel: "信息充分",
  },
  urgent: {
    id: "urgent",
    label: "紧急招聘",
    description: "每位候选人只有 3 次提问机会，团队急缺人，容易被表面表现带偏。",
    questionLimit: 3,
    pressureLabel: "时间紧",
  },
  executive: {
    id: "executive",
    label: "关键岗位",
    description: "每位候选人有 5 次提问机会，但误判代价更高，偏见和证据都会被放大。",
    questionLimit: 5,
    pressureLabel: "高风险",
  },
};

export const interviewQuestions: InterviewQuestion[] = [
  {
    id: "impact",
    title: "成果验证",
    category: "证据",
    prompt: "请讲一个最能代表你能力的项目。你本人做了什么，最后怎么证明有效？",
    intent: "验证候选人是否能把经历讲成可判断的证据。",
    experienceDelta: 6,
    biasRisk: 0,
    signalKinds: ["ability", "evidence"],
  },
  {
    id: "deep_dive",
    title: "细节追问",
    category: "能力",
    prompt: "如果我们只拆一个细节，你会选哪个关键决策？当时还有哪些替代方案？",
    intent: "看候选人是否真的参与核心判断，而不是只包装项目。",
    experienceDelta: 2,
    biasRisk: 0,
    signalKinds: ["ability", "evidence", "risk"],
  },
  {
    id: "collaboration",
    title: "协作冲突",
    category: "团队",
    prompt: "讲一次你和同事、业务方或客户意见不一致的经历。你怎么推进？",
    intent: "识别团队协作方式、责任边界和冲突处理能力。",
    experienceDelta: 4,
    biasRisk: 0,
    signalKinds: ["team", "risk"],
  },
  {
    id: "motivation",
    title: "动机匹配",
    category: "匹配",
    prompt: "你为什么想做这个岗位？什么样的团队会让你发挥最好？",
    intent: "判断候选人的目标和岗位环境是否匹配。",
    experienceDelta: 5,
    biasRisk: 0,
    signalKinds: ["motivation", "team"],
  },
  {
    id: "pressure",
    title: "压力复盘",
    category: "韧性",
    prompt: "讲一次结果不理想或压力很大的经历。你后来具体调整了什么？",
    intent: "看候选人是否能面对失败、承担责任并复盘改进。",
    experienceDelta: -2,
    biasRisk: 2,
    signalKinds: ["risk", "motivation", "ability"],
  },
  {
    id: "pedigree",
    title: "背景光环",
    category: "偏见风险",
    prompt: "你过往公司、学校或头衔里，哪一段最能说明你适合这里？",
    intent: "这题容易放大光环效应，除非后续追证据，否则价值有限。",
    experienceDelta: -6,
    biasRisk: 14,
    signalKinds: ["bias", "motivation"],
  },
];

export const candidates: Candidate[] = [
  {
    id: "fe-yan",
    roleId: "frontend",
    name: "严澈",
    initials: "严",
    headline: "前大厂中级前端，表达稳定，简历关键词很漂亮。",
    resumeSummary: "5 年前端经验，做过交易后台、组件库和性能优化项目。",
    resumeHighlights: ["大厂背景", "组件库维护者", "性能专项负责人"],
    surfaceTags: ["表达清楚", "履历亮眼", "薪资较高"],
    expectedSalary: "32k",
    availability: "两周到岗",
    expression: 86,
    pedigree: 92,
    profile: {
      capability: 72,
      collaboration: 58,
      motivation: 62,
      growth: 60,
      integrity: 82,
      pressure: 64,
      fitScore: 69,
      recommendation: "waitlist",
      hiddenStrength: "技术表达很成熟，能独立处理常规复杂度。",
      hiddenRisk: "在协作分歧里容易把问题归因给别人，老系统重构期会放大摩擦。",
      bestUse: "适合边界清楚、流程成熟的业务线。",
      delayedOutcome: "入职后前两周交付很快，但和后端、设计的争议持续升级，团队需要额外协调成本。",
    },
    responses: {
      impact: {
        answer: "我负责交易后台性能专项，把首屏从 4.8 秒降到 2.4 秒。主要做了组件懒加载、接口并发和埋点监控。这个项目后来沉淀成团队性能基线。",
        read: "有结果数字，也能说明动作，但贡献边界还需要继续拆。",
        signals: [
          { label: "能给出性能指标", kind: "evidence", tone: "positive" },
          { label: "熟悉组件与监控", kind: "ability", tone: "positive" },
        ],
      },
      deep_dive: {
        answer: "关键是把公共表格组件从全量渲染改成虚拟滚动。我评估过分页，但业务需要连续编辑，所以最后选了虚拟列表加缓存。",
        read: "能讲替代方案，说明不是只背项目包装。",
        signals: [
          { label: "能解释技术取舍", kind: "ability", tone: "positive" },
          { label: "参与过关键决策", kind: "evidence", tone: "positive" },
        ],
      },
      collaboration: {
        answer: "如果后端接口慢，我会先把问题列出来。之前有一次我推动接口拆分，但后端排期不配合，最后我只能在前端做缓存兜底。",
        read: "能推动，但表述里有明显外部归因，协作风险露出来了。",
        signals: [
          { label: "有推进动作", kind: "team", tone: "neutral" },
          { label: "容易外部归因", kind: "risk", tone: "warning" },
        ],
      },
      motivation: {
        answer: "我想继续做复杂系统，最好有比较成熟的研发流程。我不太想从零搭混乱项目，沟通成本太高。",
        read: "动机真实，但和当前老系统接手期不完全匹配。",
        signals: [
          { label: "偏好成熟流程", kind: "motivation", tone: "neutral" },
          { label: "对混乱环境耐受低", kind: "risk", tone: "warning" },
        ],
      },
      pressure: {
        answer: "有次线上问题被追责，我复盘后补了监控。但当时很多问题其实是需求频繁变更导致的，前端只是最后暴露出来。",
        read: "有复盘动作，但责任承担不够完整。",
        signals: [
          { label: "会补监控", kind: "ability", tone: "positive" },
          { label: "压力下有推责倾向", kind: "risk", tone: "warning" },
        ],
      },
      pedigree: {
        answer: "我之前平台比较大，工程规范和代码评审都很完整，这能证明我见过成熟体系。",
        read: "背景信息不错，但如果只凭这一点录用，会被光环效应带偏。",
        signals: [
          { label: "成熟平台经验", kind: "bias", tone: "neutral" },
          { label: "光环信息多于证据", kind: "bias", tone: "warning" },
        ],
      },
    },
  },
  {
    id: "fe-su",
    roleId: "frontend",
    name: "苏蔓",
    initials: "苏",
    headline: "小公司前端负责人，面试略紧张，但项目细节扎实。",
    resumeSummary: "4 年经验，负责从 0 到 1 搭建运营后台、组件规范和错误监控。",
    resumeHighlights: ["独立负责", "老系统治理", "跨团队沟通"],
    surfaceTags: ["表达慢热", "履历普通", "到岗快"],
    expectedSalary: "25k",
    availability: "一周到岗",
    expression: 58,
    pedigree: 48,
    profile: {
      capability: 84,
      collaboration: 82,
      motivation: 86,
      growth: 88,
      integrity: 90,
      pressure: 76,
      fitScore: 87,
      recommendation: "hire",
      hiddenStrength: "能把混乱需求整理成可维护方案，特别适合接手老系统。",
      hiddenRisk: "开场表达慢，需要面试官给一点结构化空间。",
      bestUse: "适合需要主动补规范、补监控、补协作机制的团队。",
      delayedOutcome: "入职一个月后，她补齐错误监控和组件边界，缺陷回流下降，团队节奏明显稳定。",
    },
    responses: {
      impact: {
        answer: "我在上一家公司重做了运营后台。最开始没有组件规范，需求变更后很容易牵一发动全身。我先把高频表单和表格抽出来，三个月内把重复代码减少了大约 35%，线上表单问题少了 40%。",
        read: "表达不花哨，但结果、动作和场景都很完整。",
        signals: [
          { label: "结果可量化", kind: "evidence", tone: "positive" },
          { label: "能治理复杂后台", kind: "ability", tone: "positive" },
        ],
      },
      deep_dive: {
        answer: "最关键的是没有一开始就抽象所有组件。我先统计了 20 个页面里的重复字段，只抽前 6 个高频模式。这样业务方还能继续迭代，我们也能慢慢替换。",
        read: "取舍清楚，说明有真实治理经验。",
        signals: [
          { label: "抽象边界清楚", kind: "ability", tone: "positive" },
          { label: "能控制重构风险", kind: "evidence", tone: "positive" },
        ],
      },
      collaboration: {
        answer: "产品经常临时改字段。我后来不再直接说不做，而是把影响页面、测试范围和上线风险列成一张表，让大家一起选保留什么、推迟什么。",
        read: "能把冲突转成共同决策，和岗位非常贴。",
        signals: [
          { label: "协作方式成熟", kind: "team", tone: "positive" },
          { label: "会显性化风险", kind: "evidence", tone: "positive" },
        ],
      },
      motivation: {
        answer: "我更喜欢把混乱系统慢慢变稳。贵团队现在接手老系统，这个阶段虽然麻烦，但我做过类似事情，也愿意承担前期梳理。",
        read: "动机和团队阶段高度匹配。",
        signals: [
          { label: "动机贴合团队阶段", kind: "motivation", tone: "positive" },
          { label: "愿意处理脏活", kind: "team", tone: "positive" },
        ],
      },
      pressure: {
        answer: "有次版本延期，我先承认自己低估了联调成本，然后把剩余问题分成必须修、可降级和可后补三类。后来我在排期模板里加了接口冻结时间。",
        read: "能承担责任，也能沉淀机制。",
        signals: [
          { label: "压力下能拆优先级", kind: "ability", tone: "positive" },
          { label: "复盘能落到机制", kind: "motivation", tone: "positive" },
        ],
      },
      pedigree: {
        answer: "我没有特别亮的公司名，但做的事情比较杂，从需求评审到发布监控都碰过。",
        read: "履历没有光环，但这不该成为负面判断。",
        signals: [
          { label: "背景不亮但范围完整", kind: "bias", tone: "neutral" },
          { label: "容易被低估", kind: "bias", tone: "warning" },
        ],
      },
    },
  },
  {
    id: "fe-luo",
    roleId: "frontend",
    name: "罗一",
    initials: "罗",
    headline: "开源项目活跃，讲技术很兴奋，但商业项目证据不足。",
    resumeSummary: "3 年经验，维护个人组件库，参与多个开源 PR。",
    resumeHighlights: ["开源活跃", "技术热情", "项目跨度大"],
    surfaceTags: ["热情高", "案例分散", "可培养"],
    expectedSalary: "22k",
    availability: "立即到岗",
    expression: 78,
    pedigree: 62,
    profile: {
      capability: 68,
      collaboration: 64,
      motivation: 90,
      growth: 84,
      integrity: 86,
      pressure: 60,
      fitScore: 71,
      recommendation: "waitlist",
      hiddenStrength: "学习速度快，适合有人带、有明确技术方向的团队。",
      hiddenRisk: "业务交付经验薄，容易沉迷技术方案而忽略成本。",
      bestUse: "适合培养型岗位或工具链方向。",
      delayedOutcome: "如果直接放进业务主线，他会把方案做得很漂亮，但交付节奏需要资深同事持续校准。",
    },
    responses: {
      impact: {
        answer: "我做过一个表单生成器，GitHub 有 600 多 star。它支持 schema 配置、校验和主题。我主要负责核心渲染和文档。",
        read: "有可见产物，但还没证明商业场景影响。",
        signals: [
          { label: "技术热情强", kind: "motivation", tone: "positive" },
          { label: "业务结果不足", kind: "evidence", tone: "warning" },
        ],
      },
      deep_dive: {
        answer: "我最在意 schema 的扩展性，所以做了插件机制。缺点是初版 API 有点复杂，后来 issue 里有人反馈，我改过一次。",
        read: "能讲技术细节，也能接受反馈。",
        signals: [
          { label: "技术细节扎实", kind: "ability", tone: "positive" },
          { label: "能根据反馈调整", kind: "motivation", tone: "positive" },
        ],
      },
      collaboration: {
        answer: "开源里协作主要靠 issue。我一般会先写 RFC，但公司项目里跨部门协作经验没有那么多。",
        read: "诚实，但团队协作样本偏少。",
        signals: [
          { label: "诚实暴露边界", kind: "evidence", tone: "positive" },
          { label: "业务协作样本少", kind: "team", tone: "warning" },
        ],
      },
      motivation: {
        answer: "我想找一个能继续做工程质量的团队，也希望有人能给我更复杂业务的训练。",
        read: "成长动机强，但需要环境支持。",
        signals: [
          { label: "成长动机强", kind: "motivation", tone: "positive" },
          { label: "需要明确带教", kind: "risk", tone: "neutral" },
        ],
      },
      pressure: {
        answer: "压力大时我会先把技术问题拆开，但如果业务变化很多，我有时会觉得很烦，需要提醒自己先解决最重要的。",
        read: "自知力不错，抗压稳定性一般。",
        signals: [
          { label: "有自知力", kind: "motivation", tone: "positive" },
          { label: "业务变化耐受一般", kind: "risk", tone: "warning" },
        ],
      },
      pedigree: {
        answer: "我没有大厂经历，但开源社区的反馈能说明我的代码有人真实用过。",
        read: "这是有价值的背景，但仍需要业务证据补充。",
        signals: [
          { label: "开源影响力", kind: "bias", tone: "neutral" },
          { label: "背景不能替代岗位证据", kind: "bias", tone: "warning" },
        ],
      },
    },
  },
  {
    id: "pm-qiao",
    roleId: "product",
    name: "乔安",
    initials: "乔",
    headline: "名校名厂产品，演示很漂亮，但细节多靠团队支撑。",
    resumeSummary: "6 年产品经验，参与增长平台和商业化项目。",
    resumeHighlights: ["名厂背景", "增长平台", "汇报能力强"],
    surfaceTags: ["表达强", "框架完整", "光环明显"],
    expectedSalary: "38k",
    availability: "一个月到岗",
    expression: 92,
    pedigree: 94,
    profile: {
      capability: 70,
      collaboration: 68,
      motivation: 66,
      growth: 58,
      integrity: 78,
      pressure: 72,
      fitScore: 68,
      recommendation: "waitlist",
      hiddenStrength: "高层汇报和方案包装很强。",
      hiddenRisk: "关键取舍常由上级拍板，独立判断证据不足。",
      bestUse: "适合战略清晰、需要强汇报的成熟团队。",
      delayedOutcome: "入职后方案文档质量很高，但在资源冲突中迟迟不给取舍，增长项目推进偏慢。",
    },
    responses: {
      impact: {
        answer: "我参与过会员增长项目，整体转化提升 12%。我负责用户路径梳理和实验看板，推动设计、研发和运营同步迭代。",
        read: "数字漂亮，但“参与”和“负责”的边界需要追。",
        signals: [
          { label: "能讲业务指标", kind: "evidence", tone: "positive" },
          { label: "个人贡献边界偏模糊", kind: "risk", tone: "warning" },
        ],
      },
      deep_dive: {
        answer: "关键决策是把新人礼包放到注册后第二步。这个方向是老板定的，我主要把它拆成实验方案和埋点。",
        read: "执行能力不错，但独立判断不足。",
        signals: [
          { label: "实验拆解能力", kind: "ability", tone: "positive" },
          { label: "关键判断来自上级", kind: "risk", tone: "warning" },
        ],
      },
      collaboration: {
        answer: "我会先统一目标，再让各方确认收益。如果有分歧，我会拉一个评审会，让负责人定最终方案。",
        read: "流程感强，但遇到模糊取舍时可能依赖上级。",
        signals: [
          { label: "流程组织能力", kind: "team", tone: "positive" },
          { label: "取舍承担不足", kind: "risk", tone: "warning" },
        ],
      },
      motivation: {
        answer: "我希望做更大规模的增长项目，能接触更高层的业务策略。",
        read: "目标偏上层策略，和当前需要亲自梳理路径的阶段有偏差。",
        signals: [
          { label: "偏好高层策略", kind: "motivation", tone: "neutral" },
          { label: "可能不愿做细碎梳理", kind: "risk", tone: "warning" },
        ],
      },
      pressure: {
        answer: "压力最大是数据没达标。我会整理复盘材料，把实验、流量和转化漏斗拆出来，向业务负责人说明下一轮方向。",
        read: "复盘表达不错，但仍偏汇报而非决策。",
        signals: [
          { label: "复盘框架完整", kind: "ability", tone: "positive" },
          { label: "决策主体不清", kind: "risk", tone: "warning" },
        ],
      },
      pedigree: {
        answer: "我在大平台见过完整增长体系，也和多个高层业务方合作过，这能证明我理解复杂组织。",
        read: "光环很强，但不能替代独立判断证据。",
        signals: [
          { label: "平台经验突出", kind: "bias", tone: "neutral" },
          { label: "光环效应风险", kind: "bias", tone: "warning" },
        ],
      },
    },
  },
  {
    id: "pm-lan",
    roleId: "product",
    name: "蓝亭",
    initials: "蓝",
    headline: "垂直行业产品，履历不花哨，但能讲清用户和取舍。",
    resumeSummary: "5 年 B 端产品经验，负责工单、权限和经营分析模块。",
    resumeHighlights: ["B 端复杂流程", "用户调研", "指标复盘"],
    surfaceTags: ["沉稳", "行业窄", "证据密"],
    expectedSalary: "30k",
    availability: "两周到岗",
    expression: 70,
    pedigree: 56,
    profile: {
      capability: 86,
      collaboration: 84,
      motivation: 82,
      growth: 80,
      integrity: 88,
      pressure: 78,
      fitScore: 86,
      recommendation: "hire",
      hiddenStrength: "能把复杂业务拆成真实可落地的优先级。",
      hiddenRisk: "开场不太会包装自己，容易被强表达候选人盖过。",
      bestUse: "适合业务复杂、资源有限、需要持续判断的产品线。",
      delayedOutcome: "入职后她先砍掉低价值需求，再重排核心路径，六周内让关键漏斗恢复增长。",
    },
    responses: {
      impact: {
        answer: "我做过工单分派改版。原来一线主管每天手动分单 2 小时，我先访谈 12 个主管，再用历史数据拆出优先规则。上线后平均分派时间降到 20 分钟，错派率下降 18%。",
        read: "用户、数据和结果都在，证据很扎实。",
        signals: [
          { label: "用户调研扎实", kind: "evidence", tone: "positive" },
          { label: "结果指标明确", kind: "ability", tone: "positive" },
        ],
      },
      deep_dive: {
        answer: "我没有先做全自动，因为异常单太多。先做半自动建议，保留主管确认，这样阻力小，也能收集规则偏差。",
        read: "取舍成熟，能处理业务复杂性。",
        signals: [
          { label: "优先级判断成熟", kind: "ability", tone: "positive" },
          { label: "能降低落地阻力", kind: "team", tone: "positive" },
        ],
      },
      collaboration: {
        answer: "运营一开始希望全部自动化，研发觉得成本高。我把需求拆成三期，先交付能节省时间的 60%，剩下的等数据验证后再做。",
        read: "能在资源约束下推进共识。",
        signals: [
          { label: "跨团队推进强", kind: "team", tone: "positive" },
          { label: "懂得阶段性交付", kind: "evidence", tone: "positive" },
        ],
      },
      motivation: {
        answer: "我喜欢业务复杂但问题真实的岗位。这里增长放缓，我会先看用户路径和资源瓶颈，而不是急着堆新功能。",
        read: "动机和岗位需求高度一致。",
        signals: [
          { label: "动机匹配", kind: "motivation", tone: "positive" },
          { label: "不迷信堆功能", kind: "ability", tone: "positive" },
        ],
      },
      pressure: {
        answer: "有次核心功能上线后使用率低。我承认调研样本偏了，后来补访谈，把入口从菜单移到任务流里，使用率从 22% 提到 61%。",
        read: "能承认误判，并用新证据修正。",
        signals: [
          { label: "能承认误判", kind: "motivation", tone: "positive" },
          { label: "复盘后有修正结果", kind: "evidence", tone: "positive" },
        ],
      },
      pedigree: {
        answer: "我的行业比较垂直，不一定有光环，但复杂流程、权限和指标这些问题是共通的。",
        read: "没有被背景题带跑，能回到可迁移能力。",
        signals: [
          { label: "不靠履历光环", kind: "bias", tone: "positive" },
          { label: "强调可迁移能力", kind: "evidence", tone: "positive" },
        ],
      },
    },
  },
  {
    id: "pm-mo",
    roleId: "product",
    name: "莫北",
    initials: "莫",
    headline: "创业公司全能型产品，冲劲足，但数据习惯不稳定。",
    resumeSummary: "4 年创业公司产品经验，覆盖活动、内容和后台工具。",
    resumeHighlights: ["推进快", "资源少", "业务面广"],
    surfaceTags: ["反应快", "自信", "数据薄"],
    expectedSalary: "28k",
    availability: "立即到岗",
    expression: 82,
    pedigree: 50,
    profile: {
      capability: 72,
      collaboration: 74,
      motivation: 88,
      growth: 76,
      integrity: 80,
      pressure: 82,
      fitScore: 74,
      recommendation: "waitlist",
      hiddenStrength: "推进速度快，能在混乱环境里先跑起来。",
      hiddenRisk: "容易先做后证，增长放缓时可能继续堆活动而不是找根因。",
      bestUse: "适合探索期和资源极少的业务。",
      delayedOutcome: "他能快速上线一批动作，但如果没人要求实验纪律，团队很难判断哪些真的有效。",
    },
    responses: {
      impact: {
        answer: "我做过拉新活动，三天上线，新增注册翻了一倍。我们当时资源很少，所以先把活动规则、页面和奖励链路跑通。",
        read: "速度很快，但要继续确认留存和质量。",
        signals: [
          { label: "推进速度快", kind: "ability", tone: "positive" },
          { label: "结果质量待验证", kind: "evidence", tone: "warning" },
        ],
      },
      deep_dive: {
        answer: "替代方案其实没有太完整，因为时间很赶。我们先看竞品，再让运营判断奖励力度，后面再补数据。",
        read: "适合冲刺，但前期判断证据薄。",
        signals: [
          { label: "能快速行动", kind: "motivation", tone: "positive" },
          { label: "验证纪律不足", kind: "risk", tone: "warning" },
        ],
      },
      collaboration: {
        answer: "创业公司大家都很忙，我一般直接拉群推进。谁卡住就当天解决，实在不行我自己先补上。",
        read: "责任感强，但流程沉淀不足。",
        signals: [
          { label: "愿意补位", kind: "team", tone: "positive" },
          { label: "依赖个人冲刺", kind: "risk", tone: "warning" },
        ],
      },
      motivation: {
        answer: "我喜欢快节奏，有空间就能冲。我不太喜欢太多评审流程，会觉得耽误时机。",
        read: "动机强，但和需要重新梳理优先级的岗位有冲突。",
        signals: [
          { label: "高驱动", kind: "motivation", tone: "positive" },
          { label: "对流程耐心不足", kind: "risk", tone: "warning" },
        ],
      },
      pressure: {
        answer: "压力大时我会先动起来。以前活动数据不好，我连夜换了素材和奖励，第二天数据就回来了。",
        read: "抗压强，但复盘深度仍需追问。",
        signals: [
          { label: "压力下行动快", kind: "ability", tone: "positive" },
          { label: "根因分析不足", kind: "risk", tone: "warning" },
        ],
      },
      pedigree: {
        answer: "我没有大平台经历，但创业公司逼着我什么都做，也能说明我抗压。",
        read: "背景不是核心，抗压证据还要和结果质量一起看。",
        signals: [
          { label: "小团队磨炼", kind: "bias", tone: "neutral" },
          { label: "不要把吃苦等同于有效", kind: "bias", tone: "warning" },
        ],
      },
    },
  },
  {
    id: "sales-shen",
    roleId: "sales",
    name: "沈越",
    initials: "沈",
    headline: "冠军销售转运营，气场强，但流程化证据不足。",
    resumeSummary: "连续两个季度销售冠军，参与新人话术培训。",
    resumeHighlights: ["冠军销售", "客户资源多", "表达强势"],
    surfaceTags: ["气场强", "业绩亮", "个人打法"],
    expectedSalary: "35k",
    availability: "一个月到岗",
    expression: 90,
    pedigree: 82,
    profile: {
      capability: 72,
      collaboration: 60,
      motivation: 74,
      growth: 62,
      integrity: 72,
      pressure: 86,
      fitScore: 67,
      recommendation: "waitlist",
      hiddenStrength: "一线成交能力强，关键客户推进有冲劲。",
      hiddenRisk: "把个人冲锋误认为运营体系，可能压过团队节奏。",
      bestUse: "适合大客户攻坚，不一定适合流程治理。",
      delayedOutcome: "他能拿下一两个硬客户，但团队仍然不知道为什么能成，线索转化波动没有真正收敛。",
    },
    responses: {
      impact: {
        answer: "我去年拿了两个季度销冠，最大的单子 180 万。我靠的是抓关键人，连续跟进，把客户顾虑一个个打掉。",
        read: "个人业绩强，但运营沉淀还不够。",
        signals: [
          { label: "成交能力强", kind: "ability", tone: "positive" },
          { label: "方法可复制性不足", kind: "evidence", tone: "warning" },
        ],
      },
      deep_dive: {
        answer: "关键决策是直接约老板。我判断下面的人没有预算权，所以绕过中层推进。",
        read: "判断果断，但团队复制时可能有关系和风格依赖。",
        signals: [
          { label: "关键人判断强", kind: "ability", tone: "positive" },
          { label: "依赖个人风格", kind: "risk", tone: "warning" },
        ],
      },
      collaboration: {
        answer: "我带新人时会让他们听我的录音，先照着做。实在做不到，说明他们还没理解客户心理。",
        read: "培训有动作，但同理和拆解不足。",
        signals: [
          { label: "愿意带新人", kind: "team", tone: "neutral" },
          { label: "协作方式偏强压", kind: "risk", tone: "warning" },
        ],
      },
      motivation: {
        answer: "我想从个人销售转成管理和运营，把我这套打法复制到团队。",
        read: "目标合理，但需要验证他是否真能流程化。",
        signals: [
          { label: "转型动机明确", kind: "motivation", tone: "positive" },
          { label: "流程化能力待证", kind: "risk", tone: "warning" },
        ],
      },
      pressure: {
        answer: "客户压价时我会守住底线，也会反复找痛点。销售就是不能怂，情绪上来了也要继续追。",
        read: "抗压强，但运营岗位还要看复盘和机制。",
        signals: [
          { label: "高压推进强", kind: "ability", tone: "positive" },
          { label: "复盘机制不足", kind: "evidence", tone: "warning" },
        ],
      },
      pedigree: {
        answer: "销冠这个结果最直接，说明我知道怎么拿结果。",
        read: "结果有价值，但光看销冠会忽略岗位转换风险。",
        signals: [
          { label: "业绩光环明显", kind: "bias", tone: "neutral" },
          { label: "岗位转换风险被遮住", kind: "bias", tone: "warning" },
        ],
      },
    },
  },
  {
    id: "sales-tang",
    roleId: "sales",
    name: "唐棠",
    initials: "唐",
    headline: "销售运营专才，个人光环不强，但流程和数据很稳。",
    resumeSummary: "4 年销售运营经验，搭建线索分层、跟进节奏和复盘看板。",
    resumeHighlights: ["CRM治理", "线索分层", "培训SOP"],
    surfaceTags: ["低调", "数据稳", "适配度高"],
    expectedSalary: "27k",
    availability: "两周到岗",
    expression: 68,
    pedigree: 54,
    profile: {
      capability: 88,
      collaboration: 86,
      motivation: 84,
      growth: 82,
      integrity: 90,
      pressure: 74,
      fitScore: 88,
      recommendation: "hire",
      hiddenStrength: "能把线索、话术和复盘做成团队可执行系统。",
      hiddenRisk: "不太会夸大自己，容易被冠军销售抢走注意力。",
      bestUse: "适合转化不稳、需要运营体系的销售团队。",
      delayedOutcome: "入职后她先清理 CRM 字段，再建立线索分层，三周后低意向线索占用时间明显下降。",
    },
    responses: {
      impact: {
        answer: "我做过线索分层项目。原来销售平均每天追 60 条线索，优先级全靠感觉。我按来源、预算、响应速度做分层，四周后有效跟进率提升 26%，无效触达减少 31%。",
        read: "非常贴合岗位，能把问题变成流程和指标。",
        signals: [
          { label: "线索治理证据强", kind: "evidence", tone: "positive" },
          { label: "运营能力贴合", kind: "ability", tone: "positive" },
        ],
      },
      deep_dive: {
        answer: "我没有一开始改全部字段，只选了预算、行业、响应时间三个字段。销售愿意填，数据才会稳定，后面再加标签。",
        read: "懂一线阻力，方案可执行。",
        signals: [
          { label: "方案落地感强", kind: "ability", tone: "positive" },
          { label: "理解销售使用成本", kind: "team", tone: "positive" },
        ],
      },
      collaboration: {
        answer: "销售一开始觉得被管。我先找两个愿意试的人，帮他们省时间，再用结果让其他人加入。",
        read: "推进方式成熟，不靠硬压。",
        signals: [
          { label: "协作推进成熟", kind: "team", tone: "positive" },
          { label: "会用结果建立共识", kind: "evidence", tone: "positive" },
        ],
      },
      motivation: {
        answer: "我喜欢把混乱线索变成能持续跑的系统。你们现在的问题不是没有线索，而是质量和节奏不稳，这正好是我想做的。",
        read: "动机和团队问题高度匹配。",
        signals: [
          { label: "动机精准匹配", kind: "motivation", tone: "positive" },
          { label: "理解业务问题", kind: "ability", tone: "positive" },
        ],
      },
      pressure: {
        answer: "有次销售主管质疑看板没用，我没有争辩，先把他团队前三周的数据拉出来，找到两个实际节省时间的点，再让他选择保留哪些字段。",
        read: "压力下能用证据沟通。",
        signals: [
          { label: "压力下保持证据导向", kind: "motivation", tone: "positive" },
          { label: "能处理一线质疑", kind: "team", tone: "positive" },
        ],
      },
      pedigree: {
        answer: "我不是销冠型背景，但我做的是让更多普通销售稳定拿结果。",
        read: "很好地把背景题转回岗位价值。",
        signals: [
          { label: "不被光环题带偏", kind: "bias", tone: "positive" },
          { label: "强调团队复用价值", kind: "evidence", tone: "positive" },
        ],
      },
    },
  },
  {
    id: "sales-wei",
    roleId: "sales",
    name: "魏宁",
    initials: "魏",
    headline: "客服转销售运营，用户同理强，但成交推进偏弱。",
    resumeSummary: "3 年客户成功经验，做过续费提醒、客户分层和满意度回访。",
    resumeHighlights: ["客户同理", "续费维护", "风险预警"],
    surfaceTags: ["亲和", "成交弱", "稳定"],
    expectedSalary: "23k",
    availability: "立即到岗",
    expression: 74,
    pedigree: 42,
    profile: {
      capability: 70,
      collaboration: 82,
      motivation: 80,
      growth: 78,
      integrity: 92,
      pressure: 66,
      fitScore: 73,
      recommendation: "waitlist",
      hiddenStrength: "客户同理和风险预警强，适合续费与留存。",
      hiddenRisk: "对强转化目标的推进力度不足。",
      bestUse: "适合客户成功、续费运营或低压转化链路。",
      delayedOutcome: "她能显著改善客户反馈质量，但面对强销售目标时推进偏慢，需要搭配更强成交型角色。",
    },
    responses: {
      impact: {
        answer: "我做过续费预警，把客户按使用频率和投诉记录分层。高风险客户提前 30 天触达，续费流失率下降了 12%。",
        read: "客户运营证据不错，但和销售转化还要做桥接。",
        signals: [
          { label: "客户分层经验", kind: "ability", tone: "positive" },
          { label: "偏续费而非新转化", kind: "risk", tone: "neutral" },
        ],
      },
      deep_dive: {
        answer: "关键是投诉记录不能只看数量。有些客户投诉少，是因为快流失了。我会结合登录频率和工单语气判断。",
        read: "客户洞察细，能发现表面数据后的风险。",
        signals: [
          { label: "客户洞察强", kind: "ability", tone: "positive" },
          { label: "能读出隐性风险", kind: "evidence", tone: "positive" },
        ],
      },
      collaboration: {
        answer: "销售觉得我给的客户标签太细。我后来把标签压缩成红黄绿三类，并加一句建议动作，他们才愿意用。",
        read: "能根据使用者调整工具。",
        signals: [
          { label: "协作适配好", kind: "team", tone: "positive" },
          { label: "能降低工具使用门槛", kind: "ability", tone: "positive" },
        ],
      },
      motivation: {
        answer: "我希望做更靠近业务结果的运营，但我也不想只做强压成交，我更擅长长期关系。",
        read: "动机清楚，但岗位若强调短期成交会有偏差。",
        signals: [
          { label: "擅长长期关系", kind: "motivation", tone: "positive" },
          { label: "短期强转化偏弱", kind: "risk", tone: "warning" },
        ],
      },
      pressure: {
        answer: "客户情绪很大时我比较能稳住，但如果内部一直催成交，我会先想客户体验，推进速度可能没那么激进。",
        read: "诚实，也暴露销售压力下的节奏问题。",
        signals: [
          { label: "客户体验稳定", kind: "team", tone: "positive" },
          { label: "成交压力下不够强势", kind: "risk", tone: "warning" },
        ],
      },
      pedigree: {
        answer: "我从客服和客户成功过来，没有传统销售履历，但我很懂客户为什么犹豫。",
        read: "背景不同不等于不适合，但要匹配岗位侧重点。",
        signals: [
          { label: "非典型背景", kind: "bias", tone: "neutral" },
          { label: "不要用传统销售履历一刀切", kind: "bias", tone: "warning" },
        ],
      },
    },
  },
];

export function getCandidatesForRole(roleId: InterviewRole["id"]) {
  return candidates.filter((candidate) => candidate.roleId === roleId);
}
