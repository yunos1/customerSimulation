import { clinicResourceLabels, triageLevelLabels } from "./content";
import type {
  ClinicEvaluation,
  ClinicIssue,
  ClinicResourceId,
  ClinicScenario,
  PatientCase,
  PatientEvaluation,
  TriageDecision,
  TriageLevel,
} from "./types";

const levelUrgency: Record<TriageLevel, number> = {
  immediate: 5,
  urgent: 4,
  soon: 3,
  routine: 2,
  redirect: 1,
};

const idealWaitByLevel: Record<TriageLevel, number> = {
  immediate: 0,
  urgent: 15,
  soon: 25,
  routine: 45,
  redirect: 30,
};

const levelCost: Record<TriageLevel, number> = {
  immediate: 4,
  urgent: 3,
  soon: 2,
  routine: 1,
  redirect: 1,
};

const severityWeight: Record<ClinicIssue["severity"], number> = {
  high: 13,
  medium: 7,
  low: 3,
};

export function evaluateClinicTriage({
  currentMinute,
  decisions,
  patients,
  scenario,
}: {
  currentMinute?: number;
  decisions: TriageDecision[];
  patients: PatientCase[];
  scenario: ClinicScenario;
}): ClinicEvaluation {
  const evaluationMinute = currentMinute ?? scenario.durationMinutes;
  const decisionByPatientId = new Map(decisions.map((decision) => [decision.patientId, decision]));
  const resourceUse = buildResourceUse(decisions);
  const patientEvaluations = patients.map<PatientEvaluation>((patient) => {
    const decision = decisionByPatientId.get(patient.id);
    const hasArrived = patient.arrivalMinute <= evaluationMinute;
    const decidedAt = decision?.decidedAt ?? evaluationMinute;
    const waitMinutes = hasArrived ? Math.max(0, decidedAt - patient.arrivalMinute) : 0;
    const delayMinutes = Math.max(0, waitMinutes - idealWaitByLevel[patient.recommendedLevel]);
    const levelDelta = decision ? levelUrgency[decision.level] - levelUrgency[patient.recommendedLevel] : 0;
    const resourceMatch = Boolean(decision && decision.resourceId === patient.bestResource);
    const missedDeterioration = hasArrived && waitMinutes > patient.deteriorationMinute;
    const safetyDelta = decision
      ? getSafetyDelta({
          delayMinutes,
          levelDelta,
          missedDeterioration,
          resourceMatch,
        })
      : getWaitingSafetyDelta(patient, waitMinutes, missedDeterioration, hasArrived);
    const status: PatientEvaluation["status"] = decision
      ? missedDeterioration
        ? "deteriorated"
        : "handled"
      : hasArrived
        ? "waiting"
        : "scheduled";

    return {
      patient,
      decision,
      waitMinutes,
      delayMinutes,
      safetyDelta,
      resourceMatch,
      status,
      feedback: buildPatientFeedback(patient, decision, waitMinutes, missedDeterioration, resourceMatch),
    };
  });
  const issues = buildClinicIssues(patientEvaluations, resourceUse, scenario);
  const metrics = buildClinicMetrics(patientEvaluations, issues, resourceUse, scenario);

  return {
    patients: patientEvaluations,
    metrics,
    issues,
  };
}

export function getPatientRiskScore(patient: PatientCase) {
  let score = levelUrgency[patient.recommendedLevel] * 18;

  if (patient.vitals.spo2 < 92) {
    score += 18;
  }

  if (patient.vitals.systolicBp < 95 || patient.vitals.systolicBp > 160) {
    score += 10;
  }

  if (patient.vitals.heartRate > 120) {
    score += 8;
  }

  if (patient.vitals.temperature >= 39.5) {
    score += 8;
  }

  return Math.min(100, score);
}

export function sortQueueByRisk(patients: PatientCase[], decisions: TriageDecision[]) {
  const decidedIds = new Set(decisions.map((decision) => decision.patientId));

  return patients
    .filter((patient) => !decidedIds.has(patient.id))
    .slice()
    .sort((left, right) => {
      const riskDelta = getPatientRiskScore(right) - getPatientRiskScore(left);

      if (riskDelta !== 0) {
        return riskDelta;
      }

      return left.arrivalMinute - right.arrivalMinute;
    });
}

