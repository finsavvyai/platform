/** Route handlers — auth-wrapped request processing for each endpoint. */

import { json, rateLimitHeaders } from "./middleware.js";
import {
  FIXED_ROUTE_LIMITS,
  checkFixedRateLimit,
  checkRateLimit,
  getClientIdentifier,
  validateApiKey,
} from "./auth.js";
import { handleAdmin } from "./admin.js";
import {
  resolveProvider,
  openaiChat,
  anthropicChat,
  ollamaChat,
} from "./providers.js";
import { listModels } from "./models.js";
import { handleLogin } from "./session.js";

function rateLimitExceeded(cors, rl, message) {
  return json(
    { error: "Rate limit exceeded", message },
    429,
    { ...cors, ...rateLimitHeaders(rl) },
  );
}

function withHeaders(response, extraHeaders) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(extraHeaders)) {
    headers.set(key, value);
  }
  return new Response(response.body, { status: response.status, headers });
}

export async function handleModels(request, env, cors) {
  const authHeader = request.headers.get("Authorization") || "";
  const xApiKey = request.headers.get("X-API-Key") || "";
  let rl;
  if (authHeader || xApiKey) {
    const auth = await validateApiKey(request, env);
    if (!auth.valid)
      return json(
        { error: "Authentication failed", message: auth.error },
        401,
        cors,
      );
    rl = await checkRateLimit(auth.apiKey, auth.keyData.tier, env, { bucket: "models" });
  } else {
    rl = await checkFixedRateLimit(
      getClientIdentifier(request),
      FIXED_ROUTE_LIMITS.modelsPublic.rpm,
      env,
      { bucket: "models-public" },
    );
  }

  if (!rl.allowed) {
    return rateLimitExceeded(
      cors,
      rl,
      `Limit: ${rl.limit} model-list requests/min. Retry in ${rl.retryAfter}s.`,
    );
  }

  return json(await listModels(env), 200, { ...cors, ...rateLimitHeaders(rl) });
}

export async function handleChatCompletions(request, env, cors) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405, cors);
  }

  const auth = await validateApiKey(request, env);
  if (!auth.valid) {
    return json(
      { error: "Authentication failed", message: auth.error },
      401,
      cors,
    );
  }

  const rl = await checkRateLimit(auth.apiKey, auth.keyData.tier, env);
  if (!rl.allowed) {
    return rateLimitExceeded(
      cors,
      rl,
      `Limit: ${rl.limit} chat requests/min. Retry in ${rl.retryAfter}s.`,
    );
  }
  const rlH = rateLimitHeaders(rl);

  const body = await request.json();
  if (
    !body.messages ||
    !Array.isArray(body.messages) ||
    body.messages.length === 0
  ) {
    return json(
      { error: "Invalid request", message: "'messages' required" },
      400,
      cors,
    );
  }
  if (!body.model) {
    return json(
      { error: "Invalid request", message: "'model' required" },
      400,
      cors,
    );
  }

  const providerName = resolveProvider(body.model);
  if (!providerName) {
    return json(
      { error: "Unknown model", message: `No provider for '${body.model}'` },
      400,
      cors,
    );
  }

  const providerFn =
    providerName === "openai"
      ? openaiChat
      : providerName === "anthropic"
        ? anthropicChat
        : providerName === "ollama"
          ? ollamaChat
          : null;

  if (!providerFn) {
    return json({ error: "Provider not available" }, 503, cors);
  }

  const resp = await providerFn(body, env, body.stream === true);
  const h = new Headers(resp.headers);
  for (const [k, v] of Object.entries({ ...cors, ...rlH })) h.set(k, v);
  return new Response(resp.body, { status: resp.status, headers: h });
}

export async function handleLoginRoute(request, env, cors) {
  const rl = await checkFixedRateLimit(
    getClientIdentifier(request),
    FIXED_ROUTE_LIMITS.login.rpm,
    env,
    { bucket: "login" },
  );
  if (!rl.allowed) {
    return rateLimitExceeded(
      cors,
      rl,
      `Limit: ${rl.limit} login attempts/min. Retry in ${rl.retryAfter}s.`,
    );
  }

  const resp = await handleLogin(request, env, cors);
  return withHeaders(resp, rateLimitHeaders(rl));
}

export async function handleAdminRoute(request, url, env, cors) {
  const rl = await checkFixedRateLimit(
    getClientIdentifier(request),
    FIXED_ROUTE_LIMITS.admin.rpm,
    env,
    { bucket: "admin" },
  );
  if (!rl.allowed) {
    return rateLimitExceeded(
      cors,
      rl,
      `Limit: ${rl.limit} admin requests/min. Retry in ${rl.retryAfter}s.`,
    );
  }

  const resp = await handleAdmin(request, url, env, cors);
  return withHeaders(resp, rateLimitHeaders(rl));
}
