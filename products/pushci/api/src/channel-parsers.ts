// Platform-specific message parsers for incoming webhooks.

import type { ChannelConnection, IncomingMessage } from "./channel-types";

export function parseIncoming(
  type: string, body: any, _headers: Headers, _conn: ChannelConnection,
): IncomingMessage | null {
  switch (type) {
    case "whatsapp": return parseWhatsApp(body);
    case "slack": return parseSlack(body);
    case "discord": return parseDiscord(body);
    case "telegram": return parseTelegram(body);
    case "webhook":
      return body.text
        ? { text: body.text, senderId: body.senderId ?? "webhook", platform: "webhook" }
        : null;
    default: return null;
  }
}

export function parseWhatsApp(body: any): IncomingMessage | null {
  const msg = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!msg?.text?.body) return null;
  return { text: msg.text.body, senderId: msg.from, platform: "whatsapp" };
}

export function parseSlack(body: any): IncomingMessage | null {
  const event = body?.event;
  if (!event?.text || event.type !== "message") return null;
  return { text: event.text, senderId: event.channel, senderName: event.user, platform: "slack" };
}

export function parseDiscord(body: any): IncomingMessage | null {
  const data = body?.data;
  if (!data?.options?.[0]?.value) return null;
  return {
    text: data.options[0].value,
    senderId: body.channel_id,
    senderName: body.member?.user?.username,
    platform: "discord",
  };
}

export function parseTelegram(body: any): IncomingMessage | null {
  const msg = body?.message;
  if (!msg?.text) return null;
  return {
    text: msg.text,
    senderId: msg.chat.id.toString(),
    senderName: msg.from?.first_name,
    platform: "telegram",
  };
}

export function extractWhatsAppPhoneId(body: any): string {
  return body?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id ?? "";
}
