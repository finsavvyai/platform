// sdlc-cc-cf-gw — Cloudflare Worker that scrubs every prompt going
// through Cloudflare AI Gateway. Replace your AI Gateway URL with
// this Worker's URL in your app and PII never reaches the gateway
// (or any upstream LLM) in raw form.
//
// Flow:
//
//   Your app
//      │ POST /v1/<acct>/<gw>/<provider>/<path>   (Anthropic / OpenAI / etc.)
//      ▼
//   sdlc-cc-cf-gw  (this Worker)
//      │ scrub user-content fields via sdlc.cc /v1/dlp/scrub
//      ▼
//   real CF AI Gateway → upstream LLM
//
// Scope: catches the `messages[].content` field for both Anthropic
// and OpenAI shapes. Doesn't recursively walk tool_use arguments —
// those should be tightened in a follow-up. Streaming requests are
// passed through unchanged today; SSE scrubbing is non-trivial and
// belongs in sdlc.cc proper, not at the edge.

export interface Env {
  SDLC_API_KEY: string;       // secret — sk_sdlc_*
  SDLC_SCRUB_URL: string;     // var    — full URL to /v1/dlp/scrub
  CF_AI_GATEWAY_URL: string;  // secret — https://gateway.ai.cloudflare.com/v1/ACCT/GW
}

export default {
  async fetch(req: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);

    // Only POST has a body worth scrubbing; everything else
    // (e.g. /health, model-list GETs) passes through unchanged.
    if (req.method !== "POST") {
      return forward(req, env, null);
    }

    // Read the body. We must replace it on the outgoing request,
    // so consuming the original here is fine — `forward` builds a
    // fresh Request.
    let body: string;
    try {
      body = await req.text();
    } catch {
      return new Response("bad request body", { status: 400 });
    }

    // If it's not JSON, forward unchanged. Anthropic/OpenAI request
    // shapes are always JSON; other content types are pass-through
    // (file uploads, multipart, etc.).
    let payload: unknown;
    try {
      payload = JSON.parse(body);
    } catch {
      return forward(req, env, body);
    }

    // Streaming requests are pass-through today. Identifiable by
    // either the `stream:true` body field (Anthropic/OpenAI) or the
    // `text/event-stream` Accept header. SSE scrubbing requires
    // buffer-then-emit semantics that don't compose well at the
    // edge — handle in sdlc.cc proper.
    if (looksStreaming(payload, req)) {
      return forward(req, env, body);
    }

    // Walk + scrub the well-known content fields. Mutates payload
    // in place because the structure is owned by this request only.
    const scrubbed = await scrubPayload(payload, env);

    return forward(req, env, JSON.stringify(scrubbed));
  },
};

// forward proxies the request (with optionally rewritten body) to
// the customer's real AI Gateway URL. Path + query passes through;
// auth headers (anthropic-version, x-api-key, Authorization) pass
// through; content-length is recomputed by fetch().
async function forward(req: Request, env: Env, body: BodyInit | null): Promise<Response> {
  const inUrl = new URL(req.url);
  const targetBase = (env.CF_AI_GATEWAY_URL || "").replace(/\/+$/, "");
  const target = targetBase + inUrl.pathname + inUrl.search;

  const headers = new Headers(req.headers);
  headers.delete("host");
  headers.delete("content-length"); // let fetch() recompute

  const upstream = new Request(target, {
    method: req.method,
    headers,
    body: body ?? (req.method === "GET" || req.method === "HEAD" ? null : await req.arrayBuffer()),
  });
  return fetch(upstream);
}

function looksStreaming(payload: unknown, req: Request): boolean {
  const accept = req.headers.get("accept") || "";
  if (accept.includes("text/event-stream")) return true;
  if (typeof payload === "object" && payload !== null && "stream" in payload &&
      (payload as Record<string, unknown>).stream === true) {
    return true;
  }
  return false;
}

// scrubPayload walks the two LLM-API shapes we know about and runs
// /v1/dlp/scrub against any user-content string it finds.
//
//   Anthropic Messages:
//     { messages: [{ role, content: "..." | [{type:"text", text}] }],
//       system: "..." }
//   OpenAI Chat Completions:
//     { messages: [{ role, content: "..." | [{type:"text", text}] }] }
//
// Other shapes pass through unchanged. New shapes get added to this
// function rather than recursive-walking arbitrary JSON — false
// positives on innocent fields would be worse than missing a new
// API.
async function scrubPayload(payload: unknown, env: Env): Promise<unknown> {
  if (typeof payload !== "object" || payload === null) return payload;
  const p = payload as Record<string, unknown>;

  // Anthropic / OpenAI: top-level system prompt
  if (typeof p.system === "string") {
    p.system = await callScrub(p.system, env);
  }

  // messages[].content — string OR array of content blocks
  if (Array.isArray(p.messages)) {
    for (const m of p.messages as Record<string, unknown>[]) {
      if (typeof m.content === "string") {
        m.content = await callScrub(m.content, env);
      } else if (Array.isArray(m.content)) {
        for (const block of m.content as Record<string, unknown>[]) {
          if (block.type === "text" && typeof block.text === "string") {
            block.text = await callScrub(block.text, env);
          }
        }
      }
    }
  }

  return p;
}

async function callScrub(text: string, env: Env): Promise<string> {
  if (!text.trim()) return text;
  try {
    const resp = await fetch(env.SDLC_SCRUB_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${env.SDLC_API_KEY}`,
      },
      body: JSON.stringify({ text }),
    });
    if (!resp.ok) {
      // Fail open: log + pass through. Failing closed at the edge
      // would brick every customer request on a scrub-API outage.
      // The customer's audit dashboard will surface "0 redactions
      // tonight" which is the correct signal that scrubbing was
      // bypassed.
      console.error(`sdlc.cc scrub HTTP ${resp.status}`);
      return text;
    }
    const data = await resp.json<{ clean_text?: string }>();
    return data.clean_text ?? text;
  } catch (e) {
    console.error("sdlc.cc scrub error:", e);
    return text;
  }
}
