import { difficultyLabels } from "./content";
import type {
  CustomInterviewInsight,
  InterviewAnswer,
  InterviewCustomization,
  InterviewDifficulty,
  InterviewHistoryRecord,
  InterviewMetricKey,
  InterviewMetrics,
  InterviewQuestion,
  InterviewRole,
  InterviewSummary,
  Interviewer,
} from "./types";

const metricLabels: Record<InterviewMetricKey, string> = {
  clarity: "表达清晰度",
  structure: "逻辑结构",
  evidence: "案例证据",
  roleFit: "岗位匹配",
  resilience: "抗压能力",
};

const metricSeeds: InterviewMetrics = {
  clarity: 62,
  structure: 58,
  evidence: 54,
  roleFit: 56,
  resilience: 60,
};

const quantifiablePatterns = [
  "%",
  "％",
  "k",
  "K",
  "万",
  "千",
  "小时",
  "天",
  "周",
  "月",
  "年",
  "次",
  "个",
  "提升",
  "降低",
  "增长",
  "减少",
];

const structurePatterns = [
  "首先",
  "其次",
  "最后",
  "第一",
  "第二",
  "第三",
  "背景",
  "目标",
  "行动",
  "结果",
  "复盘",
  "因为",
  "所以",
  "但是",
];

const resiliencePatterns = [
  "压力",
  "冲突",
  "质疑",
  "失败",
  "问题",
  "风险",
  "复盘",
  "调整",
  "沟通",
  "推进",
  "承担",
];

export function scoreInterviewAnswer(
  answer: string,
  question: InterviewQuestion,
  role: InterviewRole,
  difficulty: InterviewDifficulty,
  interviewer: Interviewer,
  previousAnswer?: InterviewAnswer,
  customization?: InterviewCustomization,
): InterviewAnswer {
  const normalized = answer.trim();
  const customSignals = collectCustomizationSignals(customization);
  const lengthScore = scoreLength(normalized);
  const structureScore = scorePatterns(normalized, structurePatterns, 5);
  const evidenceScore = scoreEvidence(normalized);
  const roleScore = scorePatterns(
    normalized,
    [...role.keywords, ...(question.evidenceHints ?? []), ...customSignals],
    6,
  );
  const resilienceScore = scorePatterns(normalized, resiliencePatterns, 5);
  const difficultyPenalty = difficulty === "senior" ? 5 : difficulty === "mid" ? 2 : 0;
  const pressurePenalty = Math.max(0, interviewer.pressure - 2) * 2;

  const metrics: InterviewMetrics = {
    clarity: clamp(Math.round(45 + lengthScore * 0.42 + structureScore * 0.18 - pressurePenalty)),
    structure: clamp(Math.round(40 + structureScore * 0.46 + lengthScore * 0.18 - difficultyPenalty)),
    evidence: clamp(Math.round(38 + evidenceScore * 0.5 + roleScore * 0.12 - difficultyPenalty)),
    roleFit: clamp(Math.round(42 + roleScore * 0.42 + evidenceScore * 0.14)),
    resilience: clamp(Math.round(48 + resilienceScore * 0.32 + structureScore * 0.14 - pressurePenalty)),
  };

  const focusBonus = question.focus.reduce((sum, key) => sum + metrics[key], 0) / question.focus.length;
  const score = clamp(
    Math.round(
      averageMetric(metrics) * 0.7 +
        focusBonus * 0.3 -
        (normalized.length < 36 ? 12 : 0) -
        (normalized.length > 520 ? 5 : 0),
    ),
  );

  return {
    questionId: question.id,
    prompt: question.prompt,
    answer: normalized,
    score,
    metrics,
    strengths: buildStrengths(metrics, role),
    risks: buildRisks(metrics, normalized),
    followUp: buildFollowUp(metrics, question, role, interviewer),
    concern: buildInterviewerConcern(metrics, normalized, question, role),
    improvedAnswer: buildImprovedAnswer(normalized, question, role, metrics, customization),
    retryOfQuestionId: previousAnswer?.questionId,
    improvementFrom: previousAnswer ? score - previousAnswer.score : undefined,
  };
}

