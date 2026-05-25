import type { NextRequest } from "next/server";

export const config = {
  runtime: "edge",
};

type LemonWebhookPayload = {
  meta?: {
    event_name?: string;
    custom_data?: Record<string, unknown>;
  };
  data?: {
    id?: string;
    type?: string;
    attributes?: Record<string, unknown>;
  };
};

const encoder = new TextEncoder();

const toHex = (buffer: ArrayBuffer): string =>
  Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

const safeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
};

const signBody = async (secret: string, body: string): Promise<string> => {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  return toHex(signature);
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

export default async function handler(req: NextRequest) {
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const signingSecret = process.env.LEMONSQUEEZY_SIGNING_SECRET;
    if (!signingSecret) {
      console.error("Webhook received without configured signing secret");
      return json(500, { error: "Webhook signing secret is not configured" });
    }

    const signatureHeader = req.headers.get("X-Signature") || "";
    const rawBody = await req.text();
    const computedSignature = await signBody(signingSecret, rawBody);

    if (!safeEqual(signatureHeader.toLowerCase(), computedSignature.toLowerCase())) {
      console.warn("Webhook signature validation failed");
      return json(401, { error: "Invalid signature" });
    }

    const payload = JSON.parse(rawBody) as LemonWebhookPayload;
    const eventName = payload?.meta?.event_name || "unknown";
    const objectType = payload?.data?.type || "unknown";
    const objectId = payload?.data?.id || "unknown";
    const customData = payload?.meta?.custom_data as Record<string, unknown> | undefined;

    console.log("Lemon Squeezy webhook accepted", {
      eventName,
      objectType,
      objectId,
      plan: customData?.plan,
    });

    // Forward plan changes to the proxy-worker admin endpoint so effective
    // tier flips on the next request. No-op when not configured.
    const adminBase = process.env.ADMIN_PROXY_URL;
    const adminSecret = process.env.ADMIN_HMAC_SECRET;
    const userId = typeof customData?.userId === "string" ? customData.userId : "";
    const plan = typeof customData?.plan === "string" ? customData.plan : "";

    if (adminBase && adminSecret && userId && plan && isPlanChangeEvent(eventName)) {
      try {
        const body = JSON.stringify({
          userId,
          plan: plan === "cancelled" ? "free" : plan,
          source: "webhook",
          reference: objectId,
        });
        const signature = await signBody(adminSecret, body);
        const res = await fetch(`${adminBase.replace(/\/$/, "")}/admin/plans`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Admin-Signature": `sha256=${signature}`,
          },
          body,
        });
        if (!res.ok) {
          console.warn("admin/plans forward non-2xx", { status: res.status });
        }
      } catch (forwardErr) {
        console.warn("admin/plans forward failed", forwardErr);
      }
    }

    return json(200, { ok: true });
  } catch (error) {
    console.error("Lemon Squeezy webhook handling error", error);
    return json(500, { error: "Webhook processing failed" });
  }
}

function isPlanChangeEvent(eventName: string): boolean {
  return (
    eventName === "subscription_created" ||
    eventName === "subscription_updated" ||
    eventName === "subscription_resumed" ||
    eventName === "subscription_cancelled" ||
    eventName === "order_created"
  );
}
