var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/shared/customerReaction.ts
var defaultAiBaseUrl = "https://lpgpt.us/v1";
var defaultAiModel = "gpt-4o-mini";
async function requestCustomerReaction(body, config) {
  const baseUrl = (config.baseUrl || defaultAiBaseUrl).replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: config.model || defaultAiModel,
      temperature: 0.75,
      max_tokens: 120,
      messages: [
        {
          role: "system",
          content: "\u4F60\u5728\u5BA2\u670D\u8BAD\u7EC3\u6E38\u620F\u91CC\u626E\u6F14\u5BA2\u6237\u3002\u6839\u636E\u5BA2\u6237\u753B\u50CF\u3001\u4E0A\u4E0B\u6587\u548C\u5BA2\u670D\u521A\u624D\u7684\u56DE\u590D\uFF0C\u751F\u6210\u4E00\u53E5\u81EA\u7136\u7684\u4E2D\u6587\u5BA2\u6237\u56DE\u5E94\u3002\u53EA\u8F93\u51FA\u5BA2\u6237\u4F1A\u8BF4\u7684\u8BDD\uFF0C\u4E0D\u8981\u89E3\u91CA\uFF0C\u4E0D\u8981\u52A0\u5F15\u53F7\uFF0C60\u5B57\u4EE5\u5185\u3002\u53CD\u5E94\u5F3A\u5EA6\u8981\u8D34\u5408 reactionKind\uFF1Asuccess \u7A0D\u7F13\u548C\uFF0Cneutral \u534A\u4FE1\u534A\u7591\uFF0Cfailure \u66F4\u4E0D\u6EE1\u3002"
        },
        {
          role: "user",
          content: JSON.stringify(body)
        }
      ]
    })
  });
  if (!response.ok) {
    throw new Error(`AI request failed with ${response.status}`);
  }
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("AI response did not include content");
  }
  return sanitizeCustomerLine(content);
}
__name(requestCustomerReaction, "requestCustomerReaction");
function sanitizeCustomerLine(line) {
  return line.trim().replace(/^["'""]+|["'""]+$/g, "").replace(/\s+/g, " ").slice(0, 180);
}
__name(sanitizeCustomerLine, "sanitizeCustomerLine");

// src/worker.ts
var maxBodyBytes = 2e4;
var LINUXDO_AUTH_URL = "https://connect.linux.do/oauth2/authorize";
var LINUXDO_TOKEN_PATH = "/oauth2/token";
var LINUXDO_USER_PATH = "/api/user";
var SESSION_TTL = 60 * 60 * 24 * 30;
function ldUrl(env, path) {
  const base = env.LINUXDO_PROXY ?? "https://connect.linux.do";
  return `${base}${path}`;
}
__name(ldUrl, "ldUrl");
var worker_default = {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      if (url.pathname === "/api/customer-reaction") return handleCustomerReaction(request, env);
      if (url.pathname === "/auth/login") return handleLogin(request, env);
      if (url.pathname === "/auth/callback") return handleCallback(request, env);
      if (url.pathname === "/auth/logout") return handleLogout(request, env);
      if (url.pathname === "/api/me") return handleMe(request, env);
      if (url.pathname === "/api/progress") return handleProgress(request, env);
      if (url.pathname === "/api/leaderboard") return handleLeaderboard(request, env);
      return env.ASSETS.fetch(request);
    } catch (e) {
      return html(`Worker error: ${e.stack ?? e}`, 500);
    }
  }
};
function getOrigin(request) {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}
__name(getOrigin, "getOrigin");
async function sign(payload, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = btoa(JSON.stringify(payload));
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${header}.${body}`));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return `${header}.${body}.${sigB64}`;
}
__name(sign, "sign");
async function verify(token, secret) {
  try {
    const [header, body, sig] = token.split(".");
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      Uint8Array.from(atob(sig), (c) => c.charCodeAt(0)),
      new TextEncoder().encode(`${header}.${body}`)
    );
    if (!valid) return null;
    const payload = JSON.parse(atob(body));
    if (payload.exp && Date.now() / 1e3 > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}
__name(verify, "verify");
async function getSession(request, env) {
  const auth = request.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : getCookie(request, "session");
  if (!token) return null;
  return verify(token, env.JWT_SECRET);
}
__name(getSession, "getSession");
function getCookie(request, name) {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}
__name(getCookie, "getCookie");
async function handleLogin(request, env) {
  const state = crypto.randomUUID();
  await env.SESSIONS.put(`state:${state}`, "1", { expirationTtl: 600 });
  const params = new URLSearchParams({
    response_type: "code",
    client_id: env.LINUXDO_CLIENT_ID,
    redirect_uri: `${getOrigin(request)}/auth/callback`,
    scope: "read",
    state
  });
  return Response.redirect(`${LINUXDO_AUTH_URL}?${params}`, 302);
}
__name(handleLogin, "handleLogin");
async function handleCallback(request, env) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const savedState = state ? await env.SESSIONS.get(`state:${state}`) : null;
  if (savedState) await env.SESSIONS.delete(`state:${state}`);
  if (!code || !state || !savedState) return html(`Invalid state | code=${!!code} state=${state} saved=${savedState}`, 400);
  const redirectUri = `${getOrigin(request)}/auth/callback`;
  console.log("[callback] redirect_uri =", redirectUri);
  let tokenRes;
  try {
    const basicAuth = btoa(`${env.LINUXDO_CLIENT_ID}:${env.LINUXDO_CLIENT_SECRET}`);
    tokenRes = await fetch(ldUrl(env, LINUXDO_TOKEN_PATH), {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${basicAuth}`
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: env.LINUXDO_CLIENT_ID,
        client_secret: env.LINUXDO_CLIENT_SECRET
      }),
      signal: AbortSignal.timeout(1e4)
    });
  } catch (e) {
    return html(`Token request failed: ${e.message}`, 502);
  }
  if (!tokenRes.ok) {
    const body = await tokenRes.text();
    return html(`Token exchange failed (${tokenRes.status}): ${body}<br><br>redirect_uri: ${redirectUri}<br>client_id: ${env.LINUXDO_CLIENT_ID}`, 502);
  }
  const { access_token } = await tokenRes.json();
  let userRes;
  try {
    userRes = await fetch(ldUrl(env, LINUXDO_USER_PATH), {
      headers: { Authorization: `Bearer ${access_token}` },
      signal: AbortSignal.timeout(1e4)
    });
  } catch (e) {
    return html(`User fetch failed: ${e.message}`, 502);
  }
  if (!userRes.ok) return html(`Failed to fetch user (${userRes.status})`, 502);
  const ldUser = await userRes.json();
  const userId = String(ldUser.id);
  const avatarUrl = ldUser.avatar_template?.replace("{size}", "120") ?? null;
  const now = Math.floor(Date.now() / 1e3);
  await env.DB.prepare(
    `INSERT INTO users (id, username, avatar_url, trust_level, created_at, last_login)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET username=excluded.username,
       avatar_url=excluded.avatar_url, trust_level=excluded.trust_level, last_login=excluded.last_login`
  ).bind(userId, ldUser.username, avatarUrl, ldUser.trust_level, now, now).run();
  const jwt = await sign(
    { sub: userId, username: ldUser.username, avatar_url: avatarUrl, exp: now + SESSION_TTL },
    env.JWT_SECRET
  );
  const headers = new Headers({
    Location: "/",
    "Set-Cookie": `session=${jwt}; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL}; Path=/`
  });
  headers.append("Set-Cookie", "oauth_state=; HttpOnly; Max-Age=0; Path=/");
  return new Response(null, { status: 302, headers });
}
__name(handleCallback, "handleCallback");
function handleLogout(_request, _env) {
  return new Response(null, {
    status: 302,
    headers: {
      Location: "/",
      "Set-Cookie": "session=; HttpOnly; Max-Age=0; Path=/"
    }
  });
}
__name(handleLogout, "handleLogout");
async function handleMe(request, env) {
  const session = await getSession(request, env);
  if (!session) return json({ user: null });
  return json({ user: { id: session.sub, username: session.username, avatar_url: session.avatar_url } });
}
__name(handleMe, "handleMe");
async function handleProgress(request, env) {
  const session = await getSession(request, env);
  if (!session) return json({ error: "Unauthorized" }, 401);
  const userId = session.sub;
  if (request.method === "GET") {
    const row = await env.DB.prepare("SELECT meta_json FROM user_progress WHERE user_id = ?").bind(userId).first();
    return json({ meta: row ? JSON.parse(row.meta_json) : null });
  }
  if (request.method === "PUT") {
    const body = await request.text();
    if (body.length > 1e5) return json({ error: "Too large" }, 413);
    const meta = JSON.parse(body);
    const now = Math.floor(Date.now() / 1e3);
    await env.DB.prepare(
      `INSERT INTO user_progress (user_id, meta_json, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET meta_json=excluded.meta_json, updated_at=excluded.updated_at`
    ).bind(userId, JSON.stringify(meta), now).run();
    const username = session.username;
    const avatarUrl = session.avatar_url ?? null;
    const records = meta.records ?? {};
    await env.DB.prepare(
      `INSERT INTO leaderboard (user_id, username, avatar_url, total_runs, best_satisfaction, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET username=excluded.username, avatar_url=excluded.avatar_url,
         total_runs=excluded.total_runs, best_satisfaction=excluded.best_satisfaction, updated_at=excluded.updated_at`
    ).bind(userId, username, avatarUrl, records.totalRuns ?? 0, records.bestSatisfaction ?? 0, now).run();
    return json({ ok: true });
  }
  return json({ error: "Method not allowed" }, 405);
}
__name(handleProgress, "handleProgress");
async function handleLeaderboard(_request, env) {
  const rows = await env.DB.prepare(
    "SELECT username, avatar_url, total_runs, best_satisfaction FROM leaderboard ORDER BY best_satisfaction DESC LIMIT 50"
  ).all();
  return json({ leaderboard: rows.results });
}
__name(handleLeaderboard, "handleLeaderboard");
async function handleCustomerReaction(request, env) {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!env.AI_KEY) return json({ error: "AI customer reply is not configured" }, 503);
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > maxBodyBytes) return json({ error: "Request body too large" }, 413);
  try {
    const raw = await request.text();
    if (raw.length > maxBodyBytes) return json({ error: "Request body too large" }, 413);
    const body = JSON.parse(raw);
    const line = await requestCustomerReaction(body, {
      apiKey: env.AI_KEY,
      baseUrl: env.AI_BASE_URL,
      model: env.AI_MODEL
    });
    return json({ line });
  } catch (error) {
    console.warn("[customer-reaction-api]", error);
    return json({ error: "AI customer reply failed" }, 502);
  }
}
__name(handleCustomerReaction, "handleCustomerReaction");
function json(body, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
__name(json, "json");
function html(body, status = 200) {
  return new Response(body, { status, headers: { "Content-Type": "text/html" } });
}
__name(html, "html");
export {
  worker_default as default
};
//# sourceMappingURL=worker.js.map