export function mergeInterviewMetrics(answers: InterviewAnswer[]): InterviewMetrics {
  if (answers.length === 0) {
    return metricSeeds;
  }

  return {
    clarity: average(answers.map((answer) => answer.metrics.clarity)),
    structure: average(answers.map((answer) => answer.metrics.structure)),
    evidence: average(answers.map((answer) => answer.metrics.evidence)),
    roleFit: average(answers.map((answer) => answer.metrics.roleFit)),
    resilience: average(answers.map((answer) => answer.metrics.resilience)),
  };
}

export function buildInterviewSummary(
  answers: InterviewAnswer[],
  role: InterviewRole,
  difficulty: InterviewDifficulty,
  interviewer: Interviewer,
  customization?: InterviewCustomization,
): InterviewSummary {
  const metrics = mergeInterviewMetrics(answers);
  const pressureAdjustment = interviewer.pressure >= 4 ? 2 : 0;
  const totalScore = clamp(Math.round(averageMetric(metrics) - pressureAdjustment));
  const strongestAnswer = [...answers].sort((a, b) => b.score - a.score)[0];
  const weakestAnswer = [...answers].sort((a, b) => a.score - b.score)[0];

  return {
    totalScore,
    hireSignal: getHireSignal(totalScore),
    verdict: buildVerdict(totalScore, role.title, difficulty),
    metrics,
    strongestAnswer,
    weakestAnswer,
    suggestions: buildSuggestions(metrics, weakestAnswer),
    modelAnswer: buildModelAnswer(role, difficulty, customization),
  };
}

export function createHistoryRecord(
  summary: InterviewSummary,
  role: InterviewRole,
  difficulty: InterviewDifficulty,
  interviewer: Interviewer,
): InterviewHistoryRecord {
  return {
    id: `${Date.now()}-${role.id}-${difficulty}`,
    roleTitle: role.title,
    difficulty,
    interviewerName: interviewer.name,
    score: summary.totalScore,
    createdAt: new Date().toISOString(),
    verdict: summary.hireSignal,
  };
}

export function buildRetryComparison(previous: InterviewAnswer, next: InterviewAnswer) {
  const metricDeltas = (Object.keys(previous.metrics) as InterviewMetricKey[]).map((key) => ({
    key,
    label: metricLabels[key],
    delta: next.metrics[key] - previous.metrics[key],
  }));
  const improved = metricDeltas.filter((item) => item.delta > 0).sort((a, b) => b.delta - a.delta);

  return {
    scoreDelta: next.score - previous.score,
    improvedMetrics: improved,
    summary:
      next.score > previous.score
        ? `这次重答提升了 ${next.score - previous.score} 分，最明显的是${improved[0]?.label ?? "整体结构"}。`
        : "这次重答还没有明显提升，建议先补数字证据，再压缩表达结构。",
  };
}

function scoreLength(text: string) {
  const length = text.length;

  if (length < 20) {
    return 12;
  }

  if (length < 60) {
    return 38;
  }

  if (length < 160) {
    return 78;
  }

  if (length < 360) {
    return 92;
  }

  if (length < 560) {
    return 82;
  }

  return 68;
}

function scorePatterns(text: string, patterns: string[], weight: number) {
  const hits = patterns.filter((pattern) => text.toLowerCase().includes(pattern.toLowerCase())).length;

  return clamp(hits * weight + Math.min(30, hits * 4));
}

function scoreEvidence(text: string) {
  const numberHits = (text.match(/\d+/g) ?? []).length;
  const quantifiableHits = quantifiablePatterns.filter((pattern) => text.includes(pattern)).length;
  const caseHits = ["我负责", "我做了", "我推动", "结果", "数据", "目标", "上线", "成交", "复盘"].filter(
    (pattern) => text.includes(pattern),
  ).length;

  return clamp(numberHits * 11 + quantifiableHits * 8 + caseHits * 7);
}

function buildStrengths(metrics: InterviewMetrics, role: InterviewRole) {
  const ranked = rankMetrics(metrics).slice(0, 2);

  return ranked.map(([key, value]) => {
    if (key === "roleFit") {
      return `和${role.title}的核心能力有连接，${metricLabels[key]}达到 ${value}。`;
    }

    return `${metricLabels[key]}表现较稳，当前达到 ${value}。`;
  });
}

