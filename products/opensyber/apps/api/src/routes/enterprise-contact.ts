import { Hono } from 'hono';
import { enterpriseLeads } from '@opensyber/db';
import { generateId } from '@opensyber/shared';
import type { Env, Variables } from '../types.js';
import { dbMiddleware } from '../middleware/db.js';
import { rateLimitMiddleware } from '../middleware/rate-limit.js';
import { escapeHtml } from '../lib/html-escape.js';
import { enterpriseContactSchema } from './validation/enterprise-contact.js';

const enterpriseContactRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

enterpriseContactRoutes.use('*', dbMiddleware, rateLimitMiddleware('public'));

// Public endpoint — no auth required
enterpriseContactRoutes.post('/contact', async (c) => {
  const db = c.get('db');
  const parsed = enterpriseContactSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: 'Invalid input', details: parsed.error.issues[0]?.message }, 400);
  const body = parsed.data;

  const lead = {
    id: generateId(),
    name: body.name,
    email: body.email,
    company: body.company,
    message: body.message,
    createdAt: new Date().toISOString(),
  };

  await db.insert(enterpriseLeads).values(lead);

  // Notify sales team
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${c.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'OpenSyber <noreply@opensyber.cloud>',
        to: 'sales@opensyber.cloud',
        subject: `Enterprise Lead: ${escapeHtml(body.company)}`,
        html: `<h2>New Enterprise Lead</h2>
<p><strong>Name:</strong> ${escapeHtml(body.name)}</p>
<p><strong>Email:</strong> ${escapeHtml(body.email)}</p>
<p><strong>Company:</strong> ${escapeHtml(body.company)}</p>
<p><strong>Message:</strong></p>
<p>${escapeHtml(body.message)}</p>`,
      }),
    });
  } catch (err) {
    console.error('[Enterprise] Failed to send lead notification:', err);
  }

  return c.json({ data: { id: lead.id, message: 'Thank you! Our team will reach out shortly.' } }, 201);
});

export { enterpriseContactRoutes };
