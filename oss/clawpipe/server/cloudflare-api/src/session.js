/** Session management — cookie-based sessions backed by KV. */

import { validateApiKey } from "./auth.js";

const SESSION_COOKIE = "fsa_session";
const SESSION_TTL = 86400 * 7; // 7 days

export async function createSession(apiKey, keyData, env) {
  const sessionId = crypto.randomUUID();
  const session = {
    apiKey,
    name: keyData.name,
    tier: keyData.tier,
    created: new Date().toISOString(),
  };
  await env.API_KEYS.put(`__session:${sessionId}`, JSON.stringify(session), {
    expirationTtl: SESSION_TTL,
  });
  return sessionId;
}

export async function getSession(request, env) {
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
  if (!match) return null;

  const sessionId = match[1];
  const session = await env.API_KEYS.get(`__session:${sessionId}`, {
    type: "json",
  });
  return session;
}

export function setSessionCookie(sessionId) {
  return `${SESSION_COOKIE}=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_TTL}`;
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

export async function handleLogin(request, env, cors) {
  const body = await request.json();
  const apiKey = body.api_key || body.apiKey || "";

  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "API key required" }),
      { status: 400, headers: { "Content-Type": "application/json", ...cors } },
    );
  }

  const fakeReq = new Request(request.url, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const auth = await validateApiKey(fakeReq, env);
  if (!auth.valid) {
    return new Response(
      JSON.stringify({ error: auth.error }),
      { status: 401, headers: { "Content-Type": "application/json", ...cors } },
    );
  }

  const sessionId = await createSession(apiKey, auth.keyData, env);
  return new Response(
    JSON.stringify({ success: true, name: auth.keyData.name, tier: auth.keyData.tier }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": setSessionCookie(sessionId),
        ...cors,
      },
    },
  );
}

export async function handleLogout(env, cors) {
  return new Response(
    JSON.stringify({ success: true }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": clearSessionCookie(),
        ...cors,
      },
    },
  );
}