function buildRisks(metrics: InterviewMetrics, text: string) {
  const risks = rankMetrics(metrics)
    .reverse()
    .slice(0, 2)
    .map(([key, value]) => `${metricLabels[key]}还不够有说服力，当前只有 ${value}。`);

  if (!/\d/.test(text)) {
    risks.unshift("回答里缺少数字或结果证据，面试官很难判断真实影响。");
  }

  return Array.from(new Set(risks)).slice(0, 3);
}

function buildFollowUp(
  metrics: InterviewMetrics,
  question: InterviewQuestion,
  role: InterviewRole,
  interviewer: Interviewer,
) {
  const weakest = rankMetrics(metrics).reverse()[0][0];
  const prefix = interviewer.pressure >= 4 ? "我直接一点追问：" : "我想继续追问：";

  if (weakest === "evidence") {
    return `${prefix}这个案例里最关键的一个数字是什么？如果没有这个数字，你会用什么证据证明结果？`;
  }

  if (weakest === "structure") {
    return `${prefix}请你按“背景、目标、动作、结果”重新压缩一遍，重点说你自己的动作。`;
  }

  if (weakest === "roleFit") {
    return `${prefix}这段经历为什么能证明你适合${role.title}，而不是只说明你参与过项目？`;
  }

  if (weakest === "resilience") {
    return `${prefix}如果当时有人质疑你的判断，你会怎么回应并推进？`;
  }

  return `${prefix}${question.title}里最重要的信息是什么？请用一句话先给结论。`;
}

function buildInterviewerConcern(
  metrics: InterviewMetrics,
  text: string,
  question: InterviewQuestion,
  role: InterviewRole,
) {
  const weakest = rankMetrics(metrics).reverse()[0][0];

  if (text.length < 60) {
    return "回答太短，面试官会担心你只有结论，没有真实经历支撑。";
  }

  if (weakest === "evidence") {
    return "面试官最大的顾虑是结果不可验证：你说做了事，但还没证明影响有多大。";
  }

  if (weakest === "structure") {
    return "面试官会觉得信息顺序偏散，需要更快听到背景、动作和结果。";
  }

  if (weakest === "roleFit") {
    return `这题还没有充分扣回${role.title}的核心能力，容易被判断为泛泛项目经历。`;
  }

  if (weakest === "resilience") {
    return "面试官还看不到你在压力、冲突或不确定性下如何保持推进。";
  }

  return `这题的关键是“${question.title}”，面试官希望先听到明确结论，再听证据。`;
}

function buildImprovedAnswer(
  answer: string,
  question: InterviewQuestion,
  role: InterviewRole,
  metrics: InterviewMetrics,
  customization?: InterviewCustomization,
) {
  const weakest = rankMetrics(metrics).reverse()[0][0];
  const signal = question.evidenceHints?.[0] ?? collectCustomizationSignals(customization)[0] ?? role.competencies[0];
  const resultHint = /\d/.test(answer) ? "把已有数字和岗位目标连起来" : "补一个可验证数字，例如比例、时长、金额或用户规模";

  if (weakest === "evidence") {
    return `我会这样重写：背景是这个岗位关注“${signal}”，我在某个具体项目里负责其中一块。我的动作不是泛泛参与，而是先明确目标，再做关键推进，最后用${resultHint}证明结果。复盘时我还沉淀了一个可复用做法，所以这段经历能支撑我胜任${role.title}。`;
  }

  if (weakest === "structure") {
    return `我会这样重写：先给结论，我适合${role.title}，因为我有和“${signal}”相关的实战经历。背景是什么，目标是什么，我具体做了哪三件事，结果如何，最后我学到什么。用这个顺序回答，面试官会更容易抓住重点。`;
  }

  if (weakest === "roleFit") {
    return `我会这样重写：这个案例和${role.title}直接相关，因为它体现了${role.competencies
      .slice(0, 2)
      .join("和")}。我不只是在项目里执行任务，还做了判断、推进和复盘。最后我会明确说明这套经验如何迁移到贵公司的岗位要求。`;
  }

  if (weakest === "resilience") {
    return `我会这样重写：当时最大的困难是资源、时间或观点冲突。我先承认风险，再把问题拆小，和关键协作者对齐判断，最后推动一个可落地方案。这个回答要让面试官看到你不是只会顺风做事，也能在压力下稳定推进。`;
  }

  return `我会这样重写：第一句话先回答问题，再用一个具体案例补证据。案例里要包含背景、你的动作、结果和复盘，最后扣回${role.title}的岗位要求。`;
}

