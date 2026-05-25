// Test endpoint: verify a channel connection is healthy.
//
// Design note: "test" used to mean "send an actual message to the
// recipient you'd get on a real run." That broke for Telegram because
// the recipient for Telegram is a chat_id we don't know until the bot
// has been messaged, and the config stored `botUsername` which the
// Telegram API refuses as a destination. It also produced opaque
// "Delivery failed" errors for webhooks when the endpoint simply
// wasn't configured right.
//
// New design: for providers where we have a credential-validation
// endpoint that doesn't require a recipient (Telegram getMe, Slack
// auth.test, Discord users/@me), we use that. For providers that
// NEED a recipient (webhook, email, whatsapp), we still dispatch a
// real message but return the provider's specific error text so the
// user can debug. No more "Delivery failed" dead ends.

import { Hono } from "hono";
import type { Env } from "./types";
import type { ChannelConnection } from "./channel-types";
import { verifyJwt } from "./auth";
import { dispatch } from "./channel-dispatch";

export const channelTestRoute = new Hono<{ Bindings: Env }>();

interface TestResult {
  success: boolean;
  error?: string;
  detail?: string;
}

/** POST /:id/test — verify channel credentials and delivery path. */
channelTestRoute.post("/:id/test", async (c) => {
  const token = (c.req.header("authorization") ?? "").replace("Bearer ", "");
  const user = token ? await verifyJwt(token, c.env.JWT_SECRET) : null;
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const id = c.req.param("id");
  const row = await c.env.DB.prepare(
    `SELECT * FROM channel_connections WHERE id=? AND user_id=? AND status='active'`,
  ).bind(id, user.sub).first<ChannelConnection>();

  if (!row) return c.json({ error: "channel not found" }, 404);

  const result = await testChannel(row);
  const status = result.success ? 200 : 502;
  return c.json(result, status);
});

// testChannel routes to the right provider-specific test. Split out
// so each provider can own its verification logic without growing
// the HTTP handler into a monster switch.
async function testChannel(conn: ChannelConnection): Promise<TestResult> {
  try {
    switch (conn.channel_type) {
      case "telegram":
        return await testTelegram(conn);
      case "slack":
        return await testSlack(conn);
      case "discord":
        return await testDiscord(conn);
      case "webhook":
        return await testWebhookDispatch(conn);
      case "whatsapp":
      case "email":
        return await testViaDispatch(conn);
      default:
        return { success: false, error: "Unsupported channel type for test" };
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

// testTelegram calls the bot's own getMe endpoint. No chat_id needed,
// no "who do I send to" problem. A healthy bot token returns
// { ok: true, result: { username, first_name, ... } }.
async function testTelegram(conn: ChannelConnection): Promise<TestResult> {
  const botToken = conn.access_token;
  if (!botToken) return { success: false, error: "Telegram bot token missing from stored credentials" };
  const res = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
  const body = await res.json<{ ok: boolean; result?: { username?: string }; description?: string }>();
  if (!res.ok || !body.ok) {
    return { success: false, error: body.description || `Telegram API returned ${res.status}` };
  }
  return { success: true, detail: `Bot token valid (@${body.result?.username ?? "unknown"})` };
}

// testSlack uses auth.test — validates the token + returns team info
// without needing to message a channel.
async function testSlack(conn: ChannelConnection): Promise<TestResult> {
  const token = conn.access_token;
  if (!token) return { success: false, error: "Slack token missing" };
  const res = await fetch("https://slack.com/api/auth.test", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json<{ ok: boolean; team?: string; error?: string }>();
  if (!body.ok) return { success: false, error: body.error || `Slack API returned ${res.status}` };
  return { success: true, detail: `Token valid for team ${body.team ?? "unknown"}` };
}

// testDiscord hits users/@me which works for both Bot tokens and
// OAuth tokens without touching a guild.
async function testDiscord(conn: ChannelConnection): Promise<TestResult> {
  const token = conn.access_token;
  if (!token) return { success: false, error: "Discord token missing" };
  const res = await fetch("https://discord.com/api/v10/users/@me", {
    headers: { Authorization: `Bot ${token}` },
  });
  if (!res.ok) {
    const body = await res.text();
    return { success: false, error: `Discord API returned ${res.status}: ${body.slice(0, 200)}` };
  }
  const body = await res.json<{ username?: string }>();
  return { success: true, detail: `Bot token valid (${body.username ?? "unknown"})` };
}

// testWebhookDispatch POSTs a test payload to the configured URL and
// returns the endpoint's response body on failure so the user can
// actually debug their own webhook implementation.
async function testWebhookDispatch(conn: ChannelConnection): Promise<TestResult> {
  const config = JSON.parse(conn.config || "{}");
  const url = config.callbackUrl as string | undefined;
  if (!url) return { success: false, error: "No callbackUrl configured for this webhook" };

  const payload = {
    text: "PushCI webhook test — your channel is connected and working.",
    senderId: "test",
    timestamp: new Date().toISOString(),
  };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Secret": conn.webhook_secret ?? "",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.text();
      return {
        success: false,
        error: `${url} returned ${res.status}`,
        detail: body.slice(0, 200),
      };
    }
    return { success: true, detail: `POST ${url} ${res.status}` };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Network error",
      detail: `Could not reach ${url}`,
    };
  }
}

// testViaDispatch is the fallback for providers where the existing
// dispatch function is the right path (whatsapp, email) — we need a
// recipient and there's no free read-only verification endpoint.
async function testViaDispatch(conn: ChannelConnection): Promise<TestResult> {
  const testMessage = "PushCI test — your channel is connected and working.";
  const config = JSON.parse(conn.config || "{}");
  const recipient =
    conn.channel_type === "email" ? (config.to || "") :
    conn.channel_type === "whatsapp" ? (config.phoneNumberId || "") : "";
  if (!recipient) {
    return { success: false, error: `No test recipient configured for ${conn.channel_type}` };
  }
  const ok = await dispatch(conn, testMessage, recipient);
  return ok
    ? { success: true }
    : { success: false, error: `Delivery to ${recipient} failed — check your ${conn.channel_type} credentials and endpoint config` };
}
