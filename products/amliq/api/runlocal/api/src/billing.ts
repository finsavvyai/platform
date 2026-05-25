import { Hono } from "hono";
import type { Env } from "./types";
import type { CheckoutRequest } from "./billing-types";
import { getPriceEnvKey } from "./billing-types";

type BillingEnv = Env & {
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  APP_URL: string;
  [key: string]: unknown;
};

export const billingRoutes = new Hono<{ Bindings: BillingEnv }>();

const enc = new TextEncoder();

async function verifyStripeSig(payload: string, header: string, secret: string): Promise<boolean> {
  const pairs: Record<string, string> = {};
  for (const p of header.split(",")) { const [k, v] = p.split("="); pairs[k] = v; }
  if (!pairs["t"] || !pairs["v1"]) return false;
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signed = await crypto.subtle.sign("HMAC", key, enc.encode(`${pairs["t"]}.${payload}`));
  const expected = [...new Uint8Array(signed)].map(b => b.toString(16).padStart(2, "0")).join("");
  return expected === pairs["v1"];
}

async function stripePost(key: string, path: string, body: Record<string, string>) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
  return res.json() as Promise<Record<string, unknown>>;
}

billingRoutes.post("/checkout", async (c) => {
  const { plan, period } = await c.req.json<CheckoutRequest>();
  if (!plan || !period) return c.json({ error: "plan and period required" }, 400);
  if (!["pro", "team"].includes(plan)) return c.json({ error: "invalid plan" }, 400);
  if (!["monthly", "annual"].includes(period)) return c.json({ error: "invalid period" }, 400);
  const priceId = (c.env as Record<string, string>)[getPriceEnvKey(plan, period)];
  if (!priceId) return c.json({ error: "price not configured" }, 500);
  const appUrl = c.env.APP_URL || "https://pushci.dev";
  const session = await stripePost(c.env.STRIPE_SECRET_KEY, "/checkout/sessions", {
    mode: "subscription",
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": "1",
    success_url: `${appUrl}/billing?success=1`,
    cancel_url: `${appUrl}/billing?cancelled=1`,
  });
  return c.json({ url: session.url as string });
});

billingRoutes.get("/portal", async (c) => {
  const customerId = c.req.query("customer_id");
  if (!customerId) return c.json({ error: "customer_id required" }, 400);
  const appUrl = c.env.APP_URL || "https://pushci.dev";
  const session = await stripePost(c.env.STRIPE_SECRET_KEY, "/billing_portal/sessions", {
    customer: customerId, return_url: `${appUrl}/billing`,
  });
  return c.json({ url: session.url as string });
});

billingRoutes.post("/webhook", async (c) => {
  const body = await c.req.text();
  const sig = c.req.header("stripe-signature") ?? "";
  if (!sig) return c.json({ error: "missing signature" }, 400);
  if (!await verifyStripeSig(body, sig, c.env.STRIPE_WEBHOOK_SECRET)) {
    return c.json({ error: "invalid signature" }, 401);
  }
  const event = JSON.parse(body) as { type: string; data: { object: Record<string, unknown> } };
  switch (event.type) {
    case "checkout.session.completed": {
      const obj = event.data.object;
      const userId = obj.client_reference_id as string;
      if (userId) {
        await c.env.DB.prepare("UPDATE users SET plan = ?, stripe_customer_id = ? WHERE id = ?")
          .bind("pro", obj.customer, userId).run();
      }
      break;
    }
    case "customer.subscription.updated": {
      const sub = event.data.object;
      const plan = (sub.status as string) === "active" ? "pro" : "free";
      await c.env.DB.prepare("UPDATE users SET plan = ? WHERE stripe_customer_id = ?")
        .bind(plan, sub.customer as string).run();
      break;
    }
    case "customer.subscription.deleted": {
      await c.env.DB.prepare("UPDATE users SET plan = 'free' WHERE stripe_customer_id = ?")
        .bind(event.data.object.customer as string).run();
      break;
    }
  }
  return c.json({ received: true });
});
