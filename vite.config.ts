/// <reference types="vitest/config" />
import type { IncomingMessage, ServerResponse } from "node:http";
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { requestCustomerReaction } from "./src/shared/customerReaction";

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
        baseUrl: env.AI_BASE_URL || env.VITE_AI_BASE_URL,
        model: env.AI_MODEL || env.VITE_AI_MODEL,
      });

      sendJson(response, 200, { line });
    } catch (error) {
      console.warn("[customer-reaction-api]", error);
      sendJson(response, 502, { error: "AI customer reply failed" });
    }
  });
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
