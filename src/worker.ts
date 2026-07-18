import {
  requestCustomerReaction,
  requestCustomerReactionStream,
  requestCustomerReactionWithAssessment,
  requestCustomerReactionWithAssessmentStream,
} from "./shared/customerReaction";
import { normalizeRoomId, SNAKE_PUBLIC_ROOMS, type SnakeRoomStatus } from "./snake/protocol";
export { SnakeRoom } from "./snake-room";

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  AI_KEY?: string;
  AI_BASE_URL?: string;
  AI_MODEL?: string;
  DB: D1Database;
  SESSIONS: KVNamespace;
  LINUXDO_CLIENT_ID: string;
  LINUXDO_CLIENT_SECRET: string;
  JWT_SECRET: string;
  LINUXDO_PROXY?: string;
  SNAKE_ROOM: DurableObjectNamespace;
}

const maxBodyBytes = 20_000;
const LINUXDO_AUTH_URL = "https://connect.linux.do/oauth2/authorize";
const LINUXDO_TOKEN_PATH = "/oauth2/token";
const LINUXDO_USER_PATH = "/api/user";
const SESSION_TTL = 60 * 60 * 24 * 30; // 30 days

/** In-memory AI rate limit: max N requests per key per window (per isolate). */
const AI_RATE_LIMIT_MAX = 30;
const AI_RATE_LIMIT_WINDOW_MS = 60_000;
const aiRateBuckets = new Map<string, { count: number; resetAt: number }>();

function clientIp(request: Request): string {
  return (
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

function takeAiRateToken(key: string): boolean {
  const now = Date.now();
  const bucket = aiRateBuckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    aiRateBuckets.set(key, { count: 1, resetAt: now + AI_RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (bucket.count >= AI_RATE_LIMIT_MAX) {
    return false;
  }
  bucket.count += 1;
  return true;
}

function ldUrl(env: Env, path: string) {
  const base = env.LINUXDO_PROXY ?? "https://connect.linux.do";
  return `${base}${path}`;
}

export default {
  async fetch(request: Request, env: Env) {
    try {
      const url = new URL(request.url);

      if (url.pathname === "/api/customer-reaction") return handleCustomerReaction(request, env);
      if (url.pathname === "/auth/login") return handleLogin(request, env);
      if (url.pathname === "/auth/callback") return handleCallback(request, env);
      if (url.pathname === "/auth/logout") return handleLogout(request, env);
      if (url.pathname === "/api/me") return handleMe(request, env);
      if (url.pathname === "/api/progress") return handleProgress(request, env);
      if (url.pathname === "/api/leaderboard") return handleLeaderboard(request, env);
      if (url.pathname === "/api/snake/leaderboard") return handleSnakeLeaderboard(request, env);
      if (url.pathname === "/api/snake/rooms") return handleSnakeRooms(request, env);
      if (url.pathname === "/api/snake/ws") return handleSnakeWs(request, env);

      return env.ASSETS.fetch(request);
    } catch (e) {
      log("worker.error", { message: (e as Error).message });
      return html(`Worker error: ${(e as Error).stack ?? e}`, 500);
    }
  },
};

/** Structured JSON logs for Workers observability (one line per event). */
function log(event: string, fields: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), event, ...fields }));
}

// ── Auth helpers ──────────────────────────────────────────────────────────────