function buildSuggestions(metrics: InterviewMetrics, weakestAnswer?: InterviewAnswer) {
  const weakestMetrics = rankMetrics(metrics).reverse().slice(0, 3);
  const suggestions: string[] = weakestMetrics.map(([key]) => {
    if (key === "evidence") {
      return "补上数字、范围或对比结果，例如提升多少、节省多少、影响多少用户。";
    }

    if (key === "structure") {
      return "用 STAR 或“背景-动作-结果-复盘”组织答案，先给结论再展开。";
    }

    if (key === "roleFit") {
      return "每个案例最后都要扣回岗位能力，说明它和目标岗位的关系。";
    }

    if (key === "resilience") {
      return "主动说出困难、冲突和取舍，展示你如何在压力下保持推进。";
    }

    return "减少铺垫，第一句话直接回答问题，再补关键细节。";
  });

  if (weakestAnswer) {
    suggestions.unshift(`优先重练“${weakestAnswer.prompt}”这题，它最影响本场印象。`);
  }

  return Array.from(new Set(suggestions)).slice(0, 4);
}

function buildModelAnswer(
  role: InterviewRole,
  difficulty: InterviewDifficulty,
  customization?: InterviewCustomization,
) {
  const level = difficultyLabels[difficulty];
  const customSignals = collectCustomizationSignals(customization);
  const customTail =
    customSignals.length > 0
      ? `如果结合这份 JD/简历，我会主动点出“${customSignals.slice(0, 2).join("、")}”，让面试官知道我的经历和岗位要求不是偶然重合。`
      : "";

  return `我会用一个${role.title}相关项目说明。背景是团队需要解决一个明确问题，我先确认目标和成功指标，再拆出关键动作：调研真实场景、确定优先级、推进协作并持续复盘。过程中我重点负责把不确定问题变成可执行方案，最后用数据验证结果。这个经历和${level}${role.title}岗位匹配，因为它体现了${role.competencies
    .slice(0, 3)
    .join("、")}。${customTail}`;
}

function getHireSignal(score: number) {
  if (score >= 86) {
    return "强烈推荐进入下一轮";
  }

  if (score >= 74) {
    return "建议进入下一轮";
  }

  if (score >= 62) {
    return "待定，需要补充证据";
  }

  return "暂不推荐";
}

function buildVerdict(score: number, roleTitle: string, difficulty: InterviewDifficulty) {
  const level = difficultyLabels[difficulty];

  if (score >= 86) {
    return `这是一场有竞争力的${level}${roleTitle}面试，回答能让面试官看到方法、结果和成熟度。`;
  }

  if (score >= 74) {
    return `整体达到了${level}${roleTitle}的基本要求，再补强关键数字会更稳。`;
  }

  if (score >= 62) {
    return `表达方向是对的，但证据和岗位扣题还不够，需要把经历讲得更具体。`;
  }

  return `当前回答偏泛，面试官还难以判断真实能力，建议先重练项目案例和结构表达。`;
}

function rankMetrics(metrics: InterviewMetrics): Array<[InterviewMetricKey, number]> {
  return (Object.entries(metrics) as Array<[InterviewMetricKey, number]>).sort((a, b) => b[1] - a[1]);
}

function collectCustomizationSignals(customization?: InterviewCustomization | CustomInterviewInsight) {
  if (!customization) {
    return [];
  }

  if ("keywords" in customization) {
    return customization.keywords;
  }

  const text = `${customization.jdText} ${customization.resumeText}`;
  const signals = Array.from(text.matchAll(/[A-Za-z][A-Za-z0-9+#.-]{1,20}|[\u4e00-\u9fa5]{2,8}/g))
    .map((match) => match[0])
    .filter((word) => word.length >= 2)
    .slice(0, 20);

  return Array.from(new Set(signals)).slice(0, 8);
}

function average(values: number[]) {
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function averageMetric(metrics: InterviewMetrics) {
  return average(Object.values(metrics));
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, value));
}
