import { roleLongLabels } from "./content";
import type {
  Employee,
  EmployeeRosterSummary,
  HourlyEvaluation,
  RequiredRoles,
  RosterEvaluation,
  RosterIssue,
  RosterModifiers,
  RosterScenario,
  ShiftAssignment,
} from "./types";

const emptyRoles: RequiredRoles = {
  lead: 0,
  cashier: 0,
  floor: 0,
  stock: 0,
  trainee: 0,
};

const severityWeight: Record<RosterIssue["severity"], number> = {
  high: 12,
  medium: 7,
  low: 3,
};

export function evaluateRoster({
  employees,
  modifiers,
  scenario,
  shifts,
}: {
  employees: Employee[];
  modifiers: RosterModifiers;
  scenario: RosterScenario;
  shifts: ShiftAssignment[];
}): RosterEvaluation {
  const employeeById = new Map(employees.map((employee) => [employee.id, employee]));
  const demand = buildDemandProfile(scenario, modifiers);
  const effectiveShifts = shifts.filter((shift) => shift.employeeId !== modifiers.absentEmployeeId);

  const hourly = demand.map((point) => {
    const activeShifts = effectiveShifts.filter((shift) => shift.start <= point.hour && point.hour < shift.end);
    const requiredRoles = getRequiredRoles(point.traffic, point.hour, scenario.id);
    const roleCoverage = countRoleCoverage(activeShifts, employeeById);
    const roleGaps = getRoleGaps(requiredRoles, roleCoverage);
    const requiredStaff = getRequiredStaff(point.traffic);
    const staffCount = new Set(activeShifts.map((shift) => shift.employeeId)).size;
    const shortage = Math.max(0, requiredStaff - staffCount);
    const surplus = Math.max(0, staffCount - requiredStaff);
    const roleGapTotal = sumRoles(roleGaps);
    const state: HourlyEvaluation["state"] =
      shortage > 0 || roleGapTotal >= 2
        ? "gap"
        : roleGapTotal > 0 || staffCount === requiredStaff
          ? "tight"
          : surplus >= 2
            ? "surplus"
            : "good";

    return {
      hour: point.hour,
      traffic: point.traffic,
      requiredStaff,
      staffCount,
      surplus,
      shortage,
      requiredRoles,
      roleCoverage,
      roleGaps,
      state,
      note: point.note,
    };
  });

  const employeeSummaries = buildEmployeeSummaries(shifts, effectiveShifts, employees, scenario, modifiers);
  const issues = buildIssues({
    employeeById,
    employeeSummaries,
    hourly,
    modifiers,
    scenario,
    shifts,
  });
  const metrics = buildMetrics(hourly, employeeSummaries, issues, effectiveShifts, employeeById, scenario);

  return {
    hourly,
    employeeSummaries,
    issues,
    metrics,
  };
}

export function buildDemandProfile(scenario: RosterScenario, modifiers: RosterModifiers) {
  const trafficMultiplier = 1 + modifiers.trafficLift / 100;
  const base = scenario.baseTraffic.map((point) => ({
    ...point,
    traffic: Math.round(point.traffic * trafficMultiplier),
  }));

  if (!modifiers.extendedClose) {
    return base;
  }

  return [
    ...base,
    {
      hour: scenario.closeHour,
      traffic: Math.round(scenario.extensionTraffic * trafficMultiplier),
      note: "延长营业",
    },
  ];
}

export function getRequiredStaff(traffic: number) {
  if (traffic >= 86) {
    return 6;
  }

  if (traffic >= 66) {
    return 5;
  }

  if (traffic >= 46) {
    return 4;
  }

  if (traffic >= 28) {
    return 3;
  }

  return 2;
}

export function getRequiredRoles(traffic: number, hour: number, scenarioId: RosterScenario["id"]): RequiredRoles {
  return {
    lead: 1,
    cashier: traffic >= 70 ? 2 : 1,
    floor: traffic >= 90 ? 3 : traffic >= 58 ? 2 : 1,
    stock: traffic >= 74 || hour <= 11 || hour >= 19 || scenarioId === "storm" ? 1 : 0,
    trainee: 0,
  };
}

