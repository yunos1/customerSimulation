import { Headset, MessageSquareText, Play, SkipForward } from "lucide-react";
import type { ChatMessage, Customer, GamePhase } from "../game/types";

interface ChatPanelProps {
  customer?: Customer;
  messages: ChatMessage[];
  phase: GamePhase;
  onStart: () => void;
  onNextCustomer: () => void;
}

export function ChatPanel({ customer, messages, phase, onStart, onNextCustomer }: ChatPanelProps) {
  const canAdvance = phase === "customer_resolved" || phase === "customer_failed";

  return (
    <section className="panel chat-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">当前会话</p>
          <h2>{customer ? customer.name : "今日总结"}</h2>
        </div>
        <div className="conversation-icon">
          <Headset size={20} aria-hidden="true" />
        </div>
      </div>

      {customer ? (
        <div className="customer-issue">
          <MessageSquareText size={17} aria-hidden="true" />
          <span>{customer.issue}</span>
        </div>
      ) : null}

      <div className="message-list" aria-live="polite">
        {messages.map((message) => (
          <article className={`message message-${message.speaker}`} key={message.id}>
            <span className="message-speaker">{getSpeakerLabel(message.speaker)}</span>
            <p>{message.text}</p>
          </article>
        ))}
      </div>

      <div className="chat-actions">
        {phase === "intro" ? (
          <button className="primary-button" type="button" onClick={onStart}>
            <Play size={17} aria-hidden="true" />
            开始值班
          </button>
        ) : null}

        {canAdvance ? (
          <button className="primary-button" type="button" onClick={onNextCustomer}>
            <SkipForward size={17} aria-hidden="true" />
            下一位客户
          </button>
        ) : null}
      </div>
    </section>
  );
}

function getSpeakerLabel(speaker: ChatMessage["speaker"]) {
  if (speaker === "customer") {
    return "客户";
  }

  if (speaker === "agent") {
    return "你";
  }

  return "系统";
}
