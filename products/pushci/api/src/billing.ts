import { Hono } from "hono";
import type { Env } from "./types";
import { PLANS } from "./billing-types";
import { verifyJwt } from "./auth";
import { getUser, upsertUser } from "./usage";

type BillingEnv = Env & {
  LEMONSQUEEZY_API_KEY: string;
  LEMONSQUEEZY_WEBHOOK_SECRET: string;
  LEMONSQUEEZY_STORE_ID: string;
  PUSHCI_LS_VARIANT_PRO: string;
  PUSHCI_LS_VARIANT_TEAM: string;
  APP_URL: string;
};

export const billingRoutes = new Hono<{ Bindings: BillingEnv }>();

const enc = new TextEncoder();

billingRoutes.get("/plans", (c) => c.json({ plans: Object.values(PLANS) }));

billingRoutes.post("/checkout", async (c) => {
  const token = (c.req.header("authorization") ?? "").replace("Bearer ", "");
  const payload = token ? await verifyJwt(token, c.env.JWT_SECRET) : null;
  if (!payload) return c.json({ error: "unauthorized" }, 401);

  const { plan, discount_code } = await c.req.json<{ plan: "pro" | "team"; discount_code?: string }>();
  if (!plan || !["pro", "team"].includes(plan)) return c.json({ error: "invalid plan" }, 400);

  const variantId = plan === "pro" ? c.env.PUSHCI_LS_VARIANT_PRO : c.env.PUSHCI_LS_VARIANT_TEAM;
  if (!variantId) return c.json({ error: "plan not configured" }, 500);

  let user = await getUser(c.env.DB, payload.sub);
  if (!user) user = await upsertUser(c.env.DB, payload.sub, payload.login, payload.provider);

  const appUrl = c.env.APP_URL || "https://app.pushci.dev";
  const body: Record<string, unknown> = {
    data: {
      type: "checkouts",
      attributes: {
        checkout_data: {
          custom: { user_id: payload.sub },
          ...(discount_code ? { discount_code } : {}),
        },
        product_options: { redirect_url: `${appUrl}/billing?success=1` },
      },
      relationships: {
        store: { data: { type: "stores", id: c.env.LEMONSQUEEZY_STORE_ID } },
        variant: { data: { type: "variants", id: variantId } },
      },
    },
  };

  const res = await fetch("https://api.lemonsqueezy.com/v1/checkouts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${c.env.LEMONSQUEEZY_API_KEY}`,
      "Content-Type": "application/vnd.api+json",
      Accept: "application/vnd.api+json",
    },
    body: JSON.stringify(body),
  });

  const checkout = await res.json() as { data?: { attributes?: { url?: string } } };
  const url = checkout.data?.attributes?.url;
  if (!url) return c.json({ error: "checkout creation failed" }, 500);
  return c.json({ url });
});

billingRoutes.get("/portal", async (c) => {
  const token = (c.req.header("authorization") ?? "").replace("Bearer ", "");
  const payload = token ? await verifyJwt(token, c.env.JWT_SECRET) : null;
  if (!payload) return c.json({ error: "unauthorized" }, 401);

  const user = await getUser(c.env.DB, payload.sub);
  if (!user) return c.json({ error: "user not found" }, 404);

  const customerId = (user as { ls_customer_id?: string }).ls_customer_id;
  if (!customerId) return c.json({ error: "no subscription" }, 404);

  const res = await fetch(`https://api.lemonsqueezy.com/v1/customers/${customerId}`, {
    headers: { Authorization: `Bearer ${c.env.LEMONSQUEEZY_API_KEY}`, Accept: "application/vnd.api+json" },
  });
  const customer = await res.json() as { data?: { attributes?: { urls?: { customer_portal?: string } } } };
  const portalUrl = customer.data?.attributes?.urls?.customer_portal;
  if (!portalUrl) return c.json({ error: "portal unavailable" }, 500);
  return c.json({ url: portalUrl });
});

