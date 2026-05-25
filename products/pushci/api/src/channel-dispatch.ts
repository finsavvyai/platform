// Outbound message dispatch: send responses back to each messaging platform.

import type { ChannelConnection, ChannelType } from "./channel-types";
import { PLATFORM_LIMITS } from "./channel-types";

export async function dispatch(
  conn: ChannelConnection,
  text: string,
  recipientId: string,
): Promise<boolean> {
  const truncated = truncate(text, PLATFORM_LIMITS[conn.channel_type as ChannelType]);
  const config = JSON.parse(conn.config || "{}");

  switch (conn.channel_type) {
    case "whatsapp": return sendWhatsApp(conn.access_token!, config.phoneNumberId, recipientId, truncated);
    case "slack": return sendSlack(conn.access_token!, recipientId, truncated);
    case "discord": return sendDiscord(conn.access_token!, recipientId, truncated);
    case "telegram": return sendTelegram(conn.access_token!, recipientId, truncated);
    case "webhook": return sendWebhook(config.callbackUrl, conn.webhook_secret!, truncated, recipientId);
    case "email": return sendEmail(conn.access_token!, config.to || recipientId, config.from || "PushCI <notifications@pushci.dev>", truncated, config.subject);
    default: return false;
  }
}

async function sendWhatsApp(token: string, phoneNumberId: string, to: string, text: string) {
  const res = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text },
    }),
  });
  return res.ok;
}

async function sendSlack(token: string, channel: string, text: string) {
  const res = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ channel, text }),
  });
  return res.ok;
}

async function sendDiscord(token: string, channelId: string, text: string) {
  const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ content: text }),
  });
  return res.ok;
}

async function sendTelegram(token: string, chatId: string, text: string) {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
  });
  return res.ok;
}

async function sendWebhook(url: string, secret: string, text: string, senderId: string) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Webhook-Secret": secret },
    body: JSON.stringify({ text, senderId, timestamp: new Date().toISOString() }),
  });
  return res.ok;
}

async function sendEmail(apiKey: string, to: string, from: string, text: string, subject?: string) {
  const subjectLine = subject || text.split("\n")[0].replace(/\*/g, "").replace(/\[.*?\]/g, "").trim().slice(0, 100) || "PushCI Notification";
  const html = `<div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:20px">
<div style="background:#18181b;border:1px solid #3f3f46;border-radius:12px;padding:24px;color:#fafafa">
${text.split("\n").map((l) => {
    if (l.startsWith("[PASSED]")) return `<p style="color:#10b981;font-weight:600">${l}</p>`;
    if (l.startsWith("[FAILED]")) return `<p style="color:#ef4444;font-weight:600">${l}</p>`;
    if (l.startsWith("[RUNNING]")) return `<p style="color:#f59e0b;font-weight:600">${l}</p>`;
    if (l.includes("https://")) return `<p><a href="${l.split(" ").pop()}" style="color:#10b981">${l}</a></p>`;
    return `<p style="color:#a1a1aa">${l}</p>`;
  }).join("")}
</div>
<p style="text-align:center;margin-top:16px;color:#71717a;font-size:12px">Powered by <a href="https://pushci.dev" style="color:#10b981">PushCI</a></p>
</div>`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject: subjectLine, html, text }),
  });
  return res.ok;
}

function truncate(text: string, limit: number): string {
  if (text.length <= limit) return text;
  return text.slice(0, limit - 20) + "\n...(truncated)";
}
