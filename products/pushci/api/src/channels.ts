// Channel connection management: connect, list, disconnect messaging platforms.

import { Hono } from "hono";
import type { Env } from "./types";
import type { ChannelConnection, ChannelType } from "./channel-types";
import { verifyJwt } from "./auth";

const VALID_TYPES: ChannelType[] = ["whatsapp", "slack", "discord", "telegram", "webhook", "email"];

export const channelRoutes = new Hono<{ Bindings: Env }>();

async function getUser(c: { req: { header: (n: string) => string | undefined }; env: Env }) {
  const token = (c.req.header("authorization") ?? "").replace("Bearer ", "");
  return token ? verifyJwt(token, c.env.JWT_SECRET) : null;
}

/** POST /connect — register a new channel connection. */
channelRoutes.post("/connect", async (c) => {
  const user = await getUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const body = await c.req.json<{
    channelType: ChannelType;
    label?: string;
    credentials: Record<string, string>;
    defaultAgent?: string;
  }>();

  if (!VALID_TYPES.includes(body.channelType)) {
    return c.json({ error: `invalid channel: ${body.channelType}` }, 400);
  }

  const id = crypto.randomUUID();
  const webhookUrl = `${c.env.APP_URL}/channels/incoming/${id}`;
  const webhookSecret = crypto.randomUUID();
  const config = buildConfig(body.channelType, body.credentials);
  const externalId = extractExternalId(body.channelType, body.credentials);
  const externalName = channelDisplayName(body.channelType);

  await c.env.DB.prepare(
    `INSERT INTO channel_connections
     (id,user_id,channel_type,label,status,external_id,external_name,
      access_token,webhook_url,webhook_secret,config,default_agent,connected_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))`
  ).bind(
    id, user.sub, body.channelType, body.label ?? null, "active",
    externalId, externalName,
    body.channelType === "email" ? (c.env.RESEND_API_KEY || body.credentials.accessToken || null) : (body.credentials.accessToken ?? null),
    webhookUrl, webhookSecret, JSON.stringify(config),
    body.defaultAgent ?? "run",
  ).run();

  return c.json({
    id,
    channelType: body.channelType,
    webhookUrl,
    webhookSecret,
    status: "active",
    nextSteps: setupInstructions(body.channelType, webhookUrl, webhookSecret),
  }, 201);
});

/** GET / — list user's channel connections. */
channelRoutes.get("/", async (c) => {
  const user = await getUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const rows = await c.env.DB.prepare(
    `SELECT id,channel_type,label,status,external_name,message_count,
            last_message_at,connected_at,created_at
     FROM channel_connections WHERE user_id=? ORDER BY created_at DESC`
  ).bind(user.sub).all<ChannelConnection>();

  return c.json({ connections: rows.results });
});

/** DELETE /:id — revoke a channel connection. */
channelRoutes.delete("/:id", async (c) => {
  const user = await getUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const result = await c.env.DB.prepare(
    `UPDATE channel_connections SET status='revoked' WHERE id=? AND user_id=?`
  ).bind(c.req.param("id"), user.sub).run();

  if (!result.meta.changes) return c.json({ error: "not found" }, 404);
  return c.json({ ok: true });
});

/** GET /:id/messages — message history for a connection. */
channelRoutes.get("/:id/messages", async (c) => {
  const user = await getUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const limit = Math.min(Number(c.req.query("limit") ?? "50"), 200);
  const rows = await c.env.DB.prepare(
    `SELECT m.* FROM channel_messages m
     JOIN channel_connections cc ON cc.id = m.connection_id
     WHERE m.connection_id=? AND cc.user_id=?
     ORDER BY m.created_at DESC LIMIT ?`
  ).bind(c.req.param("id"), user.sub, limit).all();

  return c.json({ messages: rows.results });
});

function buildConfig(type: ChannelType, creds: Record<string, string>) {
  switch (type) {
    case "whatsapp": return { phoneNumberId: creds.phoneNumberId };
    case "slack": return { teamId: creds.teamId, channelId: creds.channelId };
    case "discord": return { guildId: creds.guildId, applicationId: creds.applicationId };
    case "telegram": return { botUsername: creds.botUsername };
    case "webhook": return { callbackUrl: creds.callbackUrl };
    case "email": return { to: creds.to, from: creds.from || "PushCI <notifications@pushci.dev>", subject: creds.subject };
  }
}

function extractExternalId(type: ChannelType, creds: Record<string, string>) {
  switch (type) {
    case "whatsapp": return creds.phoneNumberId ?? null;
    case "slack": return creds.teamId ?? null;
    case "discord": return creds.guildId ?? null;
    case "telegram": return creds.botToken ? creds.botToken.split(":")[0] : null;
    case "webhook": return creds.callbackUrl ?? null;
    case "email": return creds.to ?? null;
  }
}

function channelDisplayName(type: ChannelType) {
  const names: Record<ChannelType, string> = {
    whatsapp: "WhatsApp Business",
    slack: "Slack Workspace",
    discord: "Discord Server",
    telegram: "Telegram Bot",
    webhook: "Custom Webhook",
    email: "Email (Resend)",
  };
  return names[type];
}

function setupInstructions(type: ChannelType, url: string, secret: string) {
  switch (type) {
    case "whatsapp":
      return `In Meta Business Suite: set webhook URL to ${url} and verify token to ${secret}`;
    case "slack":
      return `In Slack App settings: set Event Subscription URL to ${url}`;
    case "discord":
      return `In Discord Developer Portal: set Interactions Endpoint URL to ${url}`;
    case "telegram":
      return `Call: POST https://api.telegram.org/bot<TOKEN>/setWebhook?url=${url}&secret_token=${secret}`;
    case "webhook":
      return `POST messages to ${url} with X-Webhook-Secret: ${secret}`;
  }
}
