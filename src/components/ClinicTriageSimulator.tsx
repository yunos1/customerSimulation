import { useCallback, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  BadgeCheck,
  Brain,
  ChevronLeft,
  ClipboardList,
  Clock3,
  FileHeart,
  HeartPulse,
  RotateCcw,
  ShieldAlert,
  Stethoscope,
  Thermometer,
  TimerReset,
  UsersRound,
} from "lucide-react";
import {
  clinicResourceLabels,
  clinicScenarios,
  getClinicScenario,
  getScenarioPatients,
  triageLevelDescriptions,
  triageLevelLabels,
  triageLevelShortLabels,
} from "../clinicTriage/content";
import { evaluateClinicTriage, getPatientRiskScore, sortQueueByRisk } from "../clinicTriage/engine";
import type {
  ClinicResourceId,
  ClinicScenarioId,
  PatientCase,
  TriageDecision,
  TriageLevel,
} from "../clinicTriage/types";

interface ClinicTriageSimulatorProps {
  onBackToHub: () => void;
}

const triageLevels: TriageLevel[] = ["immediate", "urgent", "soon", "routine", "redirect"];
const resourceIds: ClinicResourceId[] = ["resus", "doctor", "nurse", "lab"];
const issueToneLabels = {
  high: "高危",
  medium: "注意",
  low: "优化",
};

