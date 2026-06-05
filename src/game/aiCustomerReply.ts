import { buildFreeReplyCard } from "./freeReply";
import { getActiveRound } from "./customerFlow";
import { scoreReply } from "./scoring";
import type { CustomerSession, GameState, ReplyCard } from "./types";

const requestTimeoutMs = 9000;

export type PlayerReplyDraft =
  | { kind: "card"; cardId: string }
  | { kind: "free"; text: string };

export async function requestAiCustomerReply(
  state: GameState,
  session: CustomerSession,
  draft: PlayerReplyDraft,
) {
  const card = resolveDraftCard(state, draft);

  if (!card) {
    return undefined;
  }

  const round = getActiveRound(session.customer, session.activeRoundIndex);
  const { reactionKind } = scoreReply(session.customer, round, card, {
    previousReply: session.replyHistory[session.replyHistory.length - 1],
    templateUseCount: state.coachingStats.templateUseCount,
  });
  const history = session.messages
    .filter((message) => message.speaker === "customer" || message.speaker === "agent")
    .slice(-8)
    .map((message) => ({
      speaker: message.speaker,
      text: message.text,
    }));
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    const response = await fetch("/api/customer-reaction", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
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
        reply: {
          text: card.title,
          tags: card.tags,
        },
        reactionKind,
        history,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return undefined;
    }

    const data: unknown = await response.json();
    const line = readReactionLine(data);

    return line;
  } catch {
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
  if (!data || typeof data !== "object" || !("line" in data)) {
    return undefined;
  }

  const line = (data as { line?: unknown }).line;

  return typeof line === "string" && line.trim() ? line.trim() : undefined;
}
