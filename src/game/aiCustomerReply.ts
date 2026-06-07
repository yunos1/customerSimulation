import { buildFreeReplyCard, normalizeReplyAssessment } from "./freeReply";
import { getActiveRound } from "./customerFlow";
import type { CustomerSession, GameState, ReplyAssessment, ReplyCard } from "./types";

const requestTimeoutMs = 20000;

export type PlayerReplyDraft =
  | { kind: "card"; cardId: string }
  | { kind: "free"; text: string };

/** 构建发往 /api/customer-reaction 的请求体。 */
function buildRequestBody(
  state: GameState,
  session: CustomerSession,
  card: ReplyCard,
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
    task: "analyze_player_reply_and_continue_customer_dialogue",
    rubric: {
      success:
        "客户感到被理解，并看到具体、可信、合规的下一步；如果诉求已经被解决，可以接受方案。",
      neutral:
        "回复有一部分有效，但仍缺少时效、责任、证据、边界或下一步，客户会继续追问。",
      failure:
        "回复敷衍、模板化、过早拒绝、乱承诺、甩锅或激怒客户，客户更不满或升级。",
      resolvedRule:
        "只有客户明确接受当前方案且没有实质追问时 issueResolved 才能为 true；只要客户还在问多久、谁负责、为什么、能不能、如果失败怎么办，就必须为 false。",
    },
    customer: {
      name: session.customer.name,
      type: session.customer.type,
      issue: session.customer.issue,
      profileNotes: session.customer.profileNotes,
      patience: session.customer.patience,
      metrics: session.metrics,
    },
    round: {
      prompt: round.prompt,
      preferredTags: round.preferredTags,
      riskyTags: round.riskyTags,
    },
    reply: { text: card.title, initialTags: card.tags },
    history,
    previousReplies: session.replyHistory.slice(-4),
    shiftContext: {
      globalMetrics: state.metrics,
      fatigue: state.fatigue,
      templateUseCount: state.coachingStats.templateUseCount,
      recentTimingRiskNotes: state.coachingStats.recentTimingRiskNotes,
    },
    assessment: true,
    ...(nextConcern ? { nextConcern } : {}),
    ...(stream ? { stream: true } : {}),
  };
}

export type AiCustomerReplyResult = {
  line?: string;
  assessment?: ReplyAssessment;
};

export async function requestAiCustomerReply(
  state: GameState,
  session: CustomerSession,
  draft: PlayerReplyDraft,
) {
  const card = resolveDraftCard(state, draft);
  if (!card) return undefined;

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    const response = await fetch("/api/customer-reaction", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildRequestBody(state, session, card)),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn(`[aiCustomerReply] server error ${response.status}`);
      return undefined;
    }

    const data: unknown = await response.json();
    return readReactionResult(data);
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
): Promise<AiCustomerReplyResult | undefined> {
  const card = resolveDraftCard(state, draft);
  if (!card) return undefined;

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    const response = await fetch("/api/customer-reaction", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildRequestBody(state, session, card, true)),
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
    let resultAssessment: ReplyAssessment | undefined;

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
            const parsed = JSON.parse(data) as { token?: string; assessment?: unknown };
            if (parsed.token) {
              accumulated += parsed.token;
              onToken(accumulated);
            }
            const assessment = normalizeReplyAssessment(parsed.assessment);
            if (assessment) {
              resultAssessment = assessment;
            }
          } catch {
            // 忽略解析失败的行
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    const line = accumulated.trim();

    if (!line && !resultAssessment) {
      return undefined;
    }

    return {
      ...(line ? { line } : {}),
      ...(resultAssessment ? { assessment: resultAssessment } : {}),
    };
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

function readReactionResult(data: unknown): AiCustomerReplyResult | undefined {
  if (!data || typeof data !== "object" || !("line" in data)) return undefined;

  const line = (data as { line?: unknown }).line;
  const assessment = normalizeReplyAssessment((data as { assessment?: unknown }).assessment);

  if (typeof line !== "string" || !line.trim()) {
    return assessment ? { assessment } : undefined;
  }

  return {
    line: line.trim(),
    ...(assessment ? { assessment } : {}),
  };
}
