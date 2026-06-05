import {
  ArrowRight,
  BadgeCheck,
  Boxes,
  Briefcase,
  CirclePlay,
  Factory,
  Lock,
  MessageSquareText,
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
}

interface SimulatorCard {
  id: string;
  title: string;
  category: string;
  description: string;
  status: "live" | "soon";
  tone: "teal" | "red" | "amber" | "cyan";
  icon: LucideIcon;
  meta: string[];
}

const upcomingSimulators: SimulatorCard[] = [
  {
    id: "shift-roster",
    title: "门店排班模拟器",
    category: "零售运营",
    description: "客流高峰、库存缺口、临时请假同时压上桌面。",
    status: "soon",
    tone: "red",
    icon: Store,
    meta: ["客流峰值", "人员疲劳", "库存风险"],
  },
  {
    id: "factory-dispatch",
    title: "厂房调度模拟器",
    category: "生产现场",
    description: "订单、能耗、设备维护在同一条产线上互相挤压。",
    status: "soon",
    tone: "amber",
    icon: Factory,
    meta: ["产线节拍", "设备告警", "交付压力"],
  },
  {
    id: "clinic-triage",
    title: "诊室分诊模拟器",
    category: "公共服务",
    description: "把有限窗口留给最急的人，也要稳住等待区情绪。",
    status: "soon",
    tone: "cyan",
    icon: Stethoscope,
    meta: ["优先级", "等待情绪", "资源分配"],
  },
];

export function SimulatorHub({
  unlockedDays,
  totalDays,
  gradedDays,
  onLaunchSupport,
}: SimulatorHubProps) {
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

  const cards = [supportCard, ...upcomingSimulators];

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
            从客服席位开始，后面继续接入门店、厂房、诊室和更多离谱但真实的模拟现场。
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
              1 个可玩模块
            </span>
            <span>
              <Timer size={16} aria-hidden="true" />
              3 个扩展插槽
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
              onLaunch={card.id === "customer-support" ? onLaunchSupport : undefined}
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
