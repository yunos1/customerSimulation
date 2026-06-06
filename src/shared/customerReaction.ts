const defaultAiBaseUrl = "https://lpgpt.us/v1";
const defaultAiModel = "gpt-4o-mini";

export interface AiConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
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
      max_tokens: 120,
      messages: [
        {
          role: "system",
          content:
            "你在客服训练游戏里扮演客户。根据客户画像、上下文和客服刚才的回复，生成一句自然的中文客户回应。只输出客户会说的话，不要解释，不要加引号，60字以内。反应强度要贴合 reactionKind：success 稍缓和，neutral 半信半疑，failure 更不满。",
        },
        {
          role: "user",
          content: JSON.stringify(body),
        },
      ],
    }),
  });

  if (!response.ok) {
    const peek = (await response.text().catch(() => "")).slice(0, 300).replace(/\s+/g, " ");
    throw new Error(`AI request failed with ${response.status} url=${baseUrl}/chat/completions :: ${peek}`);
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
      max_tokens: 120,
      stream: true,
      messages: [
        {
          role: "system",
          content:
            "你在客服训练游戏里扮演客户。根据客户画像、上下文和客服刚才的回复，生成一句自然的中文客户回应。只输出客户会说的话，不要解释，不要加引号，60字以内。反应强度要贴合 reactionKind：success 稍缓和，neutral 半信半疑，failure 更不满。",
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
    .slice(0, 180);
}

export { defaultAiBaseUrl, defaultAiModel };