export function ClinicTriageSimulator({ onBackToHub }: ClinicTriageSimulatorProps) {
  const [scenarioId, setScenarioId] = useState<ClinicScenarioId>("morning");
  const [decisions, setDecisions] = useState<TriageDecision[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>("p-chest");
  const [selectedLevel, setSelectedLevel] = useState<TriageLevel>("urgent");
  const [selectedResource, setSelectedResource] = useState<ClinicResourceId>("doctor");
  const [showDebrief, setShowDebrief] = useState(false);
  const scenario = getClinicScenario(scenarioId);
  const patients = useMemo(() => getScenarioPatients(scenarioId), [scenarioId]);
  const currentMinute = decisions.length
    ? Math.max(...decisions.map((decision) => decision.decidedAt))
    : Math.min(...patients.map((patient) => patient.arrivalMinute));
  const evaluation = useMemo(
    () =>
      evaluateClinicTriage({
        currentMinute: showDebrief ? scenario.durationMinutes : currentMinute,
        decisions,
        patients,
        scenario,
      }),
    [currentMinute, decisions, patients, scenario, showDebrief],
  );
  const queue = useMemo(() => sortQueueByRisk(patients, decisions), [decisions, patients]);
  const selectedPatient = patients.find((patient) => patient.id === selectedPatientId) ?? queue[0] ?? patients[0];
  const handledIds = new Set(decisions.map((decision) => decision.patientId));
  const hasSelectedBeenHandled = handledIds.has(selectedPatient?.id ?? "");
  const nextDecisionMinute = Math.min(
    scenario.durationMinutes,
    Math.max(currentMinute + 4, (selectedPatient?.arrivalMinute ?? 0) + 1),
  );

  const selectScenario = useCallback((nextScenarioId: ClinicScenarioId) => {
    const nextPatients = getScenarioPatients(nextScenarioId);
    setScenarioId(nextScenarioId);
    setDecisions([]);
    setSelectedPatientId(nextPatients[0]?.id ?? "");
    setSelectedLevel("urgent");
    setSelectedResource("doctor");
    setShowDebrief(false);
  }, []);

  const selectPatient = useCallback((patient: PatientCase) => {
    setSelectedPatientId(patient.id);
    setSelectedLevel(patient.recommendedLevel === "redirect" ? "routine" : "urgent");
    setSelectedResource(patient.bestResource === "resus" ? "doctor" : patient.bestResource);
  }, []);

  const submitDecision = useCallback(() => {
    if (!selectedPatient || handledIds.has(selectedPatient.id)) {
      return;
    }

    setDecisions((current) => [
      ...current,
      {
        patientId: selectedPatient.id,
        level: selectedLevel,
        resourceId: selectedResource,
        decidedAt: nextDecisionMinute,
      },
    ]);

    const nextPatient = queue.find((patient) => patient.id !== selectedPatient.id);

    if (nextPatient) {
      setSelectedPatientId(nextPatient.id);
      setSelectedLevel(nextPatient.recommendedLevel === "redirect" ? "routine" : "urgent");
      setSelectedResource(nextPatient.bestResource === "resus" ? "doctor" : nextPatient.bestResource);
    } else {
      setShowDebrief(true);
    }
  }, [handledIds, nextDecisionMinute, queue, selectedLevel, selectedPatient, selectedResource]);

  const resetRound = useCallback(() => {
    setDecisions([]);
    setSelectedPatientId(patients[0]?.id ?? "");
    setSelectedLevel("urgent");
    setSelectedResource("doctor");
    setShowDebrief(false);
  }, [patients]);

  return (
    <main className="clinic-shell">
      <header className="clinic-topbar">
        <div>
          <p className="eyebrow">Simulator Box / Clinic Triage</p>
          <h1>诊室分诊模拟器</h1>
        </div>
        <div className="topbar-actions">
          <button className="hub-back-button" type="button" onClick={onBackToHub}>
            <ChevronLeft size={17} aria-hidden="true" />
            模拟器盒子
          </button>
          <div className="shift-badge">
            <Stethoscope size={15} aria-hidden="true" />
            {scenario.shortLabel} / {currentMinute} 分钟
          </div>
        </div>
      </header>

      <ClinicMetrics metrics={evaluation.metrics} />

      <section className="clinic-workspace">
        <section className="clinic-main">
          <ScenarioDeck
            onScenarioChange={selectScenario}
            onReset={resetRound}
            scenarioId={scenarioId}
          />

          <section className="clinic-stage panel">
            <div className="panel-header clinic-stage-header">
              <div>
                <p className="eyebrow">分诊台</p>
                <h2>{scenario.title}</h2>
                <span>{scenario.description}</span>
              </div>
              <button className="secondary-button" type="button" onClick={() => setShowDebrief((value) => !value)}>
                <ClipboardList size={16} aria-hidden="true" />
                {showDebrief ? "继续分诊" : "查看复盘"}
              </button>
            </div>

            {showDebrief ? (
              <DebriefView evaluation={evaluation} />
            ) : (
              <div className="clinic-stage-grid">
                <PatientQueue
                  decisions={decisions}
                  onSelectPatient={selectPatient}
                  patients={patients}
                  selectedPatientId={selectedPatient?.id}
                />
                {selectedPatient ? (
                  <TriageDesk
                    disabled={hasSelectedBeenHandled}
                    onLevelChange={setSelectedLevel}
                    onResourceChange={setSelectedResource}
                    onSubmit={submitDecision}
                    patient={selectedPatient}
                    selectedLevel={selectedLevel}
                    selectedResource={selectedResource}
                  />
                ) : null}
              </div>
            )}
          </section>
        </section>

        <aside className="clinic-side">
          <IssuePanel evaluation={evaluation} />
          <ResourcePanel decisions={decisions} scenario={scenario} />
          <RulePanel />
        </aside>
      </section>
    </main>
  );
}

function ClinicMetrics({ metrics }: { metrics: ReturnType<typeof evaluateClinicTriage>["metrics"] }) {
  const items = [
    { label: "综合评分", value: metrics.totalScore, suffix: "", icon: HeartPulse, tone: "positive", meter: metrics.totalScore },
    { label: "医疗安全", value: metrics.safetyScore, suffix: "", icon: ShieldAlert, tone: "danger", meter: metrics.safetyScore },
    { label: "等待公平", value: metrics.fairnessScore, suffix: "", icon: UsersRound, tone: "warning", meter: metrics.fairnessScore },
    { label: "资源效率", value: metrics.efficiencyScore, suffix: "", icon: Activity, tone: "time", meter: metrics.efficiencyScore },
    { label: "恶化事件", value: metrics.deteriorations, suffix: "", icon: AlertCircle, tone: "danger", meter: Math.max(0, 100 - metrics.deteriorations * 30) },
    { label: "平均等待", value: metrics.averageWait, suffix: "min", icon: Clock3, tone: "cost", meter: Math.max(0, 100 - metrics.averageWait * 2) },
  ];

  return (
    <section className="metrics-bar clinic-metrics" aria-label="分诊指标">
      {items.map((item) => {
        const Icon = item.icon;

        return (
          <div className={`metric metric-${item.tone}`} key={item.label}>
            <div className="metric-heading">
              <Icon size={18} aria-hidden="true" />
              <span>{item.label}</span>
            </div>
            <strong>
              {item.value}
              {item.suffix}
            </strong>
            <div className="meter" aria-hidden="true">
              <span style={{ width: `${item.meter}%` }} />
            </div>
          </div>
        );
      })}
    </section>
  );
}

function ScenarioDeck({
  onReset,
  onScenarioChange,
  scenarioId,
}: {
  onReset: () => void;
  onScenarioChange: (scenarioId: ClinicScenarioId) => void;
  scenarioId: ClinicScenarioId;
}) {
  return (
    <section className="panel clinic-scenario-deck">
      <div className="clinic-control-title">
        <TimerReset size={18} aria-hidden="true" />
        <h2>分诊场景</h2>
      </div>
      <div className="clinic-segment">
        {clinicScenarios.map((scenario) => (
          <button
            className={scenario.id === scenarioId ? "clinic-segment-active" : ""}
            key={scenario.id}
            type="button"
            onClick={() => onScenarioChange(scenario.id)}
          >
            {scenario.shortLabel}
          </button>
        ))}
      </div>
      <button className="secondary-button" type="button" onClick={onReset}>
        <RotateCcw size={16} aria-hidden="true" />
        重置本轮
      </button>
    </section>
  );
}

function PatientQueue({
  decisions,
  onSelectPatient,
  patients,
  selectedPatientId,
}: {
  decisions: TriageDecision[];
  onSelectPatient: (patient: PatientCase) => void;
  patients: PatientCase[];
  selectedPatientId?: string;
}) {
  const decidedIds = new Set(decisions.map((decision) => decision.patientId));
  const sortedPatients = sortQueueByRisk(patients, decisions);
  const handledPatients = patients.filter((patient) => decidedIds.has(patient.id));

  return (
    <div className="patient-queue">
      <div className="clinic-section-title">
        <FileHeart size={18} aria-hidden="true" />
        <h3>候诊队列</h3>
      </div>
      {[...sortedPatients, ...handledPatients].map((patient) => {
        const handled = decidedIds.has(patient.id);
        const riskScore = getPatientRiskScore(patient);

        return (
          <button
            className={`patient-card ${selectedPatientId === patient.id ? "patient-card-active" : ""} ${
              handled ? "patient-card-handled" : ""
            }`}
            key={patient.id}
            type="button"
            onClick={() => onSelectPatient(patient)}
          >
            <span className="patient-avatar">{patient.initials}</span>
            <div>
              <strong>{patient.name}</strong>
              <small>
                {patient.age} / 到达 {patient.arrivalMinute} 分钟
              </small>
              <em>{patient.chiefComplaint}</em>
            </div>
            <b>{handled ? "已分诊" : riskScore}</b>
          </button>
        );
      })}
    </div>
  );
}

function TriageDesk({
  disabled,
  onLevelChange,
  onResourceChange,
  onSubmit,
  patient,
  selectedLevel,
  selectedResource,
}: {
  disabled: boolean;
  onLevelChange: (level: TriageLevel) => void;
  onResourceChange: (resourceId: ClinicResourceId) => void;
  onSubmit: () => void;
  patient: PatientCase;
  selectedLevel: TriageLevel;
  selectedResource: ClinicResourceId;
}) {
  return (
    <div className="triage-desk">
      <div className="patient-brief-card">
        <div className="patient-brief-heading">
          <span className="patient-avatar patient-avatar-lg">{patient.initials}</span>
          <div>
            <p className="eyebrow">
              {patient.age} / {patient.chiefComplaint}
            </p>
            <h2>{patient.name}</h2>
            <span>{patient.visibleSummary}</span>
          </div>
        </div>

        <div className="vitals-grid">
          <Vital label="心率" value={patient.vitals.heartRate} unit="/min" />
          <Vital label="收缩压" value={patient.vitals.systolicBp} unit="mmHg" />
          <Vital label="体温" value={patient.vitals.temperature} unit="°C" />
          <Vital label="血氧" value={patient.vitals.spo2} unit="%" />
          <Vital label="疼痛" value={patient.vitals.pain} unit="/10" />
        </div>

        <div className="red-flag-list">
          {patient.redFlags.map((flag) => (
            <span key={flag}>{flag}</span>
          ))}
        </div>
      </div>

      <div className="triage-choice-panel">
        <div className="clinic-section-title">
          <Brain size={18} aria-hidden="true" />
          <h3>分诊等级</h3>
        </div>
        <div className="triage-level-grid">
          {triageLevels.map((level) => (
            <button
              className={level === selectedLevel ? "triage-level triage-level-active" : "triage-level"}
              key={level}
              type="button"
              onClick={() => onLevelChange(level)}
            >
              <strong>{triageLevelLabels[level]}</strong>
              <span>{triageLevelDescriptions[level]}</span>
            </button>
          ))}
        </div>

        <div className="clinic-section-title">
          <Stethoscope size={18} aria-hidden="true" />
          <h3>资源去向</h3>
        </div>
        <div className="resource-choice-grid">
          {resourceIds.map((resourceId) => (
            <button
              className={resourceId === selectedResource ? "resource-choice resource-choice-active" : "resource-choice"}
              key={resourceId}
              type="button"
              onClick={() => onResourceChange(resourceId)}
            >
              {clinicResourceLabels[resourceId]}
            </button>
          ))}
        </div>

        <button className="primary-button triage-submit-button" disabled={disabled} type="button" onClick={onSubmit}>
          <BadgeCheck size={17} aria-hidden="true" />
          {disabled ? "已完成分诊" : "提交分诊"}
        </button>
      </div>
    </div>
  );
}

function Vital({ label, unit, value }: { label: string; unit: string; value: number }) {
  return (
    <article>
      <span>{label}</span>
      <strong>
        {value}
        <small>{unit}</small>
      </strong>
    </article>
  );
}

function IssuePanel({ evaluation }: { evaluation: ReturnType<typeof evaluateClinicTriage> }) {
  return (
    <section className="panel clinic-info-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">现场风险</p>
          <h2>需要盯住</h2>
        </div>
        <AlertCircle size={20} aria-hidden="true" />
      </div>
      {evaluation.issues.length === 0 ? (
        <div className="clinic-empty-state">
          <BadgeCheck size={24} aria-hidden="true" />
          <strong>暂时稳定</strong>
          <span>高危信号和资源路径都在可控范围内。</span>
        </div>
      ) : (
        <div className="clinic-issue-list">
          {evaluation.issues.slice(0, 7).map((issue) => (
            <article className={`clinic-issue-card clinic-issue-card-${issue.severity}`} key={issue.id}>
              <span>{issueToneLabels[issue.severity]}</span>
              <strong>{issue.title}</strong>
              <p>{issue.detail}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function ResourcePanel({
  decisions,
  scenario,
}: {
  decisions: TriageDecision[];
  scenario: ReturnType<typeof getClinicScenario>;
}) {
  const usage = decisions.reduce<Record<ClinicResourceId, number>>(
    (current, decision) => ({
      ...current,
      [decision.resourceId]: current[decision.resourceId] + 1,
    }),
    { resus: 0, doctor: 0, nurse: 0, lab: 0 },
  );

  return (
    <section className="panel clinic-info-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">资源槽位</p>
          <h2>当前占用</h2>
        </div>
        <Activity size={20} aria-hidden="true" />
      </div>
      <div className="clinic-resource-list">
        {resourceIds.map((resourceId) => {
          const used = usage[resourceId];
          const capacity = scenario.resources[resourceId];

          return (
            <article className={used > capacity ? "clinic-resource-over" : ""} key={resourceId}>
              <strong>{clinicResourceLabels[resourceId]}</strong>
              <span>
                {used}/{capacity}
              </span>
              <div className="meter" aria-hidden="true">
                <span style={{ width: `${Math.min(100, (used / Math.max(1, capacity)) * 100)}%` }} />
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function RulePanel() {
  const rules = [
    "胸痛、出汗、低血压或低血氧优先，不按普通不适等待。",
    "儿童高热伴抽搐后嗜睡，需要尽快医生评估。",
    "言语含糊、单侧麻木、血压高，要考虑卒中时间窗。",
    "低危疼痛患者可以先由护士止痛固定，避免占用医生。",
    "发热咳嗽稳定者适合检查窗口或发热门诊分流。",
  ];

  return (
    <section className="panel clinic-info-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">规则卡</p>
          <h2>危险信号</h2>
        </div>
        <Thermometer size={20} aria-hidden="true" />
      </div>
      <div className="clinic-rule-list">
        {rules.map((rule) => (
          <article key={rule}>{rule}</article>
        ))}
      </div>
    </section>
  );
}

function DebriefView({ evaluation }: { evaluation: ReturnType<typeof evaluateClinicTriage> }) {
  return (
    <div className="clinic-debrief">
      <div className="clinic-score-card">
        <div>
          <span>{evaluation.metrics.totalScore}</span>
          <small>总分</small>
        </div>
        <article>
          <p className="eyebrow">复盘</p>
          <h2>{getDebriefTitle(evaluation.metrics.totalScore)}</h2>
          <span>
            安全 {evaluation.metrics.safetyScore} / 公平 {evaluation.metrics.fairnessScore} / 效率{" "}
            {evaluation.metrics.efficiencyScore}
          </span>
        </article>
      </div>

      <div className="clinic-timeline">
        {evaluation.patients
          .slice()
          .sort((left, right) => left.patient.arrivalMinute - right.patient.arrivalMinute)
          .map((item) => (
            <article className={`clinic-timeline-item clinic-timeline-item-${item.status}`} key={item.patient.id}>
              <span>{item.decision ? `${item.decision.decidedAt} 分` : "未处理"}</span>
              <div>
                <strong>
                  {item.patient.name} / 推荐 {triageLevelShortLabels[item.patient.recommendedLevel]}
                </strong>
                <p>{item.feedback}</p>
              </div>
            </article>
          ))}
      </div>
    </div>
  );
}

function getDebriefTitle(score: number) {
  if (score >= 85) {
    return "分诊节奏很稳";
  }

  if (score >= 70) {
    return "安全可控，但还有优化空间";
  }

  if (score >= 50) {
    return "现场被低危诉求挤压了";
  }

  return "高危信号被延误";
}
