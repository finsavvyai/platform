#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ScreenClient } from "@finsavvyai/aml-screen-client";
import type { CustomerId } from "@finsavvyai/billing";
import { SnapshotStore, type BillingSnapshot } from "./config-store.js";
import { InMemoryUsageMeter } from "./meter.js";
import { createScreenSkillServer } from "./server.js";
import { SCREEN_ENTITLEMENT_KEY } from "./types.js";

// Fail closed: with no billing config, the store grants nothing, so every
// call is denied with `no_entitlement` rather than served for free.
function loadSnapshot(): BillingSnapshot {
  const path = process.env.AMLIQ_BILLING_CONFIG;
  if (!path) return { plans: [], subscriptions: [] };
  return JSON.parse(readFileSync(path, "utf8")) as BillingSnapshot;
}

async function main(): Promise<void> {
  const baseUrl = process.env.AMLIQ_API_URL ?? "https://api.amliq.finance";
  const customerId = (process.env.AMLIQ_CUSTOMER_ID ?? "") as CustomerId;

  const store = new SnapshotStore(loadSnapshot());
  // NOTE: process-local counter. Production MUST inject a durable,
  // period-scoped UsageMeter so quota survives restarts and scales out.
  const meter = new InMemoryUsageMeter();
  const client = new ScreenClient({ baseUrl, timeoutMs: 10_000 });

  const server = createScreenSkillServer({
    gate: { store, meter, entitlementKey: SCREEN_ENTITLEMENT_KEY },
    client,
    resolveCustomerId: () => (customerId === "" ? null : customerId),
  });

  await server.connect(new StdioServerTransport());
  process.stderr.write("amliq-screen-skill MCP server running on stdio\n");
}

main().catch((e: unknown) => {
  process.stderr.write(`Fatal: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});
