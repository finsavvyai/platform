const PADDLE_API = "https://api.paddle.com";

export interface PaddleTransaction {
  id: string;
  checkout: { url: string };
  customer_id?: string;
}

export interface PaddlePortalSession {
  urls: { general: { overview: string } };
}

export async function createPaddleTransaction(opts: {
  apiKey: string;
  priceId: string;
  userId: string;
  email?: string;
  customerId?: string;
  discountCode?: string;
  successUrl: string;
}): Promise<PaddleTransaction> {
  const body: Record<string, unknown> = {
    items: [{ price_id: opts.priceId, quantity: 1 }],
    custom_data: { user_id: opts.userId },
    checkout: { url: opts.successUrl },
  };
  if (opts.customerId) body.customer_id = opts.customerId;
  else if (opts.email) body.customer = { email: opts.email };
  if (opts.discountCode) body.discount = { code: opts.discountCode };

  const res = await fetch(`${PADDLE_API}/transactions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${opts.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json() as { data?: PaddleTransaction; error?: { detail: string } };
  if (!json.data) throw new Error(json.error?.detail ?? "Paddle transaction creation failed");
  return json.data;
}

export async function createPaddlePortalSession(opts: {
  apiKey: string;
  customerId: string;
}): Promise<string> {
  const res = await fetch(`${PADDLE_API}/customers/${opts.customerId}/portal-sessions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${opts.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const json = await res.json() as { data?: PaddlePortalSession };
  const url = json.data?.urls?.general?.overview;
  if (!url) throw new Error("Paddle portal session unavailable");
  return url;
}

export function buildPaddlePriceMap(proId: string, teamId: string): Record<string, "pro" | "team"> {
  const map: Record<string, "pro" | "team"> = {};
  if (proId) map[proId] = "pro";
  if (teamId) map[teamId] = "team";
  return map;
}

export async function verifyPaddleSignature(
  rawBody: string,
  signatureHeader: string,
  publicKeyHex: string,
): Promise<boolean> {
  try {
    const parts = Object.fromEntries(signatureHeader.split(";").map((p) => p.split("=")));
    const ts = parts["ts"];
    const h1 = parts["h1"];
    if (!ts || !h1) return false;

    const message = new TextEncoder().encode(`${ts}:${rawBody}`);
    const sigBytes = Uint8Array.from(atob(h1.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
    const keyBytes = Uint8Array.from(publicKeyHex.match(/.{2}/g)!.map((b) => parseInt(b, 16)));

    const key = await crypto.subtle.importKey("raw", keyBytes, { name: "Ed25519" }, false, ["verify"]);
    return await crypto.subtle.verify("Ed25519", key, sigBytes, message);
  } catch {
    return false;
  }
}
