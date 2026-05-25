// Channel bridge: incoming webhook handlers for all messaging platforms.
// Each platform webhook is parsed, processed via NLP, and dispatched back.

import { Hono } from "hono";
import type { Env } from "./types";
import type { ChannelConnection, IncomingMessage } from "./channel-types";
import { dispatch } from "./channel-dispatch";
import { processChannelMessage } from "./channel-process";
import {
  parseIncoming, parseWhatsApp, parseSlack, parseDiscord,
  parseTelegram, extractWhatsAppPhoneId,
} from "./channel-parsers";

export const bridgeRoutes = new Hono<{ Bindings: Env }>();

/** Generic incoming endpoint — routes by connection ID. */
bridgeRoutes.all("/incoming/:connectionId", async (c) => {
  const conn = await getConnection(c.env, c.req.param("connectionId"));
  if (!conn || conn.status !== "active") return c.json({ error: "not found" }, 404);

  if (c.req.method === "GET") {
    const challenge = c.req.query("hub.challenge");
    const token = c.req.query("hub.verify_token");
    if (c.req.query("hub.mode") === "subscribe" && token === conn.webhook_secret && challenge) {
      return c.text(challenge);
    }
    return c.text("", 403);
  }

  const msg = parseIncoming(conn.channel_type, await c.req.json(), c.req.raw.headers, conn);
  if (!msg) return c.json({ ok: true });
  c.executionCtx.waitUntil(handleMessage(c.env, conn, msg));
  return c.json({ ok: true });
});

bridgeRoutes.post("/bridge/whatsapp", async (c) => {
  const body = await c.req.json();
  const conn = await findByExternalId(c.env, "whatsapp", extractWhatsAppPhoneId(body));
  if (!conn) return c.json({ ok: true });
  const msg = parseWhatsApp(body);
  if (!msg) return c.json({ ok: true });
  c.executionCtx.waitUntil(handleMessage(c.env, conn, msg));
  return c.json({ ok: true });
});

bridgeRoutes.post("/bridge/slack", async (c) => {
  const body = await c.req.json();
  if (body.type === "url_verification") return c.json({ challenge: body.challenge });
  if (body.event?.bot_id) return c.json({ ok: true });
  const conn = await findByExternalId(c.env, "slack", body.team_id);
  if (!conn) return c.json({ ok: true });
  const msg = parseSlack(body);
  if (!msg) return c.json({ ok: true });
  c.executionCtx.waitUntil(handleMessage(c.env, conn, msg));
  return c.json({ ok: true });
});

bridgeRoutes.post("/bridge/discord", async (c) => {
  const body = await c.req.json();
  if (body.type === 1) return c.json({ type: 1 });
  const conn = await findByExternalId(c.env, "discord", body.guild_id);
  if (!conn) return c.json({ ok: true });
  const msg = parseDiscord(body);
  if (!msg) return c.json({ ok: true });
  c.executionCtx.waitUntil(handleMessage(c.env, conn, msg));
  return c.json({ ok: true });
});

bridgeRoutes.post("/bridge/telegram", async (c) => {
  const secret = c.req.header("x-telegram-bot-api-secret-token");
  const conn = await findByTelegramSecret(c.env, secret);
  if (!conn) return c.json({ ok: true });
  const msg = parseTelegram(await c.req.json());
  if (!msg) return c.json({ ok: true });
  c.executionCtx.waitUntil(handleMessage(c.env, conn, msg));
  return c.json({ ok: true });
});

bridgeRoutes.post("/bridge/webhook", async (c) => {
  const secret = c.req.header("x-webhook-secret");
  if (!secret) return c.json({ error: "missing secret" }, 401);
  const conn = await findByWebhookSecret(c.env, secret);
  if (!conn) return c.json({ error: "unauthorized" }, 401);
  const body = await c.req.json<{ text: string; senderId?: string }>();
  if (!body.text) return c.json({ error: "text required" }, 400);
  const msg: IncomingMessage = { text: body.text, senderId: body.senderId ?? "webhook-user", platform: "webhook" };
  c.executionCtx.waitUntil(handleMessage(c.env, conn, msg));
  return c.json({ ok: true });
});

// --- Message handler ---

async function handleMessage(env: Env, conn: ChannelConnection, msg: IncomingMessage) {
  const start = Date.now();
  const execId = crypto.randomUUID();

  await env.DB.prepare(
    `INSERT INTO channel_messages (id,connection_id,user_id,direction,sender_id,message_text,status)
     VALUES (?,?,?,'inbound',?,?,'processing')`
  ).bind(crypto.randomUUID(), conn.id, conn.user_id, msg.senderId, msg.text).run();

  const response = await processChannelMessage(env, conn, msg);
  await dispatch(conn, response, msg.senderId);

  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO channel_messages (id,connection_id,user_id,direction,sender_id,agent_slug,execution_id,response_text,duration_ms,status)
       VALUES (?,?,?,'outbound',?,?,?,?,?,'responded')`
    ).bind(execId, conn.id, conn.user_id, msg.senderId, conn.default_agent, execId, response, Date.now() - start),
    env.DB.prepare(
      `UPDATE channel_connections SET message_count=message_count+1, last_message_at=datetime('now') WHERE id=?`
    ).bind(conn.id),
  ]);
}

// --- DB lookups ---

async function getConnection(env: Env, id: string) {
  return env.DB.prepare("SELECT * FROM channel_connections WHERE id=?").bind(id).first<ChannelConnection>();
}

async function findByExternalId(env: Env, type: string, externalId: string | undefined) {
  if (!externalId) return null;
  return env.DB.prepare(
    "SELECT * FROM channel_connections WHERE channel_type=? AND external_id=? AND status='active'"
  ).bind(type, externalId).first<ChannelConnection>();
}

async function findByTelegramSecret(env: Env, secret: string | undefined) {
  if (!secret) return null;
  return env.DB.prepare(
    "SELECT * FROM channel_connections WHERE channel_type='telegram' AND webhook_secret=? AND status='active'"
  ).bind(secret).first<ChannelConnection>();
}

async function findByWebhookSecret(env: Env, secret: string) {
  return env.DB.prepare(
    "SELECT * FROM channel_connections WHERE channel_type='webhook' AND webhook_secret=? AND status='active'"
  ).bind(secret).first<ChannelConnection>();
}
