import type { CustomerId } from "@finsavvyai/billing";

/**
 * Entitlement key a customer's plan must grant to call the screening skill.
 * Add `{ key: "aml.screen", limit: N }` to a Plan's entitlements in billing.
 */
export const SCREEN_ENTITLEMENT_KEY = "aml.screen";

/** MCP tool result shape (text content), kept SDK-agnostic so the tool
 *  handler can be unit-tested without the transport layer. */
export interface ScreenToolTextResult {
  content: { type: "text"; text: string }[];
  isError?: boolean;
}

/**
 * Resolve the billing identity for the current request. Identity comes from
 * the server's bound configuration (API key -> customer), NOT from tool
 * arguments — a caller must not be able to spoof another customer's quota.
 */
export type CustomerResolver = () => CustomerId | null;
