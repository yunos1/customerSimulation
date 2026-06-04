import { AlertTriangle, BadgeCheck, Clock, Coins, Flame } from "lucide-react";
import type { GamePhase, Metrics } from "../game/types";

interface MetricsBarProps {
  metrics: Metrics;
  phase: GamePhase;
}

const metricItems = [
  {
    key: "satisfaction",
    label: "满意度",
    icon: BadgeCheck,
    tone: "positive",
  },
  {
    key: "anger",
    label: "怒气",
    icon: Flame,
    tone: "danger",
  },
  {
    key: "companyCost",
    label: "成本",
    icon: Coins,
    tone: "cost",
  },
  {
    key: "complianceRisk",
    label: "合规风险",
    icon: AlertTriangle,
    tone: "warning",
  },
  {
    key: "timeLeft",
    label: "剩余时间",
    icon: Clock,
    tone: "time",
  },
] as const;

export function MetricsBar({ metrics, phase }: MetricsBarProps) {
  return (
    <section className="metrics-bar" aria-label="今日指标">
      {metricItems.map((item) => {
        const Icon = item.icon;
        const value = metrics[item.key];
        const suffix = item.key === "companyCost" ? "元" : item.key === "timeLeft" ? "分" : "";

        return (
          <div className={`metric metric-${item.tone}`} key={item.key}>
            <div className="metric-heading">
              <Icon size={18} aria-hidden="true" />
              <span>{item.label}</span>
            </div>
            <strong>
              {value}
              {suffix}
            </strong>
            <div className="meter" aria-hidden="true">
              <span style={{ width: `${getMeterWidth(item.key, value)}%` }} />
            </div>
          </div>
        );
      })}
      <div className="metric phase-indicator">
        <span>当前阶段</span>
        <strong>{getPhaseLabel(phase)}</strong>
      </div>
    </section>
  );
}

function getMeterWidth(key: keyof Metrics, value: number) {
  if (key === "companyCost") {
    return Math.min(100, Math.round((value / 120) * 100));
  }

  if (key === "timeLeft") {
    return Math.min(100, Math.round((value / 100) * 100));
  }

  return value;
}

function getPhaseLabel(phase: GamePhase) {
  switch (phase) {
    case "intro":
      return "等待上线";
    case "player_reply":
      return "选择回复";
    case "summary":
      return "今日结算";
  }
}
