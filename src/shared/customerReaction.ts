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
    throw new Error(`AI request failed with ${response.status}`);
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

export function sanitizeCustomerLine(line: string) {
  return line
    .trim()
    .replace(/^["'""]+|["'""]+$/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 180);
}

export { defaultAiBaseUrl, defaultAiModel };
