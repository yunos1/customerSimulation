export type RoleId = "lead" | "cashier" | "floor" | "stock" | "trainee";

export type PlanPresetId = "balanced" | "lean" | "service" | "training";

export type RosterScenarioId = "weekday" | "promo" | "storm";

export interface Employee {
  id: string;
  name: string;
  initials: string;
  title: string;
  skills: RoleId[];
  hourlyWage: number;
  maxHours: number;
  availability: {
    start: number;
    end: number;
  };
  preference: string;
  avoidsClosing?: boolean;
  isTrainee?: boolean;
}

export interface ShiftAssignment {
  id: string;
  employeeId: string;
  role: RoleId;
  start: number;
  end: number;
}

export interface DemandPoint {
  hour: number;
  traffic: number;
  note?: string;
}

export interface RosterScenario {
  id: RosterScenarioId;
  title: string;
  shortLabel: string;
  description: string;
  openHour: number;
  closeHour: number;
  targetBudget: number;
  baseTraffic: DemandPoint[];
  extensionTraffic: number;
}

export interface PlanPreset {
  id: PlanPresetId;
  title: string;
  intent: string;
  shifts: ShiftAssignment[];
}

export interface RosterModifiers {
  trafficLift: number;
  absentEmployeeId?: string;
  extendedClose: boolean;
}

export interface RequiredRoles {
  lead: number;
  cashier: number;
  floor: number;
  stock: number;
  trainee: number;
}

export interface HourlyEvaluation {
  hour: number;
  traffic: number;
  requiredStaff: number;
  staffCount: number;
  surplus: number;
  shortage: number;
  requiredRoles: RequiredRoles;
  roleCoverage: RequiredRoles;
  roleGaps: RequiredRoles;
  state: "good" | "tight" | "gap" | "surplus";
  note?: string;
}

export interface EmployeeRosterSummary {
  employeeId: string;
  scheduledHours: number;
  effectiveHours: number;
  closingShifts: number;
  outsideAvailability: boolean;
  overtimeHours: number;
}

export interface RosterIssue {
  id: string;
  severity: "high" | "medium" | "low";
  title: string;
  detail: string;
}

export interface RosterMetrics {
  totalScore: number;
  serviceScore: number;
  costScore: number;
  fairnessScore: number;
  stabilityScore: number;
  scheduledCost: number;
  uncoveredHours: number;
  surplusHours: number;
  expectedQueueMinutes: number;
}

export interface RosterEvaluation {
  hourly: HourlyEvaluation[];
  employeeSummaries: EmployeeRosterSummary[];
  issues: RosterIssue[];
  metrics: RosterMetrics;
}
