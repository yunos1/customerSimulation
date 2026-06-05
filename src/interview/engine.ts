import { decisionLabels, difficultySettings, interviewQuestions } from "./content";
import type {
  Candidate,
  CandidateSignal,
  HiringDecision,
  InterviewDecisionRecord,
  InterviewDifficulty,
  InterviewHistoryRecord,
  InterviewMetricKey,
  InterviewMetrics,
  InterviewQuestion,
  InterviewRole,
  InterviewSummary,
  QuestionId,
  SignalKind,
} from "./types";

const metricLabels: Record<InterviewMetricKey, string> = {
  accuracy: "判断准确",
  evidence: "证据完整",
  candidateExperience: "候选人体验",
  biasControl: "偏见控制",
  teamFit: "团队匹配",
};

const kindWeights: Record<SignalKind, number> = {
  ability: 1.12,
  evidence: 1.18,
  team: 1,
  motivation: 0.94,
  risk: 1.1,
  bias: 0.48,
};

export const metricSeed: InterviewMetrics = {
  accuracy: 62,
  evidence: 56,
  candidateExperience: 76,
  biasControl: 72,
  teamFit: 58,
};

export function buildDecisionRecord({
  candidate,
  role,
  difficulty,
  decision,
  askedQuestionIds,
}: {
  candidate: Candidate;
  role: InterviewRole;
  difficulty: InterviewDifficulty;
  decision: HiringDecision;
  askedQuestionIds: QuestionId[];
}): InterviewDecisionRecord {
  const discoveredSignals = collectSignals(candidate, askedQuestionIds);
  const decisionScore = scoreDecision(decision, candidate.profile.recommendation);
  const evidenceScore = scoreEvidence(askedQuestionIds, discoveredSignals);
  const candidateExperience = scoreCandidateExperience(askedQuestionIds, difficulty);
  const biasControl = scoreBiasControl(candidate, decision, askedQuestionIds, discoveredSignals);
  const teamFit = scoreTeamFit(candidate, decision);
  const blindSpots = buildBlindSpots(candidate, askedQuestionIds, discoveredSignals);

  return {
    id: `${Date.now()}-${candidate.id}-${decision}`,
    candidateId: candidate.id,
    candidateName: candidate.name,
    roleTitle: role.title,
    decision,
    recommendedDecision: candidate.profile.recommendation,
    decisionScore,
    evidenceScore,
    candidateExperience,
    biasControl,
    teamFit,
    askedQuestionIds,
    discoveredSignals,
    blindSpots,
    verdict: buildVerdict(candidate, decision, decisionScore),
    delayedFeedback: buildDelayedFeedback(candidate, decision),
    createdAt: new Date().toISOString(),
  };
}

export function buildInterviewSummary(
  records: InterviewDecisionRecord[],
  role: InterviewRole,
  difficulty: InterviewDifficulty,
): InterviewSummary {
  const metrics = mergeInterviewMetrics(records);
  const difficultyPenalty = difficulty === "executive" ? 4 : difficulty === "urgent" ? 2 : 0;
  const totalScore = clamp(
    Math.round(
      metrics.accuracy * 0.32 +
        metrics.evidence * 0.22 +
        metrics.biasControl * 0.2 +
        metrics.teamFit * 0.16 +
        metrics.candidateExperience * 0.1 -
        difficultyPenalty,
    ),
  );
  const bestRecord = [...records].sort((a, b) => b.teamFit + b.decisionScore - (a.teamFit + a.decisionScore))[0];

  return {
    totalScore,
    verdict: buildSummaryVerdict(totalScore, role.title),
    hireSignal: getHiringSignal(totalScore),
    metrics,
    bestCandidateId: bestRecord?.candidateId ?? "",
    bestCandidateName: bestRecord?.candidateName ?? "暂无",
    suggestions: buildSuggestions(records, metrics),
    records,
  };
}

export function mergeInterviewMetrics(records: InterviewDecisionRecord[]): InterviewMetrics {
  if (records.length === 0) {
    return metricSeed;
  }

  return {
    accuracy: average(records.map((record) => record.decisionScore)),
    evidence: average(records.map((record) => record.evidenceScore)),
    candidateExperience: average(records.map((record) => record.candidateExperience)),
    biasControl: average(records.map((record) => record.biasControl)),
    teamFit: average(records.map((record) => record.teamFit)),
  };
}

export function createHistoryRecord(summary: InterviewSummary, role: InterviewRole): InterviewHistoryRecord {
  return {
    id: `${Date.now()}-${role.id}`,
    roleTitle: role.title,
    score: summary.totalScore,
    accuracy: summary.metrics.accuracy,
    createdAt: new Date().toISOString(),
    verdict: summary.hireSignal,
  };
}

export function getQuestionById(questionId: QuestionId): InterviewQuestion {
  return interviewQuestions.find((question) => question.id === questionId) ?? interviewQuestions[0];
}

