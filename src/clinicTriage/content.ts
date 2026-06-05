import type {
  ClinicResourceId,
  ClinicScenario,
  ClinicScenarioId,
  PatientCase,
  TriageLevel,
} from "./types";

export const triageLevelLabels: Record<TriageLevel, string> = {
  immediate: "立即处理",
  urgent: "15分钟内",
  soon: "尽快就诊",
  routine: "可等待",
  redirect: "转普通咨询",
};

export const triageLevelShortLabels: Record<TriageLevel, string> = {
  immediate: "立即",
  urgent: "急",
  soon: "快",
  routine: "等",
  redirect: "转",
};

export const triageLevelDescriptions: Record<TriageLevel, string> = {
  immediate: "生命体征或症状提示高危，立刻占用抢救或医生资源。",
  urgent: "短时间内可能恶化，需要提前插队处理。",
  soon: "需要尽快安排，但可短暂等待。",
  routine: "风险较低，按队列等待即可。",
  redirect: "适合普通咨询、导诊或非急诊路径。",
};

export const clinicResourceLabels: Record<ClinicResourceId, string> = {
  resus: "抢救间",
  doctor: "医生诊室",
  nurse: "护士处置",
  lab: "检查窗口",
};

export const clinicPatients: PatientCase[] = [
  {
    id: "p-chest",
    name: "赵建国",
    initials: "赵",
    age: "67岁",
    arrivalMinute: 0,
    chiefComplaint: "胸闷伴出汗",
    visibleSummary: "自述胃不舒服，脸色发白，说话断续。",
    vitals: { heartRate: 118, systolicBp: 92, temperature: 36.8, spo2: 91, pain: 7 },
    emotion: "quiet",
    redFlags: ["胸闷", "出汗", "血压偏低", "血氧偏低"],
    hiddenRisk: "疑似急性冠脉综合征，不能按普通胃痛等待。",
    recommendedLevel: "immediate",
    bestResource: "resus",
    deteriorationMinute: 8,
    outcome: "快速进入抢救间后完成心电图，避免延误高危胸痛。",
  },
  {
    id: "p-fever-child",
    name: "安安",
    initials: "安",
    age: "3岁",
    arrivalMinute: 3,
    chiefComplaint: "高热抽搐后",
    visibleSummary: "家长焦虑，孩子现在安静但反应慢。",
    vitals: { heartRate: 142, systolicBp: 86, temperature: 40.1, spo2: 95, pain: 4 },
    emotion: "anxious",
    redFlags: ["儿童高热", "抽搐后", "反应慢"],
    hiddenRisk: "抽搐后嗜睡需要尽快评估，不能只看当前不哭闹。",
    recommendedLevel: "urgent",
    bestResource: "doctor",
    deteriorationMinute: 14,
    outcome: "及时处理后完成退热和神经状态评估，家属情绪下降。",
  },
  {
    id: "p-ankle",
    name: "李薇",
    initials: "李",
    age: "28岁",
    arrivalMinute: 5,
    chiefComplaint: "脚踝扭伤",
    visibleSummary: "疼痛明显，能扶墙行走，要求马上拍片。",
    vitals: { heartRate: 90, systolicBp: 118, temperature: 36.6, spo2: 99, pain: 6 },
    emotion: "angry",
    redFlags: ["局部肿胀", "疼痛"],
    hiddenRisk: "疼痛强烈但生命体征稳定，适合止痛、冰敷后等待检查。",
    recommendedLevel: "routine",
    bestResource: "nurse",
    deteriorationMinute: 45,
    outcome: "护士先止痛固定，等待拍片期间满意度可控。",
  },
  {
    id: "p-dizzy",
    name: "孙敏",
    initials: "孙",
    age: "54岁",
    arrivalMinute: 9,
    chiefComplaint: "头晕手麻",
    visibleSummary: "说话略含糊，自己觉得只是没吃早饭。",
    vitals: { heartRate: 102, systolicBp: 168, temperature: 36.7, spo2: 97, pain: 2 },
    emotion: "calm",
    redFlags: ["言语含糊", "单侧手麻", "血压高"],
    hiddenRisk: "疑似卒中早期表现，平静不代表低危。",
    recommendedLevel: "immediate",
    bestResource: "doctor",
    deteriorationMinute: 10,
    outcome: "快速进入医生诊室后触发卒中流程，争取治疗时间窗。",
  },
  {
    id: "p-cough",
    name: "吴可",
    initials: "吴",
    age: "31岁",
    arrivalMinute: 12,
    chiefComplaint: "咳嗽发热",
    visibleSummary: "发热两天，咽痛，精神尚可。",
    vitals: { heartRate: 96, systolicBp: 116, temperature: 38.5, spo2: 98, pain: 3 },
    emotion: "calm",
    redFlags: ["发热", "咳嗽"],
    hiddenRisk: "流感样症状，适合发热门诊或检查窗口分流。",
    recommendedLevel: "redirect",
    bestResource: "lab",
    deteriorationMinute: 60,
    outcome: "分流到检查窗口后减少普通诊室拥堵。",
  },
  {
    id: "p-breath",
    name: "秦岚",
    initials: "秦",
    age: "42岁",
    arrivalMinute: 16,
    chiefComplaint: "喘不上气",
    visibleSummary: "坐位呼吸，讲话只能说短句。",
    vitals: { heartRate: 124, systolicBp: 108, temperature: 37.4, spo2: 88, pain: 5 },
    emotion: "anxious",
    redFlags: ["呼吸困难", "血氧低", "短句讲话"],
    hiddenRisk: "低氧提示急性呼吸问题，需要立即氧疗和医生评估。",
    recommendedLevel: "immediate",
    bestResource: "resus",
    deteriorationMinute: 6,
    outcome: "快速给氧并进入抢救间后，血氧逐步回升。",
  },
  {
    id: "p-abdomen",
    name: "唐卓",
    initials: "唐",
    age: "36岁",
    arrivalMinute: 20,
    chiefComplaint: "腹痛呕吐",
    visibleSummary: "右下腹痛，走路弯腰，拒绝按压。",
    vitals: { heartRate: 105, systolicBp: 110, temperature: 38.2, spo2: 98, pain: 8 },
    emotion: "anxious",
    redFlags: ["右下腹痛", "发热", "疼痛重"],
    hiddenRisk: "疑似急腹症，需要尽快医生评估，不能长时间排队。",
    recommendedLevel: "urgent",
    bestResource: "doctor",
    deteriorationMinute: 18,
    outcome: "尽快评估后安排检查，避免腹痛患者在候诊区恶化。",
  },
  {
    id: "p-prescription",
    name: "何青",
    initials: "何",
    age: "45岁",
    arrivalMinute: 24,
    chiefComplaint: "续方咨询",
    visibleSummary: "慢病用药快吃完，想问能否开药。",
    vitals: { heartRate: 78, systolicBp: 126, temperature: 36.5, spo2: 99, pain: 0 },
    emotion: "calm",
    redFlags: ["无急性症状"],
    hiddenRisk: "适合普通咨询或慢病门诊，不应占用急诊资源。",
    recommendedLevel: "redirect",
    bestResource: "nurse",
    deteriorationMinute: 90,
    outcome: "导诊到慢病续方路径，急诊资源保留给高危患者。",
  },
];

