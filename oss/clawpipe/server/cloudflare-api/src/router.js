/** Request routing — map URL paths to handler logic. */

import { corsHeaders, json, SECURITY_HEADERS } from "./middleware.js";
import { healthCheck } from "./health.js";
import { handleLogout } from "./session.js";
import { DASHBOARD_HTML } from "./pages/dashboard.js";
import { CHAT_HTML } from "./pages/chat.js";
import { LOGIN_HTML } from "./pages/login.js";
import { LANDING_HTML } from "./pages/landing.js";
import {
  handleModels,
  handleChatCompletions,
  handleLoginRoute,
  handleAdminRoute,
} from "./handlers.js";

function serveHtml(html, cors) {
  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html;charset=UTF-8",
      "Cache-Control": "public, max-age=300",
      ...cors,
      ...SECURITY_HEADERS,
    },
  });
}

export async function handleRequest(request, env) {
  const url = new URL(request.url);
  const cors = corsHeaders(env);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  try {
    const p = url.pathname;

    if (p === "/") return serveHtml(LANDING_HTML, cors);
    if (p === "/info") return json({ service: "FinSavvyAI LLM Gateway", version: "5.0.0" }, 200, cors);
    if (p === "/health") {
      const h = healthCheck(env);
      return json(h, h.status === "healthy" ? 200 : 503, cors);
    }
    if (p === "/login" && request.method === "GET") return serveHtml(LOGIN_HTML, cors);
    if (p === "/login" && request.method === "POST") return await handleLoginRoute(request, env, cors);
    if (p === "/logout" && request.method === "POST") return await handleLogout(env, cors);
    if (p === "/dashboard" || p === "/dashboard/") return serveHtml(DASHBOARD_HTML, cors);
    if (p === "/chat" || p === "/chat/") return serveHtml(CHAT_HTML, cors);
    if (p === "/v1/models" && request.method === "GET") return await handleModels(request, env, cors);
    if (p.startsWith("/admin/")) return await handleAdminRoute(request, url, env, cors);
    if (p === "/v1/chat/completions") return await handleChatCompletions(request, env, cors);

    return json({ error: "Not found" }, 404, cors);
  } catch (error) {
    console.error("Worker error:", error.message);
    return json(
      { error: "Provider error", message: error.message },
      502,
      corsHeaders(env),
    );
  }
}