export function getAskedCoverage(askedQuestionIds: QuestionId[]) {
  const questionSet = new Set(askedQuestionIds);

  return {
    hasEvidence: questionSet.has("impact") || questionSet.has("deep_dive"),
    hasTeam: questionSet.has("collaboration"),
    hasMotivation: questionSet.has("motivation"),
    hasPressure: questionSet.has("pressure"),
    hasPedigree: questionSet.has("pedigree"),
  };
}

export function getSignalSummary(signals: CandidateSignal[]) {
  const positives = signals.filter((signal) => signal.tone === "positive").length;
  const warnings = signals.filter((signal) => signal.tone === "warning" || signal.tone === "negative").length;
  const neutral = signals.length - positives - warnings;

  return { positives, warnings, neutral };
}

export function getDecisionDelta(decision: HiringDecision, recommendedDecision: HiringDecision) {
  return scoreDecision(decision, recommendedDecision) - 100;
}

function scoreDecision(decision: HiringDecision, recommendedDecision: HiringDecision) {
  if (decision === recommendedDecision) {
    return 100;
  }

  if (decision === "waitlist" || recommendedDecision === "waitlist") {
    return 72;
  }

  return 34;
}

function scoreEvidence(askedQuestionIds: QuestionId[], signals: CandidateSignal[]) {
  const coverage = getAskedCoverage(askedQuestionIds);
  const signalScore = signals.reduce((sum, signal) => sum + 6 * kindWeights[signal.kind], 0);
  const usefulQuestionBonus =
    (coverage.hasEvidence ? 16 : 0) +
    (coverage.hasTeam ? 10 : 0) +
    (coverage.hasMotivation ? 8 : 0) +
    (coverage.hasPressure ? 7 : 0);
  const pedigreePenalty = coverage.hasPedigree ? 10 : 0;

  return clamp(Math.round(34 + signalScore + usefulQuestionBonus - pedigreePenalty));
}

function scoreCandidateExperience(askedQuestionIds: QuestionId[], difficulty: InterviewDifficulty) {
  const difficultySetting = difficultySettings[difficulty];
  const deltas = askedQuestionIds
    .map(getQuestionById)
    .reduce((sum, question) => sum + question.experienceDelta, 0);
  const pressurePenalty = difficulty === "urgent" ? 4 : difficulty === "executive" ? 2 : 0;
  const overrunPenalty = Math.max(0, askedQuestionIds.length - difficultySetting.questionLimit) * 6;

  return clamp(Math.round(74 + deltas - pressurePenalty - overrunPenalty));
}

function scoreBiasControl(
  candidate: Candidate,
  decision: HiringDecision,
  askedQuestionIds: QuestionId[],
  signals: CandidateSignal[],
) {
  const coverage = getAskedCoverage(askedQuestionIds);
  const questionBias = askedQuestionIds.map(getQuestionById).reduce((sum, question) => sum + question.biasRisk, 0);
  const warningBiasSignals = signals.filter((signal) => signal.kind === "bias" && signal.tone === "warning").length;
  const evidenceBonus = coverage.hasEvidence ? 10 : 0;
  const lowPedigreeRejectPenalty =
    candidate.pedigree < 58 && decision === "reject" && !coverage.hasEvidence ? 18 : 0;
  const highPedigreeHirePenalty =
    candidate.pedigree > 82 && decision === "hire" && !coverage.hasEvidence ? 22 : 0;
  const expressiveHirePenalty =
    candidate.expression > 86 && decision === "hire" && !coverage.hasTeam && !coverage.hasPressure ? 12 : 0;
  const slowCandidatePenalty =
    candidate.expression < 65 && decision === "reject" && askedQuestionIds.length < 3 ? 14 : 0;

  return clamp(
    Math.round(
      76 +
        evidenceBonus -
        questionBias -
        warningBiasSignals * 7 -
        lowPedigreeRejectPenalty -
        highPedigreeHirePenalty -
        expressiveHirePenalty -
        slowCandidatePenalty,
    ),
  );
}

function scoreTeamFit(candidate: Candidate, decision: HiringDecision) {
  const fit = candidate.profile.fitScore;

  if (decision === "hire") {
    return clamp(Math.round(fit + (candidate.profile.recommendation === "hire" ? 12 : -10)));
  }

  if (decision === "reject") {
    return clamp(Math.round(100 - fit + (candidate.profile.recommendation === "reject" ? 18 : -12)));
  }

  const distanceFromMiddle = Math.abs(fit - 72);

  return clamp(Math.round(84 - distanceFromMiddle + (candidate.profile.recommendation === "waitlist" ? 12 : -5)));
}

function collectSignals(candidate: Candidate, askedQuestionIds: QuestionId[]) {
  const byLabel = new Map<string, CandidateSignal>();

  askedQuestionIds.forEach((questionId) => {
    candidate.responses[questionId].signals.forEach((signal) => {
      byLabel.set(signal.label, signal);
    });
  });

  return Array.from(byLabel.values());
}

