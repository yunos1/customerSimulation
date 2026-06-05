/// <reference types="vitest/config" />
import type { IncomingMessage, ServerResponse } from "node:http";
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const defaultAiBaseUrl = "https://lpgpt.us/v1";
const defaultAiModel = "gpt-4o-mini";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    base: "./",
    plugins: [react(), customerReactionApi(env)],
    server: {
      host: "0.0.0.0",
      port: 5173,
    },
    test: {
      environment: "node",
      include: ["src/**/*.test.ts"],
    },
  };
});

function customerReactionApi(env: Record<string, string>): Plugin {
  return {
    name: "customer-reaction-api",
    configureServer(server) {
      registerCustomerReactionRoute(server.middlewares, env);
    },
    configurePreviewServer(server) {
      registerCustomerReactionRoute(server.middlewares, env);
    },
  };
}

function registerCustomerReactionRoute(
  middlewares: {
    use(
      route: string,
      handler: (request: IncomingMessage, response: ServerResponse) => void,
    ): void;
  },
  env: Record<string, string>,
) {
  middlewares.use("/api/customer-reaction", async (request, response) => {
    if (request.method !== "POST") {
      sendJson(response, 405, { error: "Method not allowed" });
      return;
    }

    const apiKey = env.AI_KEY || env.VITE_AI_KEY;

    if (!apiKey) {
      sendJson(response, 503, { error: "AI customer reply is not configured" });
      return;
    }

    try {
      const body = await readJsonBody(request);
      const line = await requestCustomerReaction(body, {
        apiKey,
        baseUrl: env.AI_BASE_URL || env.VITE_AI_BASE_URL || defaultAiBaseUrl,
        model: env.AI_MODEL || env.VITE_AI_MODEL || defaultAiModel,
      });

      sendJson(response, 200, { line });
    } catch (error) {
      console.warn("[customer-reaction-api]", error);
      sendJson(response, 502, { error: "AI customer reply failed" });
    }
  });
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

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;

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

function readJsonBody(request: IncomingMessage) {
  return new Promise<unknown>((resolve, reject) => {
    let body = "";

    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;

      if (body.length > 20000) {
        reject(new Error("Request body is too large"));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

function sendJson(response: ServerResponse, status: number, body: unknown) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(body));
}
