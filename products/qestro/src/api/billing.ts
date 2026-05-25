/**
 * Billing API Routes
 *
 * Handles subscription management, payments, and billing
 */

import { Hono } from "hono";

const billing = new Hono();

billing.get("/", (c) => {
  return c.json({ message: "Billing API coming soon" });
});

billing.post("/", (c) => {
  return c.json({ message: "Billing endpoint coming soon" });
});

export { billing as billingRoutes };