function buildBlindSpots(
  candidate: Candidate,
  askedQuestionIds: QuestionId[],
  discoveredSignals: CandidateSignal[],
) {
  const coverage = getAskedCoverage(askedQuestionIds);
  const signalKinds = new Set(discoveredSignals.map((signal) => signal.kind));
  const blindSpots: string[] = [];

  if (!coverage.hasEvidence) {
    blindSpots.push("缺少可验证成果证据，容易只看表达和履历。");
  }

  if (!coverage.hasTeam) {
    blindSpots.push("没有检查协作方式，入职后的摩擦风险不清楚。");
  }

  if (!coverage.hasMotivation) {
    blindSpots.push("岗位动机没有问透，可能忽略团队阶段是否匹配。");
  }

  if (candidate.pedigree > 82 && !signalKinds.has("risk")) {
    blindSpots.push("候选人履历光环强，但风险信号挖得不够。");
  }

  if (candidate.expression < 65 && askedQuestionIds.length < 3) {
    blindSpots.push("候选人慢热，提问太少会低估真实能力。");
  }

  return blindSpots.slice(0, 4);
}

function buildVerdict(candidate: Candidate, decision: HiringDecision, decisionScore: number) {
  const recommended = decisionLabels[candidate.profile.recommendation];

  if (decisionScore === 100) {
    return `判断命中：这位候选人的合理处理是「${recommended}」。`;
  }

  if (decision === "hire" && candidate.profile.recommendation !== "hire") {
    return `偏冒进：表面信号不错，但更稳的处理是「${recommended}」。`;
  }

  if (decision === "reject" && candidate.profile.recommendation !== "reject") {
    return `偏保守：你可能漏掉了候选人的可用价值，更稳的处理是「${recommended}」。`;
  }

  return `判断留有余地：待定可以控制风险，但这位候选人的更优处理是「${recommended}」。`;
}

function buildDelayedFeedback(candidate: Candidate, decision: HiringDecision) {
  if (decision === "hire") {
    return candidate.profile.delayedOutcome;
  }

  if (decision === "waitlist") {
    return `你把 ${candidate.name} 放入候补池。后续复盘显示：${candidate.profile.bestUse}`;
  }

  if (candidate.profile.recommendation === "hire") {
    return `你错过了 ${candidate.name}。后续市场反馈显示：${candidate.profile.delayedOutcome}`;
  }

  return `你淘汰了 ${candidate.name}。后续复盘显示：${candidate.profile.hiddenRisk}`;
}

function buildSummaryVerdict(score: number, roleTitle: string) {
  if (score >= 86) {
    return `你像一位成熟的${roleTitle}面试官：能追证据，也能控制偏见。`;
  }

  if (score >= 74) {
    return `你已经能做出多数有效判断，但还需要更稳定地追问风险和动机。`;
  }

  if (score >= 62) {
    return `你抓到了一部分信号，但容易被表达、履历或单一亮点带走。`;
  }

  return `这轮误判偏多。下一轮先问成果证据，再问协作和动机，会稳很多。`;
}

function getHiringSignal(score: number) {
  if (score >= 86) {
    return "优秀面试官";
  }

  if (score >= 74) {
    return "判断可靠";
  }

  if (score >= 62) {
    return "需要复盘";
  }

  return "风险较高";
}

function buildSuggestions(records: InterviewDecisionRecord[], metrics: InterviewMetrics) {
  const suggestions: string[] = [];
  const weakestMetric = (Object.entries(metrics) as Array<[InterviewMetricKey, number]>).sort(
    (a, b) => a[1] - b[1],
  )[0]?.[0];
  const allAsked = records.flatMap((record) => record.askedQuestionIds);
  const askedPedigreeOften = allAsked.filter((id) => id === "pedigree").length >= 2;

  if (weakestMetric === "accuracy") {
    suggestions.push("先不要急着录用或淘汰，把最终判断和候选人的隐藏风险逐条对齐。");
  }

  if (weakestMetric === "evidence" || !allAsked.includes("impact")) {
    suggestions.push("每位候选人至少问一次成果验证，要求他说清本人动作和可验证结果。");
  }

  if (weakestMetric === "biasControl" || askedPedigreeOften) {
    suggestions.push("少用背景光环题，把公司名、学历和头衔都拉回到具体贡献上。");
  }

  if (weakestMetric === "candidateExperience") {
    suggestions.push("压力题要有节制，先给候选人展示能力的空间，再追问风险。");
  }

  if (weakestMetric === "teamFit" || !allAsked.includes("motivation")) {
    suggestions.push("加问动机匹配，确认候选人想要的环境和团队真实阶段一致。");
  }

  records
    .flatMap((record) => record.blindSpots)
    .slice(0, 2)
    .forEach((blindSpot) => suggestions.push(blindSpot));

  return Array.from(new Set(suggestions)).slice(0, 4);
}

function average(values: number[]) {
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, value));
}

export { metricLabels };
