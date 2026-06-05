import { AlertTriangle, ArrowRight, BadgeCheck, ChevronDown, ChevronUp, Lightbulb, Map, RotateCcw, Trophy } from "lucide-react";
import { memo, useState } from "react";
import type { CustomerSession, DaySummary as DaySummaryType, Grade } from "../game/types";

interface DaySummaryProps {
  summary?: DaySummaryType;
  sessions?: CustomerSession[];
  passGrade?: Grade;
  passed?: boolean;
  hasNextDay?: boolean;
  onAdvance: () => void;
  onRetry: () => void;
  onBackToMap: () => void;
}

export const DaySummary = memo(function DaySummary({
  summary,
  sessions = [],
  passGrade,
  passed = false,
  hasNextDay = false,
  onAdvance,
  onRetry,
  onBackToMap,
}: DaySummaryProps) {
  const [expandedId, setExpandedId] = useState<string | undefined>(undefined);

  if (!summary) return null;

  return (
    <section className="summary-panel">
      <div className={`summary-grade ${passed ? "summary-grade-pass" : "summary-grade-fail"}`}>
        <Trophy size={22} aria-hidden="true" />
        <span>{summary.grade}</span>
      </div>
      <div>
        <p className="eyebrow">今日评级</p>
        <h2>{summary.title}</h2>
        <p className="summary-comment">{summary.supervisorComment}</p>
        {passGrade ? (
          <p className={`summary-verdict ${passed ? "summary-verdict-pass" : "summary-verdict-fail"}`}>
            {passed
              ? `达到过关线（${passGrade}），${hasNextDay ? "可以进入下一天。" : "你已完成转正考核！"}`
              : `未达过关线（需 ${passGrade}）。再试一次，调整出牌顺序。`}
          </p>
        ) : null}
      </div>

      <dl className="summary-metrics">
        <div><dt>最终满意度</dt><dd>{summary.totals.satisfaction}</dd></div>
        <div><dt>公司成本</dt><dd>{summary.totals.companyCost} 元</dd></div>
        <div><dt>合规风险</dt><dd>{summary.totals.complianceRisk}</dd></div>
        <div><dt>剩余时间</dt><dd>{summary.totals.timeLeft} 分</dd></div>
      </dl>

      <div className="outcome-list">
        {summary.outcomes.map((outcome) => {
          const session = sessions.find((s) => s.customer.id === outcome.customerId);
          const isExpanded = expandedId === outcome.customerId;
          return (
            <article key={outcome.customerId}>
              <div className="outcome-row">
                <strong>{outcome.customerName}</strong>
                <span>{getOutcomeLabel(outcome.status)}</span>
                {session ? (
                  <button
                    className="outcome-expand-btn"
                    type="button"
                    aria-expanded={isExpanded}
                    onClick={() => setExpandedId(isExpanded ? undefined : outcome.customerId)}
                  >
                    {isExpanded ? <ChevronUp size={13} aria-hidden="true" /> : <ChevronDown size={13} aria-hidden="true" />}
                    {isExpanded ? "收起" : "复盘"}
                  </button>
                ) : null}
              </div>
              {isExpanded && session ? (
                <div className="outcome-replay">
                  {session.messages
                    .filter((m) => m.speaker !== "system")
                    .map((m) => (
                      <div key={m.id} className={`replay-msg replay-msg-${m.speaker}`}>
                        <span className="replay-speaker">{m.speaker === "customer" ? outcome.customerName : "你"}</span>
                        <p>{m.text}</p>
                      </div>
                    ))}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      <div className="diagnostic-list">
        {summary.diagnostics.map((diagnostic) => {
          const Icon = getDiagnosticIcon(diagnostic.tone);
          return (
            <article className={`diagnostic-item diagnostic-${diagnostic.tone}`} key={diagnostic.id}>
              <span className="diagnostic-icon"><Icon size={17} aria-hidden="true" /></span>
              <span className="diagnostic-copy">
                <strong>{diagnostic.title}</strong>
                <small>{diagnostic.body}</small>
              </span>
            </article>
          );
        })}
      </div>

      <div className="summary-actions">
        {passed && hasNextDay ? (
          <button className="primary-button" type="button" onClick={onAdvance}>
            <ArrowRight size={17} aria-hidden="true" />
            进入下一天
          </button>
        ) : null}
        <button className="secondary-button" type="button" onClick={onRetry}>
          <RotateCcw size={17} aria-hidden="true" />
          {passed ? "再来一次" : "重试本天"}
        </button>
        <button className="secondary-button" type="button" onClick={onBackToMap}>
          <Map size={17} aria-hidden="true" />
          返回职业地图
        </button>
      </div>
    </section>
  );
});

function getOutcomeLabel(status: DaySummaryType["outcomes"][number]["status"]) {
  if (status === "resolved") return "已解决";
  if (status === "compliance_escalation") return "主管介入";
  if (status === "rage_quit") return "硬刚离席";
  return "投诉";
}

function getDiagnosticIcon(tone: DaySummaryType["diagnostics"][number]["tone"]) {
  if (tone === "good") return BadgeCheck;
  if (tone === "risk") return AlertTriangle;
  return Lightbulb;
}
