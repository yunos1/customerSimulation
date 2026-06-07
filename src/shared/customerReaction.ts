const defaultAiBaseUrl = "https://lpgpt.us/v1";
const defaultAiModel = "gpt-4o-mini";

const systemPrompt =
  "你在客服训练游戏里扮演客户。根据客户画像、上下文和客服刚才的回复，生成自然的中文客户回应。" +
  "先简短回应客服这句话（贴合 reactionKind：success 稍缓和，neutral 半信半疑，failure 更不满）；" +
  "如果输入里带有 nextConcern 字段，就在同一段话里自然地引出这个新诉求，让对话能继续推进。" +
  "只输出客户会说的话，不要解释，不要加引号。整段最多 6 句话，简洁口语。";

const assessmentSystemPrompt =
  "你是客服训练游戏2.0的语义评估器。请同时判断客服回复的意图并生成客户自然回应。" +
  "必须严格输出JSON，不要Markdown，不要解释。JSON格式：" +
  "{\"line\":\"客户回应\",\"assessment\":{\"tags\":[\"apology|policy|refund_check|logistics|compensation|reject|supervisor|template|empathy|investigate|pushback\"],\"reactionKind\":\"success|neutral|failure\",\"effectAdjustments\":{\"satisfaction\":0,\"anger\":0,\"companyCost\":0,\"complianceRisk\":0,\"timeLeft\":0},\"coachingNote\":\"一句简短中文复盘\",\"confidence\":0.8}}。" +
  "tags要按语义判定，不要只看关键词；自然、具体、有下一步的回复不要判template。" +
  "pushback只用于客服明确怼客户、让客户随便投诉、拒绝服务或人身攻击；普通短答、承诺复核和补充时效不要判pushback。" +
  "effectAdjustments只能小幅修正，单项范围-6到6；只在表达特别清楚或明显冒险时给值，否则给0。" +
  "line要贴合客户画像和reactionKind；如果输入带nextConcern，在同一段话里自然引出该新诉求。";

export interface AiConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
}

export interface CustomerReactionResult {
  line: string;
  assessment?: unknown;
}

export async function requestCustomerReaction(body: unknown, config: AiConfig) {
  const baseUrl = (config.baseUrl || defaultAiBaseUrl).replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model || defaultAiModel,
      temperature: 0.75,
      max_tokens: 260,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: JSON.stringify(body),
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`AI request failed with status ${response.status}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  const content = data.choices?.[0]?.message?.content;

  if (typeof content !== "string" || !content.trim()) {
    throw new Error("AI response did not include content");
  }

  return sanitizeCustomerLine(content);
}

export async function requestCustomerReactionWithAssessment(
  body: unknown,
  config: AiConfig,
): Promise<CustomerReactionResult> {
  const baseUrl = (config.baseUrl || defaultAiBaseUrl).replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model || defaultAiModel,
      temperature: 0.45,
      max_tokens: 420,
      messages: [
        {
          role: "system",
          content: assessmentSystemPrompt,
        },
        {
          role: "user",
          content: JSON.stringify(body),
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`AI assessment request failed with status ${response.status}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  const content = data.choices?.[0]?.message?.content;

  if (typeof content !== "string" || !content.trim()) {
    throw new Error("AI assessment response did not include content");
  }

  const parsed = parseReactionResult(content);

  if (!parsed) {
    throw new Error("AI assessment response was not valid JSON");
  }

  return parsed;
}

export async function* requestCustomerReactionWithAssessmentStream(
  body: unknown,
  config: AiConfig,
): AsyncIterable<{ token?: string; assessment?: unknown }> {
  const result = await requestCustomerReactionWithAssessment(body, config);

  for (const token of chunkLine(result.line)) {
    yield { token };
  }

  if (result.assessment) {
    yield { assessment: result.assessment };
  }
}

/** 流式版本：调用 /chat/completions stream=true，返回逐 token 的 AsyncIterable。 */
export async function* requestCustomerReactionStream(
  body: unknown,
  config: AiConfig,
): AsyncIterable<string> {
  const baseUrl = (config.baseUrl || defaultAiBaseUrl).replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model || defaultAiModel,
      temperature: 0.75,
      max_tokens: 260,
      stream: true,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: JSON.stringify(body),
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`AI stream request failed with ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

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
        if (data === "[DONE]") return;

        try {
          const parsed = JSON.parse(data) as {
            choices?: Array<{ delta?: { content?: string } }>;
          };
          const token = parsed.choices?.[0]?.delta?.content;
          if (token) yield token;
        } catch {
          // 忽略解析失败的行
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export function sanitizeCustomerLine(line: string) {
  return line
    .trim()
    .replace(/^["'""]+|["'""]+$/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 400);
}

function parseReactionResult(content: string): CustomerReactionResult | undefined {
  try {
    const parsed = JSON.parse(content) as { line?: unknown; assessment?: unknown };

    if (typeof parsed.line !== "string" || !parsed.line.trim()) {
      return undefined;
    }

    return {
      line: sanitizeCustomerLine(parsed.line),
      assessment: parsed.assessment,
    };
  } catch {
    return undefined;
  }
}

function chunkLine(line: string) {
  const chunks: string[] = [];

  for (let index = 0; index < line.length; index += 3) {
    chunks.push(line.slice(index, index + 3));
  }

  return chunks;
}

export { defaultAiBaseUrl, defaultAiModel };