billingRoutes.post("/webhook", async (c) => {
  const rawBody = await c.req.text();
  const signature = c.req.header("X-Signature") ?? "";
  if (!signature) return c.json({ error: "missing signature" }, 400);

  const key = await crypto.subtle.importKey(
    "raw", enc.encode(c.env.LEMONSQUEEZY_WEBHOOK_SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const signed = await crypto.subtle.sign("HMAC", key, enc.encode(rawBody));
  const expected = [...new Uint8Array(signed)].map(b => b.toString(16).padStart(2, "0")).join("");
  const a = enc.encode(expected);
  const b = enc.encode(signature);
  if (a.byteLength !== b.byteLength || !(await crypto.subtle.timingSafeEqual(a, b))) {
    return c.json({ error: "invalid signature" }, 401);
  }

  let body: {
    meta: { event_name: string; custom_data?: { user_id?: string } };
    data: { id: string; attributes: { customer_id: number; variant_id: number } };
  };
  try { body = JSON.parse(rawBody); } catch { return c.json({ error: "invalid json" }, 400); }

  const event = body.meta.event_name;
  const userId = body.meta.custom_data?.user_id;
  const sub = body.data;
  const variantMap = buildVariantMap(c.env);

  switch (event) {
    case "subscription_created":
      if (userId) {
        const plan = variantMap[sub.attributes.variant_id] || "pro";
        await c.env.DB.prepare(
          "UPDATE users SET plan = ?, ls_customer_id = ?, ls_subscription_id = ?, updated_at = datetime('now') WHERE sub = ?"
        ).bind(plan, String(sub.attributes.customer_id), sub.id, userId).run();
      }
      break;
    case "subscription_updated": {
      const plan = variantMap[sub.attributes.variant_id] || "pro";
      await c.env.DB.prepare(
        "UPDATE users SET plan = ?, ls_subscription_id = ?, updated_at = datetime('now') WHERE ls_customer_id = ?"
      ).bind(plan, sub.id, String(sub.attributes.customer_id)).run();
      break;
    }
    case "subscription_cancelled":
    case "subscription_expired":
      await c.env.DB.prepare(
        "UPDATE users SET plan = 'free', ls_subscription_id = NULL, updated_at = datetime('now') WHERE ls_customer_id = ?"
      ).bind(String(sub.attributes.customer_id)).run();
      break;
    case "subscription_payment_failed":
      // Downgrade to free after failed payment — LemonSqueezy handles
      // retry logic; this fires after all retries exhausted.
      await c.env.DB.prepare(
        "UPDATE users SET plan = 'free', updated_at = datetime('now') WHERE ls_customer_id = ?"
      ).bind(String(sub.attributes.customer_id)).run();
      break;
    case "subscription_paused":
      await c.env.DB.prepare(
        "UPDATE users SET plan = 'free', updated_at = datetime('now') WHERE ls_customer_id = ?"
      ).bind(String(sub.attributes.customer_id)).run();
      break;
    case "subscription_resumed": {
      const resumedPlan = variantMap[sub.attributes.variant_id] || "pro";
      await c.env.DB.prepare(
        "UPDATE users SET plan = ?, updated_at = datetime('now') WHERE ls_customer_id = ?"
      ).bind(resumedPlan, String(sub.attributes.customer_id)).run();
      break;
    }
  }

  return c.json({ received: true });
});

function buildVariantMap(env: BillingEnv): Record<number, "pro" | "team"> {
  const map: Record<number, "pro" | "team"> = {};
  if (env.PUSHCI_LS_VARIANT_PRO) map[parseInt(env.PUSHCI_LS_VARIANT_PRO, 10)] = "pro";
  if (env.PUSHCI_LS_VARIANT_TEAM) map[parseInt(env.PUSHCI_LS_VARIANT_TEAM, 10)] = "team";
  return map;
}
