// Channel types for multi-platform messaging (WhatsApp, Slack, Discord, Telegram, Webhook).

export type ChannelType = "whatsapp" | "slack" | "discord" | "telegram" | "webhook" | "email";
export type ChannelStatus = "pending" | "active" | "paused" | "revoked" | "error";
export type MessageDirection = "inbound" | "outbound";
export type MessageStatus = "received" | "processing" | "responded" | "failed";

export interface ChannelConnection {
  id: string;
  user_id: string;
  channel_type: ChannelType;
  label: string | null;
  status: ChannelStatus;
  external_id: string | null;
  external_name: string | null;
  access_token: string | null;
  webhook_url: string | null;
  webhook_secret: string | null;
  config: string;
  default_agent: string;
  rate_limit_per_minute: number;
  message_count: number;
  last_message_at: string | null;
  connected_at: string | null;
  created_at: string;
}

export interface ChannelMessage {
  id: string;
  connection_id: string;
  user_id: string;
  direction: MessageDirection;
  sender_id: string | null;
  sender_name: string | null;
  message_text: string | null;
  agent_slug: string | null;
  execution_id: string | null;
  response_text: string | null;
  duration_ms: number | null;
  status: MessageStatus;
  created_at: string;
}

export interface IncomingMessage {
  text: string;
  senderId: string;
  senderName?: string;
  platform: ChannelType;
  replyTo?: string;
}

/** Platform-specific response limits (characters). */
export const PLATFORM_LIMITS: Record<ChannelType, number> = {
  whatsapp: 4000,
  telegram: 4000,
  slack: 39000,
  discord: 2000,
  webhook: 40000,
  email: 50000,
};
