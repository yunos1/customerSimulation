import { ClipboardList, UserRound } from "lucide-react";
import type { Customer, CustomerOutcome, Metrics } from "../game/types";

interface CustomerStatusProps {
  customer?: Customer;
  metrics: Metrics;
  customerOutcome?: CustomerOutcome;
}

export function CustomerStatus({ customer, metrics, customerOutcome }: CustomerStatusProps) {
  if (!customer) {
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
        <UserRound size={20} aria-hidden="true" />
      </div>

      <dl className="status-grid">
        <div>
          <dt>满意度</dt>
          <dd>{metrics.satisfaction}</dd>
        </div>
        <div>
          <dt>怒气</dt>
          <dd>{metrics.anger}</dd>
        </div>
        <div>
          <dt>耐心</dt>
          <dd>{customer.patience}</dd>
        </div>
        <div>
          <dt>类型</dt>
          <dd>{getTypeLabel(customer.type)}</dd>
        </div>
      </dl>

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

      {customerOutcome ? (
        <div className={`outcome-pill outcome-${customerOutcome.status}`}>
          {getOutcomeLabel(customerOutcome.status)}
        </div>
      ) : null}
    </section>
  );
}

function getTypeLabel(type: Customer["type"]) {
  switch (type) {
    case "angry_refund":
      return "暴躁退款";
    case "lost_package":
      return "物流异常";
    case "coupon_hunter":
      return "补偿试探";
    case "policy_checker":
      return "规则较真";
    case "passive_aggressive":
      return "阴阳怪气";
  }
}

function getOutcomeLabel(status: CustomerOutcome["status"]) {
  if (status === "resolved") {
    return "已稳住";
  }

  if (status === "compliance_escalation") {
    return "主管介入";
  }

  return "客户投诉";
}
