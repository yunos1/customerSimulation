import { useCallback, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  BarChart3,
  Briefcase,
  CalendarClock,
  ChevronLeft,
  Clock3,
  Coins,
  Gauge,
  Minus,
  Plus,
  RefreshCcw,
  ShieldCheck,
  SlidersHorizontal,
  Store,
  UserRoundX,
  Users,
} from "lucide-react";
import {
  clonePresetShifts,
  employees,
  getPlanPreset,
  getScenario,
  planPresets,
  roleLabels,
  roleLongLabels,
  rosterScenarios,
} from "../shiftRoster/content";
import { buildDemandProfile, evaluateRoster } from "../shiftRoster/engine";
import type {
  Employee,
  PlanPresetId,
  RoleId,
  RosterEvaluation,
  RosterModifiers,
  RosterScenarioId,
  ShiftAssignment,
} from "../shiftRoster/types";

interface ShiftRosterSimulatorProps {
  onBackToHub: () => void;
}

const roleOrder: RoleId[] = ["lead", "cashier", "floor", "stock", "trainee"];
const issueToneLabels = {
  high: "重点",
  medium: "注意",
  low: "优化",
};

export function ShiftRosterSimulator({ onBackToHub }: ShiftRosterSimulatorProps) {
  const [scenarioId, setScenarioId] = useState<RosterScenarioId>("weekday");
  const [planId, setPlanId] = useState<PlanPresetId>("balanced");
  const [shifts, setShifts] = useState<ShiftAssignment[]>(() => clonePresetShifts("balanced"));
  const [modifiers, setModifiers] = useState<RosterModifiers>({
    trafficLift: 0,
    extendedClose: false,
  });
  const scenario = getScenario(scenarioId);
  const demand = useMemo(() => buildDemandProfile(scenario, modifiers), [scenario, modifiers]);
  const evaluation = useMemo(
    () => evaluateRoster({ employees, modifiers, scenario, shifts }),
    [modifiers, scenario, shifts],
  );
  const chartMaxTraffic = Math.max(...demand.map((point) => point.traffic), 1);
  const timelineStart = Math.min(scenario.openHour, 8);
  const timelineEnd = scenario.closeHour + (modifiers.extendedClose ? 1 : 0);

  const selectPlan = useCallback((nextPlanId: PlanPresetId) => {
    setPlanId(nextPlanId);
    setShifts(clonePresetShifts(nextPlanId));
  }, []);

  const selectScenario = useCallback((nextScenarioId: RosterScenarioId) => {
    setScenarioId(nextScenarioId);
  }, []);

  const changeTrafficLift = useCallback((value: number) => {
    setModifiers((current) => ({ ...current, trafficLift: value }));
  }, []);

  const changeAbsence = useCallback((employeeId: string) => {
    setModifiers((current) => ({
      ...current,
      absentEmployeeId: employeeId === "none" ? undefined : employeeId,
    }));
  }, []);

  const toggleExtendedClose = useCallback(() => {
    setModifiers((current) => ({ ...current, extendedClose: !current.extendedClose }));
  }, []);

  const resetPlan = useCallback(() => {
    setShifts(clonePresetShifts(planId));
  }, [planId]);

  const updateShift = useCallback(
    (shiftId: string, patch: Partial<Pick<ShiftAssignment, "start" | "end" | "role">>) => {
      setShifts((current) =>
        current.map((shift) => {
          if (shift.id !== shiftId) {
            return shift;
          }

          const next = { ...shift, ...patch };
          const boundedStart = Math.max(8, Math.min(timelineEnd - 1, next.start));
          const boundedEnd = Math.max(boundedStart + 1, Math.min(timelineEnd, next.end));

          return {
            ...next,
            start: boundedStart,
            end: boundedEnd,
          };
        }),
      );
    },
    [timelineEnd],
  );

  return (
    <main className="roster-shell">
      <header className="roster-topbar">
        <div>
          <p className="eyebrow">Simulator Box / Store Roster</p>
          <h1>门店排班模拟器</h1>
        </div>
        <div className="topbar-actions">
          <button className="hub-back-button" type="button" onClick={onBackToHub}>
            <ChevronLeft size={17} aria-hidden="true" />
            模拟器盒子
          </button>
          <div className="shift-badge">
            <Store size={15} aria-hidden="true" />
            {scenario.shortLabel} / {getPlanPreset(planId).title}
          </div>
        </div>
      </header>

      <RosterMetrics evaluation={evaluation} />

      <section className="roster-workspace">
        <section className="roster-main">
          <RosterControlDeck
            absenceId={modifiers.absentEmployeeId}
            extendedClose={modifiers.extendedClose}
            onAbsenceChange={changeAbsence}
            onExtendedCloseToggle={toggleExtendedClose}
            onPlanChange={selectPlan}
            onScenarioChange={selectScenario}
            onTrafficLiftChange={changeTrafficLift}
            planId={planId}
            scenarioId={scenarioId}
            trafficLift={modifiers.trafficLift}
          />

          <section className="panel roster-board">
            <div className="panel-header roster-board-header">
              <div>
                <p className="eyebrow">班表时间轴</p>
                <h2>{scenario.title}</h2>
                <span>{scenario.description}</span>
              </div>
              <button className="secondary-button roster-icon-button" type="button" onClick={resetPlan}>
                <RefreshCcw size={16} aria-hidden="true" />
                重置
              </button>
            </div>

            <DemandStrip
              chartMaxTraffic={chartMaxTraffic}
              demand={demand}
              evaluation={evaluation}
              timelineEnd={timelineEnd}
              timelineStart={timelineStart}
            />

            <ShiftTimeline
              absentEmployeeId={modifiers.absentEmployeeId}
              employees={employees}
              onShiftChange={updateShift}
              shifts={shifts}
              timelineEnd={timelineEnd}
              timelineStart={timelineStart}
            />
          </section>

          <PlanComparison
            activePlanId={planId}
            modifiers={modifiers}
            scenarioId={scenarioId}
            onSelectPlan={selectPlan}
          />
        </section>

        <aside className="roster-side">
          <IssuePanel evaluation={evaluation} />
          <EmployeePanel
            absentEmployeeId={modifiers.absentEmployeeId}
            evaluation={evaluation}
            shifts={shifts}
          />
          <RoleLegend />
        </aside>
      </section>
    </main>
  );
}

