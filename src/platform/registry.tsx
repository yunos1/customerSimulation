import {
  Fish,
  MessageSquareText,
  MicVocal,
  Store,
  Stethoscope,
} from "lucide-react";
import type { ComponentType } from "react";
import type {
  SimulatorHostProps,
  SimulatorId,
  SimulatorManifest,
  SimulatorModule,
} from "./types";

/** Support career stats shown on the hub card (computed by shell). */
export type SupportHubStats = {
  unlockedDays: number;
  totalDays: number;
  gradedDays: number;
};

type LazySimulatorModule = {
  manifest: SimulatorManifest;
  /** Dynamic import of the entry component (code-split). */
  load: () => Promise<ComponentType<SimulatorHostProps>>;
};

function wrapBackOnly(
  load: () => Promise<ComponentType<{ onBackToHub: () => void }>>,
): () => Promise<ComponentType<SimulatorHostProps>> {
  return async () => {
    const Component = await load();
    return function BackOnlySimulator({ onBackToHub }: SimulatorHostProps) {
      return <Component onBackToHub={onBackToHub} />;
    };
  };
}

function wrapSlacker(
  load: () => Promise<ComponentType<{ user: SimulatorHostProps["user"]; onBackToHub: () => void }>>,
): () => Promise<ComponentType<SimulatorHostProps>> {
  return async () => {
    const Component = await load();
    return function SlackerHost({ user, onBackToHub }: SimulatorHostProps) {
      return <Component user={user} onBackToHub={onBackToHub} />;
    };
  };
}

const supportManifest: SimulatorManifest = {
  id: "support",
  title: "亲亲，这边不建议呢",
  category: "客服模拟器",
  description: "多路售后会话一起涌入，在满意度、成本、合规之间做取舍。",
  status: "live",
  tone: "teal",
  favicon: "favicons/customer-support.ico",
  hubOrder: 10,
  showInLibrary: true,
  hubPrimary: true,
  meta: ["多会话压力", "AI 客户", "生涯评级"],
  icon: MessageSquareText,
};

const shiftRosterManifest: SimulatorManifest = {
  id: "shiftRoster",
  title: "门店排班模拟器",
  category: "零售运营",
  description: "按客流、岗位、成本和公平度试算一天班表。",
  status: "live",
  tone: "red",
  favicon: "favicons/shift-roster.ico",
  hubOrder: 20,
  showInLibrary: true,
  meta: ["客流曲线", "岗位覆盖", "方案对比"],
  icon: Store,
};

const clinicTriageManifest: SimulatorManifest = {
  id: "clinicTriage",
  title: "诊室分诊模拟器",
  category: "公共服务",
  description: "在有限医生、诊室和检查窗口里识别真正高危的患者。",
  status: "live",
  tone: "cyan",
  favicon: "favicons/clinic-triage.ico",
  hubOrder: 30,
  showInLibrary: true,
  meta: ["优先级", "等待恶化", "资源槽位"],
  icon: Stethoscope,
};

const interviewManifest: SimulatorManifest = {
  id: "interview",
  title: "面试官游戏",
  category: "招聘判断",
  description: "在有限提问里识别候选人信号，做录用、待定或淘汰判断。",
  status: "live",
  tone: "violet",
  favicon: "favicons/interview-coach.ico",
  hubOrder: 40,
  showInLibrary: true,
  meta: ["3 个岗位", "9 位候选人", "延迟反馈"],
  icon: MicVocal,
};

const slackerManifest: SimulatorManifest = {
  id: "slacker",
  title: "摸鱼时刻",
  category: "在线游戏",
  description: "1000×1000 超大地图多人贪吃蛇，360°自由移动，边吃边卷。",
  status: "live",
  tone: "amber",
  favicon: "favicons/hub.ico",
  hubOrder: 50,
  showInLibrary: false,
  requiresAuth: true,
  meta: ["在线多人", "10 套皮肤", "全球排行榜"],
  icon: Fish,
};

export const simulatorModules: LazySimulatorModule[] = [
  {
    manifest: supportManifest,
    load: () =>
      import("../simulators/support/SupportSimulator").then((m) => m.SupportSimulator),
  },
  {
    manifest: shiftRosterManifest,
    load: wrapBackOnly(() =>
      import("../components/ShiftRosterSimulator").then((m) => m.ShiftRosterSimulator),
    ),
  },
  {
    manifest: clinicTriageManifest,
    load: wrapBackOnly(() =>
      import("../components/ClinicTriageSimulator").then((m) => m.ClinicTriageSimulator),
    ),
  },
  {
    manifest: interviewManifest,
    load: wrapBackOnly(() =>
      import("../components/InterviewSimulator").then((m) => m.InterviewSimulator),
    ),
  },
  {
    manifest: slackerManifest,
    load: wrapSlacker(() =>
      import("../components/SlackerMoment").then((m) => m.SlackerMoment),
    ),
  },
].sort((a, b) => a.manifest.hubOrder - b.manifest.hubOrder);

const moduleById = new Map(
  simulatorModules.map((mod) => [mod.manifest.id, mod] as const),
);

const loadCache = new Map<string, Promise<ComponentType<SimulatorHostProps>>>();

export function getSimulatorModule(id: Exclude<SimulatorId, "hub">): LazySimulatorModule | undefined {
  return moduleById.get(id);
}

/** Load (and cache) a simulator entry component. */
export function loadSimulatorComponent(
  id: Exclude<SimulatorId, "hub">,
): Promise<ComponentType<SimulatorHostProps>> | undefined {
  const mod = moduleById.get(id);
  if (!mod) return undefined;
  let pending = loadCache.get(id);
  if (!pending) {
    pending = mod.load();
    loadCache.set(id, pending);
  }
  return pending;
}

export function getLibraryModules(): LazySimulatorModule[] {
  return simulatorModules.filter((mod) => mod.manifest.showInLibrary);
}

export function getPrimarySimulator(): LazySimulatorModule | undefined {
  return simulatorModules.find((mod) => mod.manifest.hubPrimary);
}

export function getManifestFavicon(id: SimulatorId): string {
  if (id === "hub") {
    return "favicons/hub.ico";
  }
  return moduleById.get(id)?.manifest.favicon ?? "favicons/hub.ico";
}

/** Build hub meta chips; support injects live career progress. */
export function getHubCardMeta(
  manifest: SimulatorManifest,
  supportStats?: SupportHubStats,
): string[] {
  if (manifest.id === "support" && supportStats) {
    return [
      `${supportStats.unlockedDays}/${supportStats.totalDays} 天解锁`,
      `${supportStats.gradedDays} 天有评级`,
      "多会话压力",
    ];
  }
  return manifest.meta;
}

export type { SimulatorHostProps, SimulatorId, SimulatorManifest, SimulatorModule };