function buildEmployeeSummaries(
  shifts: ShiftAssignment[],
  effectiveShifts: ShiftAssignment[],
  employees: Employee[],
  scenario: RosterScenario,
  modifiers: RosterModifiers,
): EmployeeRosterSummary[] {
  return employees.map((employee) => {
    const ownShifts = shifts.filter((shift) => shift.employeeId === employee.id);
    const ownEffectiveShifts = effectiveShifts.filter((shift) => shift.employeeId === employee.id);
    const scheduledHours = ownShifts.reduce((sum, shift) => sum + getShiftHours(shift), 0);
    const effectiveHours = employee.id === modifiers.absentEmployeeId
      ? 0
      : ownEffectiveShifts.reduce((sum, shift) => sum + getShiftHours(shift), 0);
    const closingShifts = ownEffectiveShifts.filter((shift) => shift.end >= scenario.closeHour).length;
    const outsideAvailability = ownShifts.some(
      (shift) => shift.start < employee.availability.start || shift.end > employee.availability.end,
    );

    return {
      employeeId: employee.id,
      scheduledHours,
      effectiveHours,
      closingShifts,
      outsideAvailability,
      overtimeHours: Math.max(0, scheduledHours - employee.maxHours),
    };
  });
}

function buildMetrics(
  hourly: HourlyEvaluation[],
  employeeSummaries: EmployeeRosterSummary[],
  issues: RosterIssue[],
  effectiveShifts: ShiftAssignment[],
  employeeById: Map<string, Employee>,
  scenario: RosterScenario,
) {
  const scheduledCost = Math.round(
    effectiveShifts.reduce((sum, shift) => {
      const employee = employeeById.get(shift.employeeId);
      return sum + (employee ? getShiftHours(shift) * employee.hourlyWage : 0);
    }, 0),
  );
  const roleGapHours = hourly.reduce((sum, hour) => sum + sumRoles(hour.roleGaps), 0);
  const shortageHours = hourly.reduce((sum, hour) => sum + hour.shortage, 0);
  const surplusHours = hourly.reduce((sum, hour) => sum + Math.max(0, hour.surplus - 1), 0);
  const uncoveredHours = Number((shortageHours + roleGapHours * 0.45).toFixed(1));
  const peakGapWeight = hourly.reduce(
    (sum, hour) => sum + (hour.shortage * 1.8 + sumRoles(hour.roleGaps) * 0.8) * (hour.traffic / 60),
    0,
  );
  const expectedQueueMinutes = Math.max(0, Math.round(peakGapWeight / Math.max(1, hourly.length) * 6));
  const serviceScore = clampScore(100 - shortageHours * 4.4 - roleGapHours * 2.6 - expectedQueueMinutes * 1.15);
  const budgetDelta = scheduledCost - scenario.targetBudget;
  const costScore = clampScore(
    budgetDelta <= 0
      ? 96 - Math.abs(budgetDelta) / scenario.targetBudget * 12
      : 96 - budgetDelta / scenario.targetBudget * 130,
  );
  const fairnessScore = buildFairnessScore(employeeSummaries);
  const stabilityScore = clampScore(
    100 - issues.reduce((sum, issue) => sum + severityWeight[issue.severity], 0),
  );
  const totalScore = Math.round(
    serviceScore * 0.45 + costScore * 0.2 + fairnessScore * 0.2 + stabilityScore * 0.15,
  );

  return {
    totalScore,
    serviceScore,
    costScore,
    fairnessScore,
    stabilityScore,
    scheduledCost,
    uncoveredHours,
    surplusHours,
    expectedQueueMinutes,
  };
}

