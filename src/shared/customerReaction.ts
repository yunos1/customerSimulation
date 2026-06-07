const defaultAiBaseUrl = "https://lpgpt.us/v1";
const defaultAiModel = "gpt-4o-mini";

const systemPrompt =
  "你在客服训练游戏里扮演客户。根据客户画像、上下文和客服刚才的回复，生成自然的中文客户回应。" +
  "先简短回应客服这句话，并自己判断客户是缓和、半信半疑还是更不满；" +
  "如果输入里带有 nextConcern 字段，就在同一段话里自然地引出这个新诉求，让对话能继续推进。" +
  "只输出客户会说的话，不要解释，不要加引号。整段最多 6 句话，简洁口语。";

const assessmentSystemPrompt =
  "你是客服训练游戏3.0的对话裁判、客户演员和教练。请根据完整上下文判断客服回复是否真的解决当前诉求，而不是按关键词打分。" +
  "必须严格输出JSON，不要Markdown，不要解释。JSON格式：" +
  "{\"line\":\"客户回应\",\"assessment\":{\"tags\":[\"apology|policy|refund_check|logistics|compensation|reject|supervisor|template|empathy|investigate|pushback\"],\"reactionKind\":\"success|neutral|failure\",\"customerIntent\":\"accepted|still_concerned|needs_info|escalating\",\"issueResolved\":false,\"effectAdjustments\":{\"satisfaction\":0,\"anger\":0,\"companyCost\":0,\"complianceRisk\":0,\"timeLeft\":0},\"coachingNote\":\"一句简短中文复盘\",\"nextAgentFocus\":\"下一句该补什么\",\"confidence\":0.8}}。" +
  "tags要按语义判定，不要只看关键词；自然、具体、有下一步的回复不要判template。" +
  "pushback只用于客服明确怼客户、让客户随便投诉、拒绝服务或人身攻击；普通短答、承诺复核和补充时效不要判pushback。" +
  "reactionKind由客户真实感受决定：有明确共情和可信行动是success，只有安抚或动作含糊是neutral，敷衍/乱承诺/过早拒绝/甩锅是failure。" +
  "customerIntent用于判断客户下一步：accepted=接受方案准备收尾，still_concerned=仍有顾虑继续追问，needs_info=需要订单/时效/责任/政策等信息，escalating=准备投诉或要求升级。" +
  "issueResolved只有在客户明确接受当前方案且没有实质追问时才为true；如果客户还问多久、谁负责、为什么、能不能、失败怎么办，必须为false。" +
  "effectAdjustments是对本地平衡的小幅修正，单项范围-8到8；表达特别清楚可加满意/降怒气，明显冒险要加怒气/合规/成本。" +
  "line要像真实客户口语，贴合画像、当前怒气和customerIntent；如果输入带nextConcern且issueResolved不是true，就在同一段话里自然引出新诉求。";

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
    const parsed = JSON.parse(extractJsonObject(content)) as { line?: unknown; assessment?: unknown };

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

function extractJsonObject(content: string) {
  const trimmed = content.trim();

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");

  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1);
  }

  return trimmed;
}

function chunkLine(line: string) {
  const chunks: string[] = [];

  for (let index = 0; index < line.length; index += 3) {
    chunks.push(line.slice(index, index + 3));
  }

  return chunks;
}

export { defaultAiBaseUrl, defaultAiModel };
