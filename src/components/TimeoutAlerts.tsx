import { AlertTriangle } from "lucide-react";
import { CustomerAvatar } from "./Avatar";
import type { CustomerSession } from "../game/types";

interface TimeoutAlertsProps {
  sessions: CustomerSession[];
  onOpenSession: (sessionId: string) => void;
}

export function TimeoutAlerts({ sessions, onOpenSession }: TimeoutAlertsProps) {
  const alertSessions = sessions.filter(
    (session) =>
      session.status === "active" &&
      session.elapsedSeconds >= 120 &&
      !session.timeoutAlertDismissed,
  );

  if (alertSessions.length === 0) {
    return null;
  }

  return (
    <div className="timeout-alert-stack" aria-live="assertive">
      {alertSessions.map((session) => (
        <button
          className="timeout-alert"
          key={session.id}
          type="button"
          onClick={() => onOpenSession(session.id)}
        >
          <CustomerAvatar customer={session.customer} size="sm" />
          <span className="timeout-alert-copy">
            <span className="timeout-alert-title">
              <strong>{session.customer.name}</strong>
              <span>
                <AlertTriangle size={14} aria-hidden="true" />
                {formatDuration(session.elapsedSeconds)}
              </span>
            </span>
            <small>{getLastCustomerMessage(session)}</small>
          </span>
        </button>
      ))}
    </div>
  );
}

function getLastCustomerMessage(session: CustomerSession) {
  return (
    [...session.messages].reverse().find((message) => message.speaker === "customer")?.text ??
    session.customer.opening
  );
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