function getOrigin(request: Request) {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

async function sign(payload: object, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = btoa(JSON.stringify(payload));
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${header}.${body}`));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return `${header}.${body}.${sigB64}`;
}

async function verify(token: string, secret: string): Promise<Record<string, unknown> | null> {
  try {
    const [header, body, sig] = token.split(".");
    const key = await crypto.subtle.importKey(
      "raw", new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" }, false, ["verify"]
    );
    const valid = await crypto.subtle.verify(
      "HMAC", key,
      Uint8Array.from(atob(sig), c => c.charCodeAt(0)),
      new TextEncoder().encode(`${header}.${body}`)
    );
    if (!valid) return null;
    const payload = JSON.parse(atob(body));
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;
    return payload;
  } catch { return null; }
}

async function getSession(request: Request, env: Env) {
  const auth = request.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : getCookie(request, "session");
  if (!token) return null;
  return verify(token, env.JWT_SECRET);
}

function getCookie(request: Request, name: string) {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

// ── OAuth handlers ────────────────────────────────────────────────────────────

async function handleLogin(request: Request, env: Env) {
  const state = crypto.randomUUID();
  await env.SESSIONS.put(`state:${state}`, "1", { expirationTtl: 600 });
  const params = new URLSearchParams({
    response_type: "code",
    client_id: env.LINUXDO_CLIENT_ID,
    redirect_uri: `${getOrigin(request)}/auth/callback`,
    scope: "read",
    state,
  });
  return Response.redirect(`${LINUXDO_AUTH_URL}?${params}`, 302);
}

async function handleCallback(request: Request, env: Env) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const savedState = state ? await env.SESSIONS.get(`state:${state}`) : null;
  if (savedState) await env.SESSIONS.delete(`state:${state}`);

  if (!code || !state || !savedState) return html("Invalid state", 400);

  const redirectUri = `${getOrigin(request)}/auth/callback`;

  // Exchange code for token
  let tokenRes: Response;
  try {
    const basicAuth = btoa(`${env.LINUXDO_CLIENT_ID}:${env.LINUXDO_CLIENT_SECRET}`);
    tokenRes = await fetch(ldUrl(env, LINUXDO_TOKEN_PATH), {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: env.LINUXDO_CLIENT_ID,
        client_secret: env.LINUXDO_CLIENT_SECRET,
      }),
      signal: AbortSignal.timeout(10000),
    });
  } catch (e) {
    return html(`Token request failed: ${(e as Error).message}`, 502);
  }
  if (!tokenRes.ok) {
    const body = await tokenRes.text();
    return html(`Token exchange failed (${tokenRes.status}): ${body}`, 502);
  }
  const { access_token } = await tokenRes.json() as { access_token: string };

  // Get user info
  let userRes: Response;
  try {
    userRes = await fetch(ldUrl(env, LINUXDO_USER_PATH), {
      headers: { Authorization: `Bearer ${access_token}` },
      signal: AbortSignal.timeout(10000),
    });
  } catch (e) {
    return html(`User fetch failed: ${(e as Error).message}`, 502);
  }
  if (!userRes.ok) return html(`Failed to fetch user (${userRes.status})`, 502);
  const ldUser = await userRes.json() as {
    id: number; username: string; avatar_template: string; trust_level: number;
  };

  const userId = String(ldUser.id);
  const avatarUrl = ldUser.avatar_template?.replace("{size}", "120") ?? null;
  const now = Math.floor(Date.now() / 1000);

  // Upsert user
  await env.DB.prepare(
    `INSERT INTO users (id, username, avatar_url, trust_level, created_at, last_login)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET username=excluded.username,
       avatar_url=excluded.avatar_url, trust_level=excluded.trust_level, last_login=excluded.last_login`
  ).bind(userId, ldUser.username, avatarUrl, ldUser.trust_level, now, now).run();

  // Issue JWT session
  const jwt = await sign(
    { sub: userId, username: ldUser.username, avatar_url: avatarUrl, exp: now + SESSION_TTL },
    env.JWT_SECRET
  );

  log("auth.login", { userId });

  const secure = isSecureRequest(request) ? "; Secure" : "";
  const headers = new Headers({
    Location: "/",
    "Set-Cookie": `session=${jwt}; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL}; Path=/${secure}`,
  });
  // clear state cookie
  headers.append("Set-Cookie", `oauth_state=; HttpOnly; Max-Age=0; Path=/${secure}`);
  return new Response(null, { status: 302, headers });
}

function handleLogout(request: Request, _env?: Env) {
  log("auth.logout", {});
  const secure = isSecureRequest(request) ? "; Secure" : "";
  return new Response(null, {
    status: 302,
    headers: {
      Location: "/",
      "Set-Cookie": `session=; HttpOnly; Max-Age=0; Path=/${secure}`,
    },
  });
}

/** Production (HTTPS) cookies should include Secure; local http://127.0.0.1 stays without it. */
function isSecureRequest(request: Request): boolean {
  return new URL(request.url).protocol === "https:";
}

// ── User API ──────────────────────────────────────────────────────────────────

async function handleMe(request: Request, env: Env) {
  const session = await getSession(request, env);
  if (!session) return json({ user: null });
  return json({ user: { id: session.sub, username: session.username, avatar_url: session.avatar_url } });
}

async function handleProgress(request: Request, env: Env) {
  const session = await getSession(request, env);
  if (!session) return json({ error: "Unauthorized" }, 401);
  const userId = session.sub as string;

  if (request.method === "GET") {
    const row = await env.DB.prepare("SELECT meta_json, updated_at FROM user_progress WHERE user_id = ?")
      .bind(userId).first<{ meta_json: string; updated_at: number }>();
    log("progress.get", { userId, hasMeta: Boolean(row) });
    return json({
      meta: row ? JSON.parse(row.meta_json) : null,
      updatedAt: row?.updated_at ?? null,
    });
  }

  if (request.method === "PUT") {
    const body = await request.text();
    if (body.length > 100_000) return json({ error: "Too large" }, 413);
    const meta = JSON.parse(body);
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare(
      `INSERT INTO user_progress (user_id, meta_json, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET meta_json=excluded.meta_json, updated_at=excluded.updated_at`
    ).bind(userId, JSON.stringify(meta), now).run();

    // update leaderboard
    const username = session.username as string;
    const avatarUrl = session.avatar_url as string ?? null;
    const records = meta.records ?? {};
    await env.DB.prepare(
      `INSERT INTO leaderboard (user_id, username, avatar_url, total_runs, best_satisfaction, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET username=excluded.username, avatar_url=excluded.avatar_url,
         total_runs=excluded.total_runs, best_satisfaction=excluded.best_satisfaction, updated_at=excluded.updated_at`
    ).bind(userId, username, avatarUrl, records.totalRuns ?? 0, records.bestSatisfaction ?? 0, now).run();

    log("progress.put", {
      userId,
      totalRuns: records.totalRuns ?? 0,
      bytes: body.length,
    });
    return json({ ok: true, updatedAt: now });
  }

  // Export full progress payload (download-friendly).
  if (request.method === "POST" && new URL(request.url).searchParams.get("action") === "export") {
    const row = await env.DB.prepare("SELECT meta_json, updated_at FROM user_progress WHERE user_id = ?")
      .bind(userId).first<{ meta_json: string; updated_at: number }>();
    log("progress.export", { userId, hasMeta: Boolean(row) });
    return json({
      exportedAt: new Date().toISOString(),
      userId,
      username: session.username,
      updatedAt: row?.updated_at ?? null,
      meta: row ? JSON.parse(row.meta_json) : null,
    });
  }

  // Clear cloud progress (and leaderboard row). Local client should reset separately.
  if (request.method === "DELETE") {
    await env.DB.prepare("DELETE FROM user_progress WHERE user_id = ?").bind(userId).run();
    await env.DB.prepare("DELETE FROM leaderboard WHERE user_id = ?").bind(userId).run();
    log("progress.delete", { userId });
    return json({ ok: true });
  }

  return json({ error: "Method not allowed" }, 405);
}

async function handleLeaderboard(_request: Request, env: Env) {
  const rows = await env.DB.prepare(
    "SELECT username, avatar_url, total_runs, best_satisfaction FROM leaderboard ORDER BY best_satisfaction DESC LIMIT 50"
  ).all();
  return json({ leaderboard: rows.results });
}

// ── Existing AI handler ───────────────────────────────────────────────────────

async function handleCustomerReaction(request: Request, env: Env) {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!env.AI_KEY) return json({ error: "AI customer reply is not configured" }, 503);

  const session = await getSession(request, env);
  const rateKey = session?.sub ? `user:${session.sub}` : `ip:${clientIp(request)}`;
  if (!takeAiRateToken(String(rateKey))) {
    log("ai.rate_limited", { rateKey });
    return json({ error: "Too many AI requests, try again shortly" }, 429);
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > maxBodyBytes) return json({ error: "Request body too large" }, 413);

  try {
    const raw = await request.text();
    if (raw.length > maxBodyBytes) return json({ error: "Request body too large" }, 413);
    const body = JSON.parse(raw) as { stream?: boolean; assessment?: boolean };

    const aiConfig = { apiKey: env.AI_KEY, baseUrl: env.AI_BASE_URL, model: env.AI_MODEL };
    const bodyForAi = body && typeof body === "object"
      ? Object.fromEntries(Object.entries(body).filter(([key]) => key !== "stream" && key !== "assessment"))
      : body;

    if (body && typeof body === "object" && body.stream) {
      return streamCustomerReaction(bodyForAi, aiConfig, body.assessment === true);
    }

    if (body && typeof body === "object" && body.assessment) {
      const result = await requestCustomerReactionWithAssessment(bodyForAi, aiConfig);
      return json(result);
    }

    const line = await requestCustomerReaction(bodyForAi, aiConfig);
    return json({ line });
  } catch (error) {
    log("ai.error", { message: (error as Error).message, mode: "json" });
    return json({ error: "AI customer reply failed", detail: (error as Error).message }, 502);
  }
}

/** 把上游 token 流转成前端期望的 SSE：每行 `data: {"token":"..."}`，结尾 `data: [DONE]`。 */
function streamCustomerReaction(
  body: unknown,
  config: { apiKey: string; baseUrl?: string; model?: string },
  includeAssessment = false,
) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        if (includeAssessment) {
          for await (const event of requestCustomerReactionWithAssessmentStream(body, config)) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
          }
        } else {
          for await (const token of requestCustomerReactionStream(body, config)) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token })}\n\n`));
          }
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (error) {
        console.warn("[customer-reaction-api stream]", error);
        log("ai.error", { message: (error as Error).message, mode: "stream" });
        // 让客户端走静态回退：直接结束流（无 token），不抛出 500。
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
    },
  });
}

