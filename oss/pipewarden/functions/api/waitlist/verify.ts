import { Env, cors, json } from "../_lib";

// GET /api/waitlist/verify?token=<hex>
// Marks the associated waitlist entry verified, then redirects the visitor
// to /?verified=1. Invalid / expired tokens return 410.
export const onRequestOptions: PagesFunction<Env> = ({ request }) =>
  new Response(null, { status: 204, headers: cors(request.headers.get("Origin")) });

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const origin = request.headers.get("Origin");
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";

  if (!/^[a-f0-9]{32}$/.test(token)) {
    return json(400, { error: "invalid_token" }, origin);
  }

  if (!env.WAITLIST_KV) {
    return json(503, { error: "kv_not_configured" }, origin);
  }

  const email = await env.WAITLIST_KV.get(`verify:${token}`);
  if (!email) {
    return json(410, { error: "token_expired_or_unknown" }, origin);
  }

  const entryRaw = await env.WAITLIST_KV.get(`email:${email}`);
  if (!entryRaw) {
    await env.WAITLIST_KV.delete(`verify:${token}`);
    return json(410, { error: "entry_missing" }, origin);
  }

  let entry: Record<string, unknown>;
  try { entry = JSON.parse(entryRaw); } catch { return json(500, { error: "entry_corrupt" }, origin); }

  entry.verified = true;
  entry.verified_at = new Date().toISOString();
  delete entry.verify_token;

  await env.WAITLIST_KV.put(`email:${email}`, JSON.stringify(entry), {
    metadata: { tier: entry.tier, verified: true },
  });
  await env.WAITLIST_KV.delete(`verify:${token}`);

  // Humans hitting the link from email expect a page, not JSON.
  // Redirect to the marketing site with a flag the landing can render on.
  const accept = request.headers.get("Accept") ?? "";
  if (accept.includes("text/html")) {
    return Response.redirect(new URL("/?verified=1", request.url).toString(), 302);
  }
  return json(200, { ok: true, verified: true, email, tier: entry.tier }, origin);
};
