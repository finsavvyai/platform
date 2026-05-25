import { describe, it, expect } from "vitest";
import { PLATFORM_LIMITS } from "./channel-types";
import type {
  ChannelType, ChannelStatus, MessageDirection, MessageStatus,
  ChannelConnection, ChannelMessage, IncomingMessage,
} from "./channel-types";

describe("channel-types", () => {
  it("PLATFORM_LIMITS covers all channel types", () => {
    const types: ChannelType[] = ["whatsapp", "slack", "discord", "telegram", "webhook"];
    for (const t of types) {
      expect(PLATFORM_LIMITS[t]).toBeGreaterThan(0);
    }
  });

  it("all limits are positive integers", () => {
    for (const [key, val] of Object.entries(PLATFORM_LIMITS)) {
      expect(val).toBeGreaterThan(0);
      expect(Number.isInteger(val)).toBe(true);
    }
  });

  it("IncomingMessage shape is correct", () => {
    const msg: IncomingMessage = {
      text: "run tests",
      senderId: "user123",
      platform: "slack",
    };
    expect(msg.text).toBe("run tests");
    expect(msg.platform).toBe("slack");
  });

  it("ChannelConnection interface is usable", () => {
    const conn: Partial<ChannelConnection> = {
      id: "abc",
      channel_type: "whatsapp",
      status: "active",
      default_agent: "run",
    };
    expect(conn.channel_type).toBe("whatsapp");
  });
});
