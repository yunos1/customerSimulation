import {
  ArrowRight,
  BadgeCheck,
  Boxes,
  Briefcase,
  CirclePlay,
  Factory,
  Lock,
  MessageSquareText,
  MicVocal,
  Sparkles,
  Store,
  Stethoscope,
  Timer,
  Trophy,
  Zap,
  type LucideIcon,
} from "lucide-react";
import simulatorBoxHero from "../assets/simulator-box-hero.png";

interface SimulatorHubProps {
  unlockedDays: number;
  totalDays: number;
  gradedDays: number;
  onLaunchSupport: () => void;
  onLaunchInterview: () => void;
  onLaunchShiftRoster: () => void;
  onLaunchClinicTriage: () => void;
}

interface SimulatorCard {
  id: string;
  title: string;
  category: string;
  description: string;
  status: "live" | "soon";
  tone: "teal" | "red" | "amber" | "cyan" | "violet";
  icon: LucideIcon;
  meta: string[];
}

const upcomingSimulators: SimulatorCard[] = [
  {
    id: "factory-dispatch",
    title: "厂房调度模拟器",
    category: "生产调度",
    description: "设备产能、交期压力和临时插单一起挤进排产板。",
    status: "soon",
    tone: "amber",
    icon: Factory,
    meta: ["产能瓶颈", "交期风险", "插单冲突"],
  },
];

export function SimulatorHub({
  unlockedDays,
  totalDays,
  gradedDays,
  onLaunchSupport,
  onLaunchInterview,
  onLaunchShiftRoster,
  onLaunchClinicTriage,
}: SimulatorHubProps) {
  const shiftRosterCard: SimulatorCard = {
    id: "shift-roster",
    title: "门店排班模拟器",
    category: "零售运营",
    description: "按客流、岗位、成本和公平度试算一天班表。",
    status: "live",
    tone: "red",
    icon: Store,
    meta: ["客流曲线", "岗位覆盖", "方案对比"],
  };

  const supportCard: SimulatorCard = {
    id: "customer-support",
    title: "亲亲，这边不建议呢",
    category: "客服模拟器",
    description: "多路售后会话一起涌入，在满意度、成本、合规之间做取舍。",
    status: "live",
    tone: "teal",
    icon: MessageSquareText,
    meta: [`${unlockedDays}/${totalDays} 天解锁`, `${gradedDays} 天有评级`, "多会话压力"],
  };

  const interviewCard: SimulatorCard = {
    id: "interview-coach",
    title: "面试官游戏",
    category: "招聘判断",
    description: "在有限提问里识别候选人信号，做录用、待定或淘汰判断。",
    status: "live",
    tone: "violet",
    icon: MicVocal,
    meta: ["3 个岗位", "9 位候选人", "延迟反馈"],
  };

  const clinicTriageCard: SimulatorCard = {
    id: "clinic-triage",
    title: "诊室分诊模拟器",
    category: "公共服务",
    description: "在有限医生、诊室和检查窗口里识别真正高危的患者。",
    status: "live",
    tone: "cyan",
    icon: Stethoscope,
    meta: ["优先级", "等待恶化", "资源槽位"],
  };

  const cards = [
    supportCard,
    shiftRosterCard,
    clinicTriageCard,
    interviewCard,
    ...upcomingSimulators.filter((card) => card.id !== "shift-roster" && card.id !== "clinic-triage"),
  ];
  const liveModuleCount = cards.filter((card) => card.status === "live").length;
  const upcomingModuleCount = cards.filter((card) => card.status === "soon").length;

  return (
    <main className="hub-shell">
      <section className="hub-hero" aria-labelledby="hub-title">
        <div className="hub-hero-media" aria-hidden="true">
          <img src={simulatorBoxHero} alt="" />
        </div>
        <div className="hub-hero-copy">
          <p className="hub-kicker">
            <Boxes size={18} aria-hidden="true" />
            模拟器盒子
          </p>
          <h1 id="hub-title">把一整排人生压力插进同一个盒子</h1>
          <p className="hub-hero-lede">
            从客服席位启程，穿过门店、诊室与面试间的灯火；厂房的轰鸣在下一格等待亮起。
          </p>

          <div className="hub-actions">
            <button className="hub-primary-action" type="button" onClick={onLaunchSupport}>
              <CirclePlay size={20} aria-hidden="true" />
              启动客服模拟器
            </button>
            <a className="hub-secondary-action" href="#simulator-library">
              <Sparkles size={18} aria-hidden="true" />
              浏览插槽
            </a>
          </div>

          <div className="hub-readouts" aria-label="盒子状态">
            <span>
              <Zap size={16} aria-hidden="true" />
              {liveModuleCount} 个可玩模块
            </span>
            <span>
              <Timer size={16} aria-hidden="true" />
              {upcomingModuleCount} 个扩展插槽
            </span>
            <span>
              <Trophy size={16} aria-hidden="true" />
              生涯 {unlockedDays}/{totalDays}
            </span>
          </div>
        </div>
      </section>

      <section className="hub-library" id="simulator-library" aria-label="模拟器库">
        <div className="hub-library-heading">
          <p className="hub-kicker">
            <BadgeCheck size={17} aria-hidden="true" />
            Module Bay
          </p>
          <h2>选择一个模拟现场</h2>
        </div>

        <div className="simulator-grid">
          {cards.map((card) => (
            <SimulatorModuleCard
              card={card}
              key={card.id}
              onLaunch={
                card.id === "customer-support"
                  ? onLaunchSupport
                  : card.id === "interview-coach"
                    ? onLaunchInterview
                    : card.id === "shift-roster"
                      ? onLaunchShiftRoster
                      : card.id === "clinic-triage"
                        ? onLaunchClinicTriage
                        : undefined
              }
            />
          ))}
        </div>
      </section>
    </main>
  );
}

function SimulatorModuleCard({
  card,
  onLaunch,
}: {
  card: SimulatorCard;
  onLaunch?: () => void;
}) {
  const Icon = card.icon;
  const isLive = card.status === "live";

  return (
    <article className={`simulator-card simulator-card-${card.status} simulator-card-${card.tone}`}>
      <div className="simulator-card-topline">
        <span className="simulator-card-icon">
          <Icon size={24} aria-hidden="true" />
        </span>
        <span className="simulator-status">
          {isLive ? <BadgeCheck size={15} aria-hidden="true" /> : <Lock size={14} aria-hidden="true" />}
          {isLive ? "可启动" : "研发中"}
        </span>
      </div>

      <div className="simulator-card-copy">
        <p>{card.category}</p>
        <h3>{card.title}</h3>
        <span>{card.description}</span>
      </div>

      <div className="simulator-module-rail" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </div>

      <div className="simulator-meta-row">
        {card.meta.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>

      {isLive ? (
        <button className="simulator-card-button" type="button" onClick={onLaunch}>
          进入
          <ArrowRight size={17} aria-hidden="true" />
        </button>
      ) : (
        <button className="simulator-card-button simulator-card-button-disabled" type="button" disabled>
          待开放
          <Briefcase size={16} aria-hidden="true" />
        </button>
      )}
    </article>
  );
}
