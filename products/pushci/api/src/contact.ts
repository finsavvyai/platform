import { Hono } from "hono";
import type { Env } from "./types";
import { send } from "./email";

export const contactRoutes = new Hono<{ Bindings: Env }>();

type ContactPayload = {
  name?: string;
  email: string;
  company?: string;
  topic?: string;
  message: string;
  seats?: string;
  role?: string;
  team_size?: string;
  stack?: string[];
  current_ci?: string;
  budget?: string;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const TOPIC_ROUTING: Record<string, string> = {
  sales: "sales@pushci.dev",
  enterprise: "sales@pushci.dev",
  support: "support@pushci.dev",
  security: "security@pushci.dev",
  press: "hello@pushci.dev",
  other: "hello@pushci.dev",
};

contactRoutes.post("/contact", async (c) => {
  const body = await c.req.json<ContactPayload>().catch(() => null);
  if (!body || !body.email || !body.message) {
    return c.json({ error: "email and message required" }, 400);
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email)) {
    return c.json({ error: "invalid email" }, 400);
  }
  if (body.message.length > 5000) {
    return c.json({ error: "message too long" }, 400);
  }

  const topic = (body.topic || "sales").toLowerCase();
  const to = TOPIC_ROUTING[topic] || "sales@pushci.dev";
  const name = body.name?.trim() || body.email;
  const company = body.company?.trim() || "—";
  const role = body.role?.trim() || "—";
  const teamSize = body.team_size?.trim() || body.seats?.trim() || "—";
  const stack = Array.isArray(body.stack) && body.stack.length ? body.stack.join(", ") : "—";
  const currentCI = body.current_ci?.trim() || "—";
  const budget = body.budget?.trim() || "—";

  const row = (k: string, v: string) =>
    `<tr><td style="padding:8px 0;color:#71717a;width:140px;">${k}</td><td style="padding:8px 0;">${escapeHtml(v)}</td></tr>`;

  const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#0a0a0a;color:#e4e4e7;padding:24px;">
  <div style="max-width:560px;margin:0 auto;">
    <div style="font-size:20px;font-weight:700;color:#10b981;margin-bottom:24px;">New contact — ${escapeHtml(topic)}</div>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      ${row("From", `${name} <${body.email}>`)}
      ${row("Role", role)}
      ${row("Company", company)}
      ${row("Team size", teamSize)}
      ${row("Stack", stack)}
      ${row("Current CI", currentCI)}
      ${row("Budget", budget)}
    </table>
    <div style="margin-top:24px;padding:16px;background:#18181b;border-left:3px solid #10b981;border-radius:4px;white-space:pre-wrap;">${escapeHtml(body.message)}</div>
    <div style="margin-top:20px;font-size:12px;color:#71717a;">Reply-to is the sender. Topic routed to ${to}.</div>
  </div>
</div>`;

  const text = `New contact — ${topic}

From:       ${name} <${body.email}>
Role:       ${role}
Company:    ${company}
Team size:  ${teamSize}
Stack:      ${stack}
Current CI: ${currentCI}
Budget:     ${budget}

${body.message}`;

  const ok = await send(c.env, {
    to,
    subject: `[${topic}] ${name} — ${body.company || "PushCI contact"}`,
    html,
    text,
  });

  if (!ok) {
    return c.json({ error: "send failed" }, 502);
  }
  return c.json({ ok: true, routed_to: to });
});
