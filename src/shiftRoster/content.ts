import type {
  Employee,
  PlanPreset,
  PlanPresetId,
  RoleId,
  RosterScenario,
  RosterScenarioId,
  ShiftAssignment,
} from "./types";

export const roleLabels: Record<RoleId, string> = {
  lead: "值班",
  cashier: "收银",
  floor: "导购",
  stock: "补货",
  trainee: "新人",
};

export const roleLongLabels: Record<RoleId, string> = {
  lead: "值班负责人",
  cashier: "收银结算",
  floor: "卖场导购",
  stock: "补货陈列",
  trainee: "新人陪练",
};

export const employees: Employee[] = [
  {
    id: "lin",
    name: "林夏",
    initials: "林",
    title: "店长",
    skills: ["lead", "cashier", "floor", "stock"],
    hourlyWage: 95,
    maxHours: 10,
    availability: { start: 8, end: 22 },
    preference: "适合开店和高峰控场",
  },
  {
    id: "jiang",
    name: "姜禾",
    initials: "姜",
    title: "店助",
    skills: ["lead", "cashier", "floor"],
    hourlyWage: 75,
    maxHours: 9,
    availability: { start: 12, end: 23 },
    preference: "晚高峰稳定，但不宜连续闭店",
    avoidsClosing: true,
  },
  {
    id: "zhou",
    name: "周航",
    initials: "周",
    title: "资深收银",
    skills: ["cashier", "floor"],
    hourlyWage: 60,
    maxHours: 8,
    availability: { start: 9, end: 21 },
    preference: "午餐高峰结账速度快",
  },
  {
    id: "chen",
    name: "陈鹿",
    initials: "陈",
    title: "导购",
    skills: ["floor", "cashier"],
    hourlyWage: 58,
    maxHours: 8,
    availability: { start: 10, end: 22 },
    preference: "适合新品介绍和客诉安抚",
  },
  {
    id: "wang",
    name: "王宁",
    initials: "王",
    title: "仓储",
    skills: ["stock", "floor"],
    hourlyWage: 55,
    maxHours: 8,
    availability: { start: 8, end: 18 },
    preference: "开店补货和午后库存复核",
  },
  {
    id: "xu",
    name: "许然",
    initials: "许",
    title: "新人",
    skills: ["trainee", "floor", "stock"],
    hourlyWage: 42,
    maxHours: 6,
    availability: { start: 11, end: 21 },
    preference: "需要老员工同场带教",
    isTrainee: true,
  },
  {
    id: "tang",
    name: "唐一",
    initials: "唐",
    title: "兼职",
    skills: ["cashier", "floor"],
    hourlyWage: 48,
    maxHours: 5,
    availability: { start: 16, end: 23 },
    preference: "晚间补位灵活",
  },
];

export const rosterScenarios: RosterScenario[] = [
  {
    id: "weekday",
    title: "普通工作日",
    shortLabel: "工作日",
    description: "客流稳定，午餐和晚饭前后各有一段小高峰。",
    openHour: 9,
    closeHour: 22,
    targetBudget: 3600,
    extensionTraffic: 22,
    baseTraffic: [
      { hour: 9, traffic: 18, note: "开店整理" },
      { hour: 10, traffic: 24 },
      { hour: 11, traffic: 31 },
      { hour: 12, traffic: 42, note: "午间上升" },
      { hour: 13, traffic: 56 },
      { hour: 14, traffic: 48 },
      { hour: 15, traffic: 35 },
      { hour: 16, traffic: 29 },
      { hour: 17, traffic: 33 },
      { hour: 18, traffic: 46 },
      { hour: 19, traffic: 62, note: "晚高峰" },
      { hour: 20, traffic: 51 },
      { hour: 21, traffic: 28, note: "闭店前" },
    ],
  },
  {
    id: "promo",
    title: "周五会员日",
    shortLabel: "会员日",
    description: "午后开始放量，晚高峰会同时压住收银、导购和补货。",
    openHour: 9,
    closeHour: 22,
    targetBudget: 4200,
    extensionTraffic: 38,
    baseTraffic: [
      { hour: 9, traffic: 24 },
      { hour: 10, traffic: 32 },
      { hour: 11, traffic: 48 },
      { hour: 12, traffic: 66, note: "领券入场" },
      { hour: 13, traffic: 88 },
      { hour: 14, traffic: 74 },
      { hour: 15, traffic: 56 },
      { hour: 16, traffic: 50 },
      { hour: 17, traffic: 64 },
      { hour: 18, traffic: 82 },
      { hour: 19, traffic: 96, note: "晚间峰值" },
      { hour: 20, traffic: 84 },
      { hour: 21, traffic: 44 },
    ],
  },
  {
    id: "storm",
    title: "暴雨配送延误",
    shortLabel: "暴雨日",
    description: "进店客流略低，但补货、退换货和临时缺勤风险更高。",
    openHour: 9,
    closeHour: 22,
    targetBudget: 3850,
    extensionTraffic: 26,
    baseTraffic: [
      { hour: 9, traffic: 16, note: "开店偏慢" },
      { hour: 10, traffic: 20 },
      { hour: 11, traffic: 28 },
      { hour: 12, traffic: 38 },
      { hour: 13, traffic: 46 },
      { hour: 14, traffic: 42 },
      { hour: 15, traffic: 34, note: "配送到店" },
      { hour: 16, traffic: 36 },
      { hour: 17, traffic: 44 },
      { hour: 18, traffic: 52 },
      { hour: 19, traffic: 68, note: "退换货集中" },
      { hour: 20, traffic: 60 },
      { hour: 21, traffic: 32 },
    ],
  },
];

