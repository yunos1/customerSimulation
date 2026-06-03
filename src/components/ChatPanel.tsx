import { Clock, MessageSquareText, Play } from "lucide-react";
import { AgentAvatar, CustomerAvatar } from "./Avatar";
import type { ChatMessage, CustomerSession, GamePhase } from "../game/types";

interface ChatPanelProps {
  activeSession?: CustomerSession;
  sessions: CustomerSession[];
  shiftMessages: ChatMessage[];
  phase: GamePhase;
  onStart: () => void;
  onSelectSession: (sessionId: string) => void;
}

export function ChatPanel({
  activeSession,
  sessions,
  shiftMessages,
  phase,
  onStart,
  onSelectSession,
}: ChatPanelProps) {
  const customer = activeSession?.customer;
  const messages = activeSession ? activeSession.messages : shiftMessages;

  return (
    <section className="panel chat-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">当前会话</p>
          <h2>{customer ? customer.name : "今日总结"}</h2>
        </div>
        {customer ? <CustomerAvatar customer={customer} size="lg" /> : <AgentAvatar size="lg" />}
      </div>

      {sessions.length > 0 ? (
        <div className="session-tabs" aria-label="客户会话列表">
          {sessions.map((session) => (
            <button
              className={`session-tab ${session.id === activeSession?.id ? "session-tab-active" : ""} ${
                session.status === "active" && session.elapsedSeconds >= 120 ? "session-tab-urgent" : ""
              } session-tab-${session.status}`}
              key={session.id}
              type="button"
              onClick={() => onSelectSession(session.id)}
            >
              <CustomerAvatar customer={session.customer} size="sm" />
              <span className="session-tab-copy">
                <strong>{session.customer.name}</strong>
                <small>{getSessionStatusLabel(session)}</small>
              </span>
              <span className="session-timer" aria-label={`${formatDuration(session.elapsedSeconds)}`}>
                <Clock size={13} aria-hidden="true" />
                {formatDuration(session.elapsedSeconds)}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {customer ? (
        <div className="customer-issue">
          <MessageSquareText size={17} aria-hidden="true" />
          <span>{customer.issue}</span>
        </div>
      ) : null}

      <div className="message-list" aria-live="polite">
        {messages.map((message) => (
          <article className={`message message-${message.speaker}`} key={message.id}>
            {message.speaker === "customer" && customer ? (
              <CustomerAvatar customer={customer} size="sm" />
            ) : null}
            {message.speaker === "agent" ? <AgentAvatar size="sm" /> : null}
            <div className="message-copy">
              <span className="message-speaker">{getSpeakerLabel(message.speaker)}</span>
              <p>{message.text}</p>
            </div>
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

function getSessionStatusLabel(session: CustomerSession) {
  if (session.status === "resolved") {
    return "已解决";
  }

  if (session.status === "failed") {
    return "已异常";
  }

  if (session.elapsedSeconds >= 120) {
    return "等待过久";
  }

  return "待服务";
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
