import { RotateCcw, Trophy } from "lucide-react";
import type { DaySummary as DaySummaryType } from "../game/types";

interface DaySummaryProps {
  summary?: DaySummaryType;
  onRestart: () => void;
}

export function DaySummary({ summary, onRestart }: DaySummaryProps) {
  if (!summary) {
    return null;
  }

  return (
    <section className="summary-panel">
      <div className="summary-grade">
        <Trophy size={22} aria-hidden="true" />
        <span>{summary.grade}</span>
      </div>
      <div>
        <p className="eyebrow">今日评级</p>
        <h2>{summary.title}</h2>
        <p className="summary-comment">{summary.supervisorComment}</p>
      </div>

      <dl className="summary-metrics">
        <div>
          <dt>最终满意度</dt>
          <dd>{summary.totals.satisfaction}</dd>
        </div>
        <div>
          <dt>公司成本</dt>
          <dd>{summary.totals.companyCost} 元</dd>
        </div>
        <div>
          <dt>合规风险</dt>
          <dd>{summary.totals.complianceRisk}</dd>
        </div>
        <div>
          <dt>剩余时间</dt>
          <dd>{summary.totals.timeLeft} 分</dd>
        </div>
      </dl>

      <div className="outcome-list">
        {summary.outcomes.map((outcome) => (
          <article key={outcome.customerId}>
            <strong>{outcome.customerName}</strong>
            <span>{getOutcomeLabel(outcome.status)}</span>
          </article>
        ))}
      </div>

      <button className="primary-button" type="button" onClick={onRestart}>
        <RotateCcw size={17} aria-hidden="true" />
        重新值班
      </button>
    </section>
  );
}

function getOutcomeLabel(status: DaySummaryType["outcomes"][number]["status"]) {
  if (status === "resolved") {
    return "已解决";
  }

  if (status === "compliance_escalation") {
    return "主管介入";
  }

  if (status === "rage_quit") {
    return "硬刚离席";
  }

  return "投诉";
}
