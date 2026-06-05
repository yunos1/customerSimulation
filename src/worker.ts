import { requestCustomerReaction } from "./shared/customerReaction";

interface Env {
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
  AI_KEY?: string;
  AI_BASE_URL?: string;
  AI_MODEL?: string;
}

const maxBodyBytes = 20_000;

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

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > maxBodyBytes) {
    return json({ error: "Request body too large" }, 413);
  }

  try {
    const raw = await request.text();
    if (raw.length > maxBodyBytes) {
      return json({ error: "Request body too large" }, 413);
    }
    const body: unknown = JSON.parse(raw);
    const line = await requestCustomerReaction(body, {
      apiKey: env.AI_KEY,
      baseUrl: env.AI_BASE_URL,
      model: env.AI_MODEL,
    });

    return json({ line });
  } catch (error) {
    console.warn("[customer-reaction-api]", error);
    return json({ error: "AI customer reply failed" }, 502);
  }
}

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
