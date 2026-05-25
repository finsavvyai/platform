import type { NextRequest } from "next/server";
import {
  CheckoutPlan,
  getCheckoutFallbackTarget,
  getCheckoutStoreId,
  getCheckoutVariantId,
  getSiteUrl,
} from "../../../lib/checkout";

export const config = {
  runtime: "edge",
};

type CheckoutRequest = {
  plan?: CheckoutPlan;
  email?: string;
  name?: string;
  company?: string;
  source?: string;
  currentPath?: string;
};

const isPlan = (value: unknown): value is CheckoutPlan =>
  value === "free" ||
  value === "team" ||
  value === "business" ||
  value === "enterprise";

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
    const payload = (await req.json()) as CheckoutRequest;
    if (!isPlan(payload.plan)) {
      return json(400, { error: "Invalid plan" });
    }

    const { plan } = payload;
    const fallbackUrl = getCheckoutFallbackTarget(plan);

    if (plan === "free") {
      return json(200, { url: fallbackUrl, source: "fallback-free-github" });
    }
    if (plan === "enterprise") {
      return json(200, { url: fallbackUrl, source: "fallback-enterprise" });
    }

    const apiKey = process.env.LEMONSQUEEZY_API_KEY;
    const storeId = getCheckoutStoreId();
    const variantId = getCheckoutVariantId(plan);

    // If dynamic checkout is not fully configured, rely on configured fallback.
    if (!apiKey || !storeId || !variantId) {
      return json(200, {
        url: fallbackUrl,
        source: "fallback-config",
        reason: "missing_dynamic_checkout_configuration",
      });
    }

    const successRedirectUrl = `${getSiteUrl()}/checkout/success?plan=${encodeURIComponent(plan)}`;
    const customData = {
      source: payload.source || "sdlc.cc",
      plan,
      company: payload.company || "",
      currentPath: payload.currentPath || "",
      timestamp: new Date().toISOString(),
    };

    const checkoutPayload = {
      data: {
        type: "checkouts",
        attributes: {
          checkout_data: {
            email: payload.email || undefined,
            name: payload.name || undefined,
            custom: customData,
          },
          checkout_options: {
            embed: false,
            media: true,
            logo: true,
          },
          product_options: {
            redirect_url: successRedirectUrl,
          },
        },
        relationships: {
          store: { data: { type: "stores", id: storeId } },
          variant: { data: { type: "variants", id: variantId } },
        },
      },
    };

    const lemonResponse = await fetch("https://api.lemonsqueezy.com/v1/checkouts", {
      method: "POST",
      headers: {
        Accept: "application/vnd.api+json",
        "Content-Type": "application/vnd.api+json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(checkoutPayload),
    });

    if (!lemonResponse.ok) {
      const errorText = await lemonResponse.text();
      console.error("Lemon Squeezy checkout create failed", {
        status: lemonResponse.status,
        body: errorText,
      });
      return json(200, {
        url: fallbackUrl,
        source: "fallback-on-create-error",
        reason: "checkout_create_failed",
      });
    }

    const lemonData = (await lemonResponse.json()) as {
      data?: { attributes?: { url?: string } };
    };
    const checkoutUrl = lemonData?.data?.attributes?.url;
    if (!checkoutUrl) {
      return json(200, {
        url: fallbackUrl,
        source: "fallback-on-missing-url",
        reason: "missing_checkout_url",
      });
    }

    return json(200, {
      url: checkoutUrl,
      source: "lemonsqueezy-dynamic-checkout",
    });
  } catch (error) {
    console.error("Checkout create API error", error);
    return json(500, { error: "Failed to create checkout" });
  }
}