export const planPresets: PlanPreset[] = [
  {
    id: "balanced",
    title: "均衡班表",
    intent: "覆盖日常高峰，成本留一点余量。",
    shifts: [
      shift("balanced-lin", "lin", "lead", 9, 18),
      shift("balanced-zhou", "zhou", "cashier", 9, 17),
      shift("balanced-chen", "chen", "floor", 11, 20),
      shift("balanced-wang", "wang", "stock", 8, 16),
      shift("balanced-xu", "xu", "trainee", 12, 18),
      shift("balanced-tang", "tang", "cashier", 17, 22),
      shift("balanced-jiang", "jiang", "floor", 14, 22),
    ],
  },
  {
    id: "lean",
    title: "成本最低",
    intent: "压低工时，适合低客流试算。",
    shifts: [
      shift("lean-lin", "lin", "lead", 9, 17),
      shift("lean-zhou", "zhou", "cashier", 10, 18),
      shift("lean-chen", "chen", "floor", 12, 20),
      shift("lean-wang", "wang", "stock", 9, 15),
      shift("lean-tang", "tang", "cashier", 18, 22),
    ],
  },
  {
    id: "service",
    title: "服务最稳",
    intent: "高峰加厚人手，减少排队和岗位缺口。",
    shifts: [
      shift("service-lin", "lin", "lead", 9, 19),
      shift("service-zhou", "zhou", "cashier", 9, 17),
      shift("service-chen", "chen", "floor", 10, 19),
      shift("service-wang", "wang", "stock", 8, 16),
      shift("service-xu", "xu", "trainee", 12, 18),
      shift("service-tang", "tang", "cashier", 16, 22),
      shift("service-jiang", "jiang", "floor", 13, 22),
    ],
  },
  {
    id: "training",
    title: "新人训练",
    intent: "保证新人同场带教，同时保住基础覆盖。",
    shifts: [
      shift("training-lin", "lin", "lead", 9, 17),
      shift("training-zhou", "zhou", "cashier", 9, 16),
      shift("training-chen", "chen", "floor", 11, 20),
      shift("training-wang", "wang", "stock", 8, 15),
      shift("training-xu", "xu", "trainee", 11, 19),
      shift("training-tang", "tang", "cashier", 17, 22),
      shift("training-jiang", "jiang", "lead", 13, 21),
    ],
  },
];

export function getScenario(scenarioId: RosterScenarioId) {
  return rosterScenarios.find((scenario) => scenario.id === scenarioId) ?? rosterScenarios[0];
}

export function getPlanPreset(planId: PlanPresetId) {
  return planPresets.find((plan) => plan.id === planId) ?? planPresets[0];
}

export function clonePresetShifts(planId: PlanPresetId) {
  return getPlanPreset(planId).shifts.map((item) => ({ ...item }));
}

function shift(
  id: string,
  employeeId: string,
  role: RoleId,
  start: number,
  end: number,
): ShiftAssignment {
  return { id, employeeId, role, start, end };
}
