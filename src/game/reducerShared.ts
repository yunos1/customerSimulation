import { sessionTiming } from "./balance";
import type {
  ChatMessage,
  CustomerOutcome,
  CustomerSession,
  GameState,
  Metrics,
} from "./types";

export const idCounters = { messageCounter: 0, sessionCounter: 0 };

export const timeoutAlertSeconds = sessionTiming.timeoutAlertSeconds;
export const maxOpenSessions = sessionTiming.maxOpenSessions;
export const minArrivalDelay = sessionTiming.minArrivalDelay;
export const maxArrivalDelay = sessionTiming.maxArrivalDelay;
export const randomEventChance = sessionTiming.randomEventChance;
/** 单会话消息列表最多保留条数，超出时截去最早的非系统消息（保留首条系统接入消息）。 */
export const maxSessionMessages = 80;

export function getActiveSession(state: GameState) {
  return state.sessions.find((session) => session.id === state.activeSessionId);
}

export function getSessionById(state: GameState, sessionId: string) {
  return state.sessions.find((session) => session.id === sessionId);
}

export function countActiveSessions(sessions: CustomerSession[]) {
  return sessions.filter((session) => session.status === "active").length;
}

export function replaceSession(sessions: CustomerSession[], nextSession: CustomerSession) {
  return sessions.map((session) => (session.id === nextSession.id ? nextSession : session));
}

export function normalizeAiReactionLine(line?: string) {
  const trimmedLine = line?.trim();

  if (!trimmedLine) {
    return undefined;
  }

  return trimmedLine.length > 400 ? `${trimmedLine.slice(0, 400)}...` : trimmedLine;
}

export function getPreferredSessionId(sessions: CustomerSession[], currentSessionId?: string) {
  const currentSession = sessions.find((session) => session.id === currentSessionId);

  if (currentSession?.status === "active") {
    return currentSession.id;
  }

  const nextActiveSession = sessions.find((session) => session.status === "active");

  return nextActiveSession?.id ?? currentSession?.id ?? sessions[0]?.id;
}

export function pickSessionMetrics(metrics: Metrics) {
  return {
    satisfaction: metrics.satisfaction,
    anger: metrics.anger,
  };
}

export function getArrivalDelay(seed: number) {
  return minArrivalDelay + getSeededIndex(seed, maxArrivalDelay - minArrivalDelay + 1);
}

export function getSeededIndex(seed: number, length: number) {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return Math.abs(Math.floor(x)) % length;
}

export function getOutcomeLine(status: CustomerOutcome["status"]) {
  if (status === "resolved") {
    return "会话已结束：客户接受了当前处理方案。";
  }

  if (status === "compliance_escalation") {
    return "会话已升级：主管发现合规风险过高。";
  }

  if (status === "rage_quit") {
    return "硬刚结局：客服选择不再忍，客户直接投诉。";
  }

  return "会话已结束：客户提交了投诉记录。";
}

export function getOutcomeLabel(status: CustomerOutcome["status"]) {
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

export function createMessage(speaker: ChatMessage["speaker"], text: string, replyId?: string): ChatMessage {
  idCounters.messageCounter += 1;

  return {
    id: `msg-${idCounters.messageCounter}`,
    speaker,
    text,
    ...(replyId ? { replyId } : {}),
  };
}

export function appendAgentMessage(messages: ChatMessage[], text: string, replyId?: string): ChatMessage[] {
  const lastMessage = messages[messages.length - 1];

  if (
    lastMessage?.speaker === "agent" &&
    lastMessage.text.trim() === text.trim() &&
    (!replyId || lastMessage.replyId === replyId || !lastMessage.replyId)
  ) {
    return messages;
  }

  return trimSessionMessages([...messages, createMessage("agent", text, replyId)]);
}

export function canResolvePendingReply(session: CustomerSession, replyId?: string) {
  if (replyId) {
    return session.pendingReplyId === replyId;
  }

  return !session.pendingReplyId;
}

/** 会话消息超过上限时，保留首条系统消息（接入提示）+ 最近的 maxSessionMessages-1 条。 */
export function trimSessionMessages(messages: ChatMessage[]): ChatMessage[] {
  if (messages.length <= maxSessionMessages) return messages;
  return [messages[0], ...messages.slice(-(maxSessionMessages - 1))];
}

/** 疲劳满时对所有活跃会话施加满意度惩罚。 */