function buildResourceUse(decisions: TriageDecision[]) {
  return decisions.reduce<Record<ClinicResourceId, number>>(
    (usage, decision) => ({
      ...usage,
      [decision.resourceId]: usage[decision.resourceId] + 1,
    }),
    { resus: 0, doctor: 0, nurse: 0, lab: 0 },
  );
}

function buildClinicMetrics(
  patientEvaluations: PatientEvaluation[],
  issues: ClinicIssue[],
  resourceUse: Record<ClinicResourceId, number>,
  scenario: ClinicScenario,
) {
  const handled = patientEvaluations.filter((item) => item.decision);
  const deteriorations = patientEvaluations.filter((item) => item.status === "deteriorated").length;
  const averageWait = handled.length
    ? Math.round(handled.reduce((sum, item) => sum + item.waitMinutes, 0) / handled.length)
    : 0;
  const safetyScore = clampScore(
    100 +
      patientEvaluations.reduce((sum, item) => sum + item.safetyDelta, 0) -
      deteriorations * 10,
  );
  const fairnessScore = clampScore(
    100 -
      patientEvaluations.reduce((sum, item) => sum + Math.max(0, item.delayMinutes) * 1.4, 0) -
      buildPriorityInversionPenalty(patientEvaluations),
  );
  const efficiencyScore = clampScore(100 - buildResourcePenalty(resourceUse, scenario) - buildOverTriagePenalty(handled));
  const experienceScore = clampScore(
    100 -
      averageWait * 0.7 -
      patientEvaluations.filter((item) => item.patient.emotion === "angry" && !item.decision).length * 10 -
      patientEvaluations.filter((item) => item.patient.emotion === "anxious" && item.waitMinutes > 20).length * 8,
  );
  const queuePressure = patientEvaluations.filter((item) => !item.decision).length * 12 + deteriorations * 18;
  const totalScore = Math.round(
    safetyScore * 0.45 + fairnessScore * 0.2 + efficiencyScore * 0.18 + experienceScore * 0.17,
  );

  return {
    totalScore: clampScore(totalScore - issues.reduce((sum, issue) => sum + severityWeight[issue.severity] * 0.15, 0)),
    safetyScore,
    fairnessScore,
    efficiencyScore,
    experienceScore,
    deteriorations,
    averageWait,
    queuePressure,
  };
}

function buildClinicIssues(
  patientEvaluations: PatientEvaluation[],
  resourceUse: Record<ClinicResourceId, number>,
  scenario: ClinicScenario,
) {
  const issues: ClinicIssue[] = [];

  patientEvaluations.forEach((evaluation) => {
    const { decision, patient } = evaluation;

    if (!decision) {
      if (evaluation.status === "scheduled") {
        return;
      }

      issues.push({
        id: `waiting-${patient.id}`,
        severity: patient.recommendedLevel === "immediate" || patient.recommendedLevel === "urgent" ? "high" : "medium",
        title: `${patient.name} 仍在候诊`,
        detail: `${patient.chiefComplaint}，建议等级是${triageLevelLabels[patient.recommendedLevel]}。`,
      });
      return;
    }

    const levelDelta = levelUrgency[decision.level] - levelUrgency[patient.recommendedLevel];

    if (levelDelta < 0) {
      issues.push({
        id: `under-${patient.id}`,
        severity: levelDelta <= -2 ? "high" : "medium",
        title: `${patient.name} 分诊等级偏低`,
        detail: `选择了${triageLevelLabels[decision.level]}，推荐为${triageLevelLabels[patient.recommendedLevel]}。`,
      });
    }

    if (evaluation.status === "deteriorated") {
      issues.push({
        id: `deteriorated-${patient.id}`,
        severity: "high",
        title: `${patient.name} 等待后恶化`,
        detail: `等待 ${evaluation.waitMinutes} 分钟，超过恶化阈值 ${patient.deteriorationMinute} 分钟。`,
      });
    }

    if (!evaluation.resourceMatch) {
      issues.push({
        id: `resource-${patient.id}`,
        severity: patient.recommendedLevel === "immediate" ? "medium" : "low",
        title: `${patient.name} 资源路径不佳`,
        detail: `更适合${clinicResourceLabels[patient.bestResource]}，当前安排到${clinicResourceLabels[decision.resourceId]}。`,
      });
    }
  });

  (Object.keys(scenario.resources) as ClinicResourceId[]).forEach((resourceId) => {
    if (resourceUse[resourceId] > scenario.resources[resourceId]) {
      issues.push({
        id: `resource-over-${resourceId}`,
        severity: "medium",
        title: `${clinicResourceLabels[resourceId]}超负荷`,
        detail: `容量 ${scenario.resources[resourceId]}，已安排 ${resourceUse[resourceId]} 位患者。`,
      });
    }
  });

  return issues.sort((left, right) => severityWeight[right.severity] - severityWeight[left.severity]);
}

