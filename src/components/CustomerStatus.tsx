import { ClipboardList, TimerReset } from "lucide-react";
import { memo } from "react";
import { CustomerAvatar } from "./Avatar";
import type { Customer, CustomerOutcome, CustomerSession } from "../game/types";

interface CustomerStatusProps {
  customer?: Customer;
  session?: CustomerSession;
}

export const CustomerStatus = memo(function CustomerStatus({ customer, session }: CustomerStatusProps) {
  if (!customer || !session) {
    return (
      <section className="panel compact-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">客户状态</p>
            <h2>无接入会话</h2>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="panel compact-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">客户状态</p>
          <h2>{customer.handle}</h2>
        </div>
        <CustomerAvatar customer={customer} size="lg" />
      </div>

      <dl className="status-grid">
        <div>
          <dt>满意度</dt>
          <dd>{session.metrics.satisfaction}</dd>
        </div>
        <div>
          <dt>怒气</dt>
          <dd>{session.metrics.anger}</dd>
        </div>
        <div>
          <dt>耐心</dt>
          <dd>{customer.patience}</dd>
        </div>
        <div>
          <dt>会话时间</dt>
          <dd className={session.elapsedSeconds >= 120 && session.status === "active" ? "urgent-text" : ""}>
            {formatDuration(session.elapsedSeconds)}
          </dd>
        </div>
      </dl>

      <div
        className={`timeout-strip timeout-${session.status} ${
          session.status === "active" && session.elapsedSeconds >= 120 ? "timeout-urgent" : ""
        }`}
      >
        <TimerReset size={16} aria-hidden="true" />
        <span>{getSessionLine(session)}</span>
      </div>

      <div className="notes-block">
        <div className="notes-heading">
          <ClipboardList size={16} aria-hidden="true" />
          <span>接待提示</span>
        </div>
        <ul>
          {customer.profileNotes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </div>

      {session.outcome ? (
        <div className={`outcome-pill outcome-${session.outcome.status}`}>
          {getOutcomeLabel(session.outcome.status)}
        </div>
      ) : null}
    </section>
  );
});

function getSessionLine(session: CustomerSession) {
  if (session.status === "resolved") {
    return "会话已解决，可以切换其他客户。";
  }

  if (session.status === "failed") {
    return getFailedSessionLine(session.outcome?.status);
  }

  if (session.elapsedSeconds >= 120) {
    return `红色提醒：客户已等待 ${formatDuration(session.elapsedSeconds)}。`;
  }

  return `会话已进行 ${formatDuration(session.elapsedSeconds)}。`;
}

function getFailedSessionLine(status?: CustomerOutcome["status"]) {
  if (status === "compliance_escalation") {
    return "主管已介入，会话结束。";
  }

  if (status === "rage_quit") {
    return "硬刚离席，会话结束。";
  }

  return "客户已提交投诉，会话结束。";
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function getOutcomeLabel(status: CustomerOutcome["status"]) {
  if (status === "resolved") {
    return "已稳住";
  }

  if (status === "compliance_escalation") {
    return "主管介入";
  }

  if (status === "rage_quit") {
    return "硬刚离席";
  }

  return "客户投诉";
}
