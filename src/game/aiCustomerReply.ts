import { buildFreeReplyCard } from "./freeReply";
import { getActiveRound } from "./customerFlow";
import { scoreReply } from "./scoring";
import type { CustomerSession, GameState, ReplyCard } from "./types";

const requestTimeoutMs = 9000;

export type PlayerReplyDraft =
  | { kind: "card"; cardId: string }
  | { kind: "free"; text: string };

/** 构建发往 /api/customer-reaction 的请求体。 */
function buildRequestBody(
  state: GameState,
  session: CustomerSession,
  card: ReplyCard,
  reactionKind: string,
  stream?: boolean,
) {
  const allMessages = session.messages.filter(
    (m) => m.speaker === "customer" || m.speaker === "agent",
  );
  const sliced = allMessages.slice(-8);
  const history = (sliced[0]?.speaker === "agent" ? sliced.slice(1) : sliced).map((m) => ({
    speaker: m.speaker,
    text: m.text,
  }));

  const round = getActiveRound(session.customer, session.activeRoundIndex);
  // 客人在回应客服后，会自然引出下一轮的新诉求；交给 AI 在同一条回复里承接。
  const nextRoundIndex = session.activeRoundIndex + 1;
  const hasNextConcern =
    !round.resolveAfter && nextRoundIndex < session.customer.rounds.length;
  const nextConcern = hasNextConcern
    ? session.customer.rounds[nextRoundIndex].prompt
    : undefined;

  return {
    customer: {
      name: session.customer.name,
      type: session.customer.type,
      issue: session.customer.issue,
      profileNotes: session.customer.profileNotes,
      metrics: session.metrics,
    },
    round: {
      prompt: round.prompt,
      preferredTags: round.preferredTags,
      riskyTags: round.riskyTags,
    },
    reply: { text: card.title, tags: card.tags },
    reactionKind,
    history,
    ...(nextConcern ? { nextConcern } : {}),
    ...(stream ? { stream: true } : {}),
  };
}

export async function requestAiCustomerReply(
  state: GameState,
  session: CustomerSession,
  draft: PlayerReplyDraft,
) {
  const card = resolveDraftCard(state, draft);
  if (!card) return undefined;

  const round = getActiveRound(session.customer, session.activeRoundIndex);
  const { reactionKind } = scoreReply(session.customer, round, card, {
    previousReply: session.replyHistory[session.replyHistory.length - 1],
    templateUseCount: state.coachingStats.templateUseCount,
  });

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    const response = await fetch("/api/customer-reaction", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildRequestBody(state, session, card, reactionKind)),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn(`[aiCustomerReply] server error ${response.status}`);
      return undefined;
    }

    const data: unknown = await response.json();
    const line = readReactionLine(data);
    return line;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      console.warn("[aiCustomerReply] request timed out");
    } else {
      console.warn("[aiCustomerReply] request failed", err);
    }
    return undefined;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

/**
 * 流式版本：边生成边通过 onToken 回调推送 token，返回完整 line。
 * 适合打字机效果：调用方用 onToken 实时更新 UI，resolve 时拿到完整文本。
 */
export async function requestAiCustomerReplyStream(
  state: GameState,
  session: CustomerSession,
  draft: PlayerReplyDraft,
  onToken: (partial: string) => void,
): Promise<string | undefined> {
  const card = resolveDraftCard(state, draft);
  if (!card) return undefined;

  const round = getActiveRound(session.customer, session.activeRoundIndex);
  const { reactionKind } = scoreReply(session.customer, round, card, {
    previousReply: session.replyHistory[session.replyHistory.length - 1],
    templateUseCount: state.coachingStats.templateUseCount,
  });

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    const response = await fetch("/api/customer-reaction", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildRequestBody(state, session, card, reactionKind, true)),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn(`[aiCustomerReply] stream server error ${response.status}`);
      return undefined;
    }

    const reader = response.body?.getReader();
    if (!reader) return undefined;

    const decoder = new TextDecoder();
    let buffer = "";
    let accumulated = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const data = trimmed.slice(5).trim();
          if (data === "[DONE]") break;

          try {
            const parsed = JSON.parse(data) as { token?: string };
            if (parsed.token) {
              accumulated += parsed.token;
              onToken(accumulated);
            }
          } catch {
            // 忽略解析失败的行
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return accumulated.trim() || undefined;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      console.warn("[aiCustomerReply] stream timed out");
    } else {
      console.warn("[aiCustomerReply] stream failed", err);
    }
    return undefined;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function resolveDraftCard(state: GameState, draft: PlayerReplyDraft): ReplyCard | undefined {
  if (draft.kind === "free") {
    const trimmedText = draft.text.trim();
    return trimmedText ? buildFreeReplyCard(trimmedText) : undefined;
  }
  return state.level.replyCards.find((card) => card.id === draft.cardId);
}

function readReactionLine(data: unknown) {
  if (!data || typeof data !== "object" || !("line" in data)) return undefined;
  const line = (data as { line?: unknown }).line;
  return typeof line === "string" && line.trim() ? line.trim() : undefined;
}