function buildFairnessScore(employeeSummaries: EmployeeRosterSummary[]) {
  const workingSummaries = employeeSummaries.filter((summary) => summary.effectiveHours > 0);

  if (workingSummaries.length === 0) {
    return 0;
  }

  const averageHours =
    workingSummaries.reduce((sum, summary) => sum + summary.effectiveHours, 0) / workingSummaries.length;
  const averageDeviation =
    workingSummaries.reduce((sum, summary) => sum + Math.abs(summary.effectiveHours - averageHours), 0) /
    workingSummaries.length;
  const maxHours = Math.max(...workingSummaries.map((summary) => summary.effectiveHours));
  const minHours = Math.min(...workingSummaries.map((summary) => summary.effectiveHours));
  const closingCount = workingSummaries.reduce((sum, summary) => sum + summary.closingShifts, 0);
  const overtime = workingSummaries.reduce((sum, summary) => sum + summary.overtimeHours, 0);

  return clampScore(
    100 - averageDeviation * 7 - Math.max(0, maxHours - minHours - 4) * 4 - closingCount * 3 - overtime * 7,
  );
}

function buildIssues({
  employeeById,
  employeeSummaries,
  hourly,
  modifiers,
  scenario,
  shifts,
}: {
  employeeById: Map<string, Employee>;
  employeeSummaries: EmployeeRosterSummary[];
  hourly: HourlyEvaluation[];
  modifiers: RosterModifiers;
  scenario: RosterScenario;
  shifts: ShiftAssignment[];
}) {
  const issues: RosterIssue[] = [];
  const shortageGroups = groupHourlyGaps(hourly, (hour) => hour.shortage);

  shortageGroups.forEach((group, index) => {
    issues.push({
      id: `staff-gap-${index}`,
      severity: group.maxValue >= 2 ? "high" : "medium",
      title: `${formatHourRange(group.start, group.end)} 人手不足`,
      detail: `最高缺 ${group.maxValue} 人，峰值客流 ${group.maxTraffic}，预计排队会明显上升。`,
    });
  });

  (["lead", "cashier", "floor", "stock"] as const).forEach((role) => {
    const roleGroups = groupHourlyGaps(hourly, (hour) => hour.roleGaps[role]);

    roleGroups.forEach((group, index) => {
      issues.push({
        id: `${role}-gap-${index}`,
        severity: role === "lead" || role === "cashier" ? "high" : "medium",
        title: `${formatHourRange(group.start, group.end)} ${roleLongLabels[role]}缺口`,
        detail: `至少缺 ${group.maxValue} 个可胜任岗位，建议补熟手或调整现有班次。`,
      });
    });
  });

  const traineeSoloGroups = groupHourlyGaps(hourly, (hour) => {
    const activeTrainee = shifts.some((shift) => {
      const employee = employeeById.get(shift.employeeId);
      return employee?.isTrainee && shift.start <= hour.hour && hour.hour < shift.end;
    });

    return activeTrainee && hour.roleCoverage.lead === 0 ? 1 : 0;
  });

  traineeSoloGroups.forEach((group, index) => {
    issues.push({
      id: `trainee-solo-${index}`,
      severity: "high",
      title: `${formatHourRange(group.start, group.end)} 新人缺少带教`,
      detail: "新人同场没有值班负责人，遇到退换货或投诉时风险较高。",
    });
  });

  const surplusGroups = groupHourlyGaps(hourly, (hour) => Math.max(0, hour.surplus - 1));

  surplusGroups.forEach((group, index) => {
    issues.push({
      id: `surplus-${index}`,
      severity: "low",
      title: `${formatHourRange(group.start, group.end)} 人手略冗余`,
      detail: `最多多出 ${group.maxValue + 1} 人，可以考虑拆出补货或缩短低峰班次。`,
    });
  });

  employeeSummaries.forEach((summary) => {
    const employee = employeeById.get(summary.employeeId);

    if (!employee) {
      return;
    }

    if (summary.overtimeHours > 0) {
      issues.push({
        id: `overtime-${employee.id}`,
        severity: summary.overtimeHours >= 2 ? "high" : "medium",
        title: `${employee.name} 超出建议工时`,
        detail: `已排 ${summary.scheduledHours} 小时，超过上限 ${summary.overtimeHours} 小时。`,
      });
    }

    if (summary.outsideAvailability) {
      issues.push({
        id: `availability-${employee.id}`,
        severity: "medium",
        title: `${employee.name} 可上班时间冲突`,
        detail: `可上班时间是 ${formatClock(employee.availability.start)}-${formatClock(employee.availability.end)}。`,
      });
    }

    if (employee.avoidsClosing && summary.closingShifts > 0) {
      issues.push({
        id: `closing-${employee.id}`,
        severity: "low",
        title: `${employee.name} 被安排闭店`,
        detail: `${employee.preference}，这次可以接受，但连续安排会影响公平感。`,
      });
    }
  });

  if (modifiers.absentEmployeeId) {
    const employee = employeeById.get(modifiers.absentEmployeeId);

    if (employee) {
      issues.push({
        id: `absence-${employee.id}`,
        severity: "high",
        title: `${employee.name} 临时请假`,
        detail: "系统已把这位员工从有效覆盖和成本里移除，请检查是否需要补班。",
      });
    }
  }

  if (modifiers.extendedClose) {
    const finalHour = hourly.find((hour) => hour.hour === scenario.closeHour);

    if (finalHour && (finalHour.shortage > 0 || finalHour.roleCoverage.lead === 0)) {
      issues.push({
        id: "extended-close-gap",
        severity: "medium",
        title: "延长营业缺少闭店保障",
        detail: "延长的一小时需要负责人、收银和至少一名卖场人员同步覆盖。",
      });
    }
  }

  return issues.sort((left, right) => severityWeight[right.severity] - severityWeight[left.severity]);
}