export const clinicScenarios: ClinicScenario[] = [
  {
    id: "morning",
    title: "普通门诊上午高峰",
    shortLabel: "上午高峰",
    description: "患者陆续到达，低危诉求和真正高危信号混在一起。",
    durationMinutes: 55,
    resources: { resus: 1, doctor: 2, nurse: 1, lab: 1 },
    patientIds: ["p-chest", "p-ankle", "p-dizzy", "p-cough", "p-abdomen", "p-prescription"],
  },
  {
    id: "pediatricNight",
    title: "儿科夜间急诊",
    shortLabel: "儿科夜间",
    description: "家属情绪更高，儿童症状变化快，需要兼顾安抚和安全。",
    durationMinutes: 45,
    resources: { resus: 1, doctor: 1, nurse: 1, lab: 1 },
    patientIds: ["p-fever-child", "p-cough", "p-breath", "p-ankle", "p-prescription"],
  },
  {
    id: "fluSeason",
    title: "流感季发热门诊",
    shortLabel: "流感季",
    description: "大量发热咳嗽会挤占判断空间，真正低氧和胸痛不能被淹没。",
    durationMinutes: 60,
    resources: { resus: 1, doctor: 2, nurse: 1, lab: 2 },
    patientIds: ["p-cough", "p-fever-child", "p-chest", "p-breath", "p-abdomen", "p-prescription"],
  },
];

export function getClinicScenario(scenarioId: ClinicScenarioId) {
  return clinicScenarios.find((scenario) => scenario.id === scenarioId) ?? clinicScenarios[0];
}

export function getScenarioPatients(scenarioId: ClinicScenarioId) {
  const scenario = getClinicScenario(scenarioId);
  const byId = new Map(clinicPatients.map((patient) => [patient.id, patient]));

  return scenario.patientIds
    .map((patientId) => byId.get(patientId))
    .filter((patient): patient is PatientCase => Boolean(patient));
}