function RosterMetrics({ evaluation }: { evaluation: RosterEvaluation }) {
  const metrics = [
    {
      label: "综合评分",
      value: evaluation.metrics.totalScore,
      suffix: "",
      icon: Gauge,
      tone: "positive",
      meter: evaluation.metrics.totalScore,
    },
    {
      label: "服务覆盖",
      value: evaluation.metrics.serviceScore,
      suffix: "",
      icon: ShieldCheck,
      tone: "time",
      meter: evaluation.metrics.serviceScore,
    },
    {
      label: "人工成本",
      value: `¥${evaluation.metrics.scheduledCost}`,
      suffix: "",
      icon: Coins,
      tone: "cost",
      meter: evaluation.metrics.costScore,
    },
    {
      label: "公平度",
      value: evaluation.metrics.fairnessScore,
      suffix: "",
      icon: Users,
      tone: "warning",
      meter: evaluation.metrics.fairnessScore,
    },
    {
      label: "缺编小时",
      value: evaluation.metrics.uncoveredHours,
      suffix: "h",
      icon: AlertTriangle,
      tone: "danger",
      meter: Math.max(0, 100 - evaluation.metrics.uncoveredHours * 12),
    },
    {
      label: "预计排队",
      value: evaluation.metrics.expectedQueueMinutes,
      suffix: "min",
      icon: Clock3,
      tone: "time",
      meter: Math.max(0, 100 - evaluation.metrics.expectedQueueMinutes * 8),
    },
  ];

  return (
    <section className="metrics-bar roster-metrics" aria-label="排班指标">
      {metrics.map((item) => {
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

function RosterControlDeck({
  absenceId,
  extendedClose,
  onAbsenceChange,
  onExtendedCloseToggle,
  onPlanChange,
  onScenarioChange,
  onTrafficLiftChange,
  planId,
  scenarioId,
  trafficLift,
}: {
  absenceId?: string;
  extendedClose: boolean;
  onAbsenceChange: (employeeId: string) => void;
  onExtendedCloseToggle: () => void;
  onPlanChange: (planId: PlanPresetId) => void;
  onScenarioChange: (scenarioId: RosterScenarioId) => void;
  onTrafficLiftChange: (value: number) => void;
  planId: PlanPresetId;
  scenarioId: RosterScenarioId;
  trafficLift: number;
}) {
  return (
    <section className="panel roster-control-deck">
      <div className="roster-control-group">
        <div className="roster-control-title">
          <CalendarClock size={18} aria-hidden="true" />
          <h2>场景</h2>
        </div>
        <div className="roster-segment">
          {rosterScenarios.map((scenario) => (
            <button
              className={scenario.id === scenarioId ? "roster-segment-active" : ""}
              key={scenario.id}
              type="button"
              onClick={() => onScenarioChange(scenario.id)}
            >
              {scenario.shortLabel}
            </button>
          ))}
        </div>
      </div>

      <div className="roster-control-group">
        <div className="roster-control-title">
          <Briefcase size={18} aria-hidden="true" />
          <h2>方案</h2>
        </div>
        <div className="roster-segment">
          {planPresets.map((plan) => (
            <button
              className={plan.id === planId ? "roster-segment-active" : ""}
              key={plan.id}
              type="button"
              onClick={() => onPlanChange(plan.id)}
            >
              {plan.title}
            </button>
          ))}
        </div>
      </div>

      <div className="roster-control-group">
        <div className="roster-control-title">
          <SlidersHorizontal size={18} aria-hidden="true" />
          <h2>压力</h2>
        </div>
        <label className="roster-range-control">
          <span>客流变化 {trafficLift > 0 ? `+${trafficLift}` : trafficLift}%</span>
          <input
            max="30"
            min="-15"
            step="5"
            type="range"
            value={trafficLift}
            onChange={(event) => onTrafficLiftChange(Number(event.target.value))}
          />
        </label>
      </div>

      <div className="roster-control-group roster-control-row">
        <label className="roster-select-control">
          <span>临时请假</span>
          <select value={absenceId ?? "none"} onChange={(event) => onAbsenceChange(event.target.value)}>
            <option value="none">无人请假</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name}
              </option>
            ))}
          </select>
        </label>
        <button
          className={extendedClose ? "roster-toggle roster-toggle-active" : "roster-toggle"}
          type="button"
          onClick={onExtendedCloseToggle}
        >
          <Clock3 size={16} aria-hidden="true" />
          延长营业
        </button>
      </div>
    </section>
  );
}

function DemandStrip({
  chartMaxTraffic,
  demand,
  evaluation,
  timelineEnd,
  timelineStart,
}: {
  chartMaxTraffic: number;
  demand: ReturnType<typeof buildDemandProfile>;
  evaluation: RosterEvaluation;
  timelineEnd: number;
  timelineStart: number;
}) {
  const evaluationByHour = new Map(evaluation.hourly.map((hour) => [hour.hour, hour]));

  return (
    <div className="demand-strip" style={{ ["--hours" as string]: timelineEnd - timelineStart }}>
      <div className="timeline-hour-labels">
        {Array.from({ length: timelineEnd - timelineStart }, (_, index) => timelineStart + index).map((hour) => (
          <span key={hour}>{hour}</span>
        ))}
      </div>
      <div className="demand-bars">
        {demand.map((point) => {
          const hourEvaluation = evaluationByHour.get(point.hour);

          return (
            <div className="demand-bar-cell" key={point.hour}>
              <span
                className={`demand-bar demand-bar-${hourEvaluation?.state ?? "good"}`}
                style={{ height: `${Math.max(14, (point.traffic / chartMaxTraffic) * 92)}%` }}
                title={`${point.hour}:00 客流 ${point.traffic}`}
              />
              <small>{point.traffic}</small>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ShiftTimeline({
  absentEmployeeId,
  employees,
  onShiftChange,
  shifts,
  timelineEnd,
  timelineStart,
}: {
  absentEmployeeId?: string;
  employees: Employee[];
  onShiftChange: (shiftId: string, patch: Partial<Pick<ShiftAssignment, "start" | "end" | "role">>) => void;
  shifts: ShiftAssignment[];
  timelineEnd: number;
  timelineStart: number;
}) {
  const shiftsByEmployeeId = new Map<string, ShiftAssignment[]>();

  shifts.forEach((shift) => {
    shiftsByEmployeeId.set(shift.employeeId, [...(shiftsByEmployeeId.get(shift.employeeId) ?? []), shift]);
  });

  return (
    <div className="shift-timeline">
      {employees.map((employee) => {
        const employeeShifts = shiftsByEmployeeId.get(employee.id) ?? [];

        return (
          <article
            className={employee.id === absentEmployeeId ? "shift-row shift-row-absent" : "shift-row"}
            key={employee.id}
          >
            <div className="shift-row-profile">
              <span>{employee.initials}</span>
              <div>
                <strong>{employee.name}</strong>
                <small>{employee.title}</small>
              </div>
            </div>

            <div
              className="shift-row-track"
              style={{
                ["--hours" as string]: timelineEnd - timelineStart,
              }}
            >
              {employeeShifts.map((shift) => (
                <ShiftBlock
                  key={shift.id}
                  onShiftChange={onShiftChange}
                  shift={shift}
                  timelineEnd={timelineEnd}
                  timelineStart={timelineStart}
                />
              ))}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function ShiftBlock({
  onShiftChange,
  shift,
  timelineEnd,
  timelineStart,
}: {
  onShiftChange: (shiftId: string, patch: Partial<Pick<ShiftAssignment, "start" | "end" | "role">>) => void;
  shift: ShiftAssignment;
  timelineEnd: number;
  timelineStart: number;
}) {
  const left = ((shift.start - timelineStart) / (timelineEnd - timelineStart)) * 100;
  const width = ((shift.end - shift.start) / (timelineEnd - timelineStart)) * 100;

  return (
    <div
      className={`shift-block shift-block-${shift.role}`}
      style={{
        left: `${left}%`,
        width: `${width}%`,
      }}
    >
      <div className="shift-block-main">
        <strong>{roleLabels[shift.role]}</strong>
        <span>
          {formatClock(shift.start)}-{formatClock(shift.end)}
        </span>
      </div>
      <div className="shift-block-actions">
        <button
          aria-label="提前上班"
          title="提前上班"
          type="button"
          onClick={() => onShiftChange(shift.id, { start: shift.start - 1 })}
        >
          <Plus size={13} aria-hidden="true" />
        </button>
        <button
          aria-label="推迟上班"
          title="推迟上班"
          type="button"
          onClick={() => onShiftChange(shift.id, { start: shift.start + 1 })}
        >
          <Minus size={13} aria-hidden="true" />
        </button>
        <button
          aria-label="延长下班"
          title="延长下班"
          type="button"
          onClick={() => onShiftChange(shift.id, { end: shift.end + 1 })}
        >
          <Plus size={13} aria-hidden="true" />
        </button>
        <button
          aria-label="提前下班"
          title="提前下班"
          type="button"
          onClick={() => onShiftChange(shift.id, { end: shift.end - 1 })}
        >
          <Minus size={13} aria-hidden="true" />
        </button>
      </div>
      <select
        aria-label="岗位"
        value={shift.role}
        onChange={(event) => onShiftChange(shift.id, { role: event.target.value as RoleId })}
      >
        {roleOrder.map((role) => (
          <option key={role} value={role}>
            {roleLabels[role]}
          </option>
        ))}
      </select>
    </div>
  );
}

function PlanComparison({
  activePlanId,
  modifiers,
  onSelectPlan,
  scenarioId,
}: {
  activePlanId: PlanPresetId;
  modifiers: RosterModifiers;
  onSelectPlan: (planId: PlanPresetId) => void;
  scenarioId: RosterScenarioId;
}) {
  const scenario = getScenario(scenarioId);

  return (
    <section className="plan-comparison-grid">
      {planPresets.map((plan) => {
        const evaluation = evaluateRoster({
          employees,
          modifiers,
          scenario,
          shifts: plan.shifts,
        });

        return (
          <button
            className={plan.id === activePlanId ? "plan-card plan-card-active" : "plan-card"}
            key={plan.id}
            type="button"
            onClick={() => onSelectPlan(plan.id)}
          >
            <span>{plan.intent}</span>
            <strong>{plan.title}</strong>
            <div className="plan-card-metrics">
              <em>{evaluation.metrics.totalScore}</em>
              <small>¥{evaluation.metrics.scheduledCost}</small>
              <small>{evaluation.metrics.uncoveredHours}h 缺口</small>
            </div>
          </button>
        );
      })}
    </section>
  );
}

function IssuePanel({ evaluation }: { evaluation: RosterEvaluation }) {
  const visibleIssues = evaluation.issues.slice(0, 7);

  return (
    <section className="panel roster-info-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">风险提示</p>
          <h2>需要店长确认</h2>
        </div>
        <AlertTriangle size={20} aria-hidden="true" />
      </div>
      {visibleIssues.length === 0 ? (
        <div className="roster-empty-state">
          <BadgeCheck size={24} aria-hidden="true" />
          <strong>这个班表很稳</strong>
          <span>没有明显岗位缺口或公平风险。</span>
        </div>
      ) : (
        <div className="issue-list">
          {visibleIssues.map((issue) => (
            <article className={`issue-card issue-card-${issue.severity}`} key={issue.id}>
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

function EmployeePanel({
  absentEmployeeId,
  evaluation,
  shifts,
}: {
  absentEmployeeId?: string;
  evaluation: RosterEvaluation;
  shifts: ShiftAssignment[];
}) {
  const summaryByEmployeeId = new Map(
    evaluation.employeeSummaries.map((summary) => [summary.employeeId, summary]),
  );
  const shiftByEmployeeId = new Map(shifts.map((shift) => [shift.employeeId, shift]));

  return (
    <section className="panel roster-info-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">员工视角</p>
          <h2>工时与偏好</h2>
        </div>
        <Users size={20} aria-hidden="true" />
      </div>
      <div className="employee-roster-list">
        {employees.map((employee) => {
          const summary = summaryByEmployeeId.get(employee.id);
          const shift = shiftByEmployeeId.get(employee.id);
          const effectiveHours = summary?.effectiveHours ?? 0;

          return (
            <article
              className={employee.id === absentEmployeeId ? "employee-roster-card employee-roster-card-absent" : "employee-roster-card"}
              key={employee.id}
            >
              <span className="employee-roster-avatar">{employee.initials}</span>
              <div>
                <strong>{employee.name}</strong>
                <small>{employee.preference}</small>
              </div>
              <em>
                {employee.id === absentEmployeeId ? <UserRoundX size={15} aria-hidden="true" /> : null}
                {effectiveHours}h
              </em>
              {shift ? (
                <b>
                  {roleLabels[shift.role]} {formatClock(shift.start)}-{formatClock(shift.end)}
                </b>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function RoleLegend() {
  return (
    <section className="panel roster-info-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">岗位能力</p>
          <h2>覆盖规则</h2>
        </div>
        <BarChart3 size={20} aria-hidden="true" />
      </div>
      <div className="role-legend-list">
        {roleOrder.map((role) => (
          <article key={role}>
            <span className={`role-dot role-dot-${role}`} />
            <div>
              <strong>{roleLongLabels[role]}</strong>
              <small>{getRoleRule(role)}</small>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function getRoleRule(role: RoleId) {
  switch (role) {
    case "lead":
      return "开店、闭店和高峰期都需要至少一名负责人。";
    case "cashier":
      return "客流越高，需要越多收银能力来压住排队。";
    case "floor":
      return "卖场导购决定服务稳定性和成交转化。";
    case "stock":
      return "开店、促销和晚高峰需要补货与陈列支撑。";
    case "trainee":
      return "新人不能单独承担负责人缺口，需要同场带教。";
  }
}

function formatClock(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`;
}