function buildPatientFeedback(
  patient: PatientCase,
  decision: TriageDecision | undefined,
  waitMinutes: number,
  missedDeterioration: boolean,
  resourceMatch: boolean,
) {
  if (!decision) {
    if (waitMinutes === 0) {
      return `${patient.hiddenRisk} 已进入候诊队列，等待分诊判断。`;
    }

    return `${patient.hiddenRisk} 仍需做出分诊决定。`;
  }

  if (missedDeterioration) {
    return `${patient.hiddenRisk} 等待 ${waitMinutes} 分钟后风险上升。`;
  }

  if (decision.level === patient.recommendedLevel && resourceMatch) {
    return patient.outcome;
  }

  if (levelUrgency[decision.level] < levelUrgency[patient.recommendedLevel]) {
    return `${patient.hiddenRisk} 当前分诊偏低，可能造成延误。`;
  }

  return `安全性基本可控，但${clinicResourceLabels[decision.resourceId]}不是最合适路径。`;
}

function getSafetyDelta({
  delayMinutes,
  levelDelta,
  missedDeterioration,
  resourceMatch,
}: {
  delayMinutes: number;
  levelDelta: number;
  missedDeterioration: boolean;
  resourceMatch: boolean;
}) {
  let delta = 6;

  if (levelDelta < 0) {
    delta -= Math.abs(levelDelta) * 14;
  } else if (levelDelta > 1) {
    delta -= Math.max(0, levelDelta - 1) * 4;
  }

  delta -= Math.min(24, delayMinutes * 1.2);

  if (missedDeterioration) {
    delta -= 22;
  }

  if (resourceMatch) {
    delta += 5;
  } else {
    delta -= 6;
  }

  return delta;
}

function getWaitingSafetyDelta(
  patient: PatientCase,
  waitMinutes: number,
  missedDeterioration: boolean,
  hasArrived: boolean,
) {
  if (!hasArrived) {
    return 0;
  }

  const urgency = levelUrgency[patient.recommendedLevel];
  const pressure = patient.deteriorationMinute > 0 ? waitMinutes / patient.deteriorationMinute : 0;
  let delta = -Math.min(28, pressure * urgency * 7);

  if (patient.recommendedLevel === "immediate" && waitMinutes > 0) {
    delta -= 8;
  }

  if (missedDeterioration) {
    delta -= 24;
  }

  return delta;
}

function buildPriorityInversionPenalty(patientEvaluations: PatientEvaluation[]) {
  let penalty = 0;

  patientEvaluations.forEach((left) => {
    patientEvaluations.forEach((right) => {
      if (!left.decision || !right.decision || left.patient.id === right.patient.id) {
        return;
      }

      if (
        levelUrgency[left.patient.recommendedLevel] > levelUrgency[right.patient.recommendedLevel] &&
        left.decision.decidedAt > right.decision.decidedAt
      ) {
        penalty += 6;
      }
    });
  });

  return penalty;
}

function buildResourcePenalty(resourceUse: Record<ClinicResourceId, number>, scenario: ClinicScenario) {
  return (Object.keys(scenario.resources) as ClinicResourceId[]).reduce((sum, resourceId) => {
    const over = Math.max(0, resourceUse[resourceId] - scenario.resources[resourceId]);
    return sum + over * 14;
  }, 0);
}

function buildOverTriagePenalty(patientEvaluations: PatientEvaluation[]) {
  return patientEvaluations.reduce((sum, evaluation) => {
    if (!evaluation.decision) {
      return sum;
    }

    const delta = levelUrgency[evaluation.decision.level] - levelUrgency[evaluation.patient.recommendedLevel];
    return sum + Math.max(0, delta - 1) * levelCost[evaluation.decision.level] * 2;
  }, 0);
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}