// ── Snake handlers ────────────────────────────────────────────────────────────

async function handleSnakeLeaderboard(_request: Request, env: Env) {
  const rows = await env.DB.prepare(
    "SELECT user_id, username, avatar_url, score, kills FROM snake_scores ORDER BY score DESC LIMIT 100"
  ).all();
  return json({ leaderboard: rows.results });
}

/** Lobby: occupancy for public rooms (and optional ?room= for a custom id). */
async function handleSnakeRooms(request: Request, env: Env) {
  if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
  const url = new URL(request.url);
  const custom = url.searchParams.get("room");
  const ids = custom
    ? [normalizeRoomId(custom)]
    : SNAKE_PUBLIC_ROOMS.map((r) => r.id);

  const rooms: SnakeRoomStatus[] = await Promise.all(
    ids.map(async (roomId) => {
      try {
        const stub = env.SNAKE_ROOM.get(env.SNAKE_ROOM.idFromName(roomId));
        const res = await stub.fetch(
          new Request(`https://snake.internal/status?room=${encodeURIComponent(roomId)}&status=1`),
        );
        if (!res.ok) {
          return { roomId, humans: 0, bots: 0, maxPlayers: 50, open: true };
        }
        return (await res.json()) as SnakeRoomStatus;
      } catch {
        return { roomId, humans: 0, bots: 0, maxPlayers: 50, open: true };
      }
    }),
  );

  return json({
    rooms: rooms.map((status) => {
      const meta = SNAKE_PUBLIC_ROOMS.find((r) => r.id === status.roomId);
      return {
        ...status,
        title: meta?.title ?? status.roomId,
        blurb: meta?.blurb ?? "自定义房间",
      };
    }),
  });
}

async function handleSnakeWs(request: Request, env: Env) {
  const url = new URL(request.url);
  const roomId = normalizeRoomId(url.searchParams.get("room"));
  url.searchParams.set("room", roomId);

  const id = env.SNAKE_ROOM.idFromName(roomId);
  const room = env.SNAKE_ROOM.get(id);
  // session cookie 是 HttpOnly，前端 JS 读不到，无法放进 WS URL。
  // 在 Worker 侧从握手请求的 cookie 取出 JWT，显式作为 ?token= 传给 DO，
  // 保证已登录用户被正确识别（不再回退为游客）。
  if (!url.searchParams.get("token")) {
    const cookieToken = getCookie(request, "session");
    if (cookieToken) {
      url.searchParams.set("token", cookieToken);
      return room.fetch(new Request(url.toString(), request));
    }
  }
  return room.fetch(new Request(url.toString(), request));
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function html(body: string, status = 200) {
  return new Response(body, { status, headers: { "Content-Type": "text/html" } });
}