function countRoleCoverage(
  shifts: ShiftAssignment[],
  employeeById: Map<string, Employee>,
): RequiredRoles {
  return shifts.reduce<RequiredRoles>((coverage, shift) => {
    const employee = employeeById.get(shift.employeeId);

    if (!employee) {
      return coverage;
    }

    employee.skills.forEach((skill) => {
      coverage[skill] += 1;
    });

    return coverage;
  }, { ...emptyRoles });
}

function getRoleGaps(requiredRoles: RequiredRoles, roleCoverage: RequiredRoles): RequiredRoles {
  return {
    lead: Math.max(0, requiredRoles.lead - roleCoverage.lead),
    cashier: Math.max(0, requiredRoles.cashier - roleCoverage.cashier),
    floor: Math.max(0, requiredRoles.floor - roleCoverage.floor),
    stock: Math.max(0, requiredRoles.stock - roleCoverage.stock),
    trainee: 0,
  };
}

function groupHourlyGaps(hourly: HourlyEvaluation[], getValue: (hour: HourlyEvaluation) => number) {
  const groups: Array<{ start: number; end: number; maxValue: number; maxTraffic: number }> = [];
  let current: { start: number; end: number; maxValue: number; maxTraffic: number } | undefined;

  hourly.forEach((hour) => {
    const value = getValue(hour);

    if (value <= 0) {
      if (current) {
        groups.push(current);
        current = undefined;
      }

      return;
    }

    if (!current) {
      current = {
        start: hour.hour,
        end: hour.hour + 1,
        maxValue: value,
        maxTraffic: hour.traffic,
      };
      return;
    }

    if (hour.hour === current.end) {
      current.end = hour.hour + 1;
      current.maxValue = Math.max(current.maxValue, value);
      current.maxTraffic = Math.max(current.maxTraffic, hour.traffic);
      return;
    }

    groups.push(current);
    current = {
      start: hour.hour,
      end: hour.hour + 1,
      maxValue: value,
      maxTraffic: hour.traffic,
    };
  });

  if (current) {
    groups.push(current);
  }

  return groups;
}

function getShiftHours(shift: ShiftAssignment) {
  return Math.max(0, shift.end - shift.start);
}

function sumRoles(roles: RequiredRoles) {
  return roles.lead + roles.cashier + roles.floor + roles.stock + roles.trainee;
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function formatHourRange(start: number, end: number) {
  return `${formatClock(start)}-${formatClock(end)}`;
}

function formatClock(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`;
}
