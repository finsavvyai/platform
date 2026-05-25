import { describe, it, expect } from "vitest";
import {
  parseWhatsApp, parseSlack, parseDiscord,
  parseTelegram, extractWhatsAppPhoneId, parseIncoming,
} from "./channel-parsers";

describe("parseWhatsApp", () => {
  it("parses a valid text message", () => {
    const body = {
      entry: [{ changes: [{ value: { messages: [{ text: { body: "run tests" }, from: "+1234567890" }] } }] }],
    };
    expect(parseWhatsApp(body)).toEqual({ text: "run tests", senderId: "+1234567890", platform: "whatsapp" });
  });

  it("returns null for missing text", () => {
    expect(parseWhatsApp({ entry: [{ changes: [{ value: { messages: [{}] } }] }] })).toBeNull();
  });

  it("returns null for empty body", () => {
    expect(parseWhatsApp({})).toBeNull();
    expect(parseWhatsApp(null)).toBeNull();
  });
});

describe("parseSlack", () => {
  it("parses a message event", () => {
    const body = { event: { type: "message", text: "deploy staging", channel: "C123", user: "U456" } };
    expect(parseSlack(body)).toEqual({ text: "deploy staging", senderId: "C123", senderName: "U456", platform: "slack" });
  });

  it("returns null for non-message events", () => {
    expect(parseSlack({ event: { type: "reaction_added", text: "hi" } })).toBeNull();
  });

  it("returns null for missing text", () => {
    expect(parseSlack({ event: { type: "message" } })).toBeNull();
  });
});

describe("parseDiscord", () => {
  it("parses a slash command interaction", () => {
    const body = {
      data: { options: [{ value: "show status" }] },
      channel_id: "CH789",
      member: { user: { username: "dev123" } },
    };
    expect(parseDiscord(body)).toEqual({ text: "show status", senderId: "CH789", senderName: "dev123", platform: "discord" });
  });

  it("returns null for missing options", () => {
    expect(parseDiscord({ data: {} })).toBeNull();
    expect(parseDiscord({ data: { options: [] } })).toBeNull();
  });
});

describe("parseTelegram", () => {
  it("parses a text message", () => {
    const body = { message: { text: "diagnose", chat: { id: 99 }, from: { first_name: "Alice" } } };
    expect(parseTelegram(body)).toEqual({ text: "diagnose", senderId: "99", senderName: "Alice", platform: "telegram" });
  });

  it("returns null for missing text", () => {
    expect(parseTelegram({ message: { chat: { id: 1 } } })).toBeNull();
  });

  it("returns null for empty body", () => {
    expect(parseTelegram({})).toBeNull();
  });
});

describe("extractWhatsAppPhoneId", () => {
  it("extracts phone_number_id from webhook payload", () => {
    const body = { entry: [{ changes: [{ value: { metadata: { phone_number_id: "PH123" } } }] }] };
    expect(extractWhatsAppPhoneId(body)).toBe("PH123");
  });

  it("returns empty string for missing data", () => {
    expect(extractWhatsAppPhoneId({})).toBe("");
  });
});

describe("parseIncoming", () => {
  it("routes to correct parser by type", () => {
    const waBody = { entry: [{ changes: [{ value: { messages: [{ text: { body: "hi" }, from: "123" }] } }] }] };
    const result = parseIncoming("whatsapp", waBody, new Headers(), {} as any);
    expect(result?.platform).toBe("whatsapp");
  });

  it("handles webhook type", () => {
    const result = parseIncoming("webhook", { text: "hello", senderId: "u1" }, new Headers(), {} as any);
    expect(result).toEqual({ text: "hello", senderId: "u1", platform: "webhook" });
  });

  it("returns null for unknown type", () => {
    expect(parseIncoming("unknown", {}, new Headers(), {} as any)).toBeNull();
  });

  it("returns null for webhook without text", () => {
    expect(parseIncoming("webhook", { foo: "bar" }, new Headers(), {} as any)).toBeNull();
  });
});
