interface Env {
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
  AI_KEY?: string;
  AI_BASE_URL?: string;
  AI_MODEL?: string;
}

const defaultAiBaseUrl = "https://lpgpt.us/v1";
const defaultAiModel = "gpt-4o-mini";

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/customer-reaction") {
      return handleCustomerReaction(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};

async function handleCustomerReaction(request: Request, env: Env) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  if (!env.AI_KEY) {
    return json({ error: "AI customer reply is not configured" }, 503);
  }

  try {
    const body = await request.json();
    const line = await requestCustomerReaction(body, {
      apiKey: env.AI_KEY,
      baseUrl: env.AI_BASE_URL || defaultAiBaseUrl,
      model: env.AI_MODEL || defaultAiModel,
    });

    return json({ line });
  } catch (error) {
    console.warn("[customer-reaction-api]", error);
    return json({ error: "AI customer reply failed" }, 502);
  }
}

async function requestCustomerReaction(
  body: unknown,
  config: { apiKey: string; baseUrl: string; model: string },
) {
  const response = await fetch(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
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

function sanitizeCustomerLine(line: string) {
  return line
    .trim()
    .replace(/^["'“”]+|["'“”]+$/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 180);
}

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
