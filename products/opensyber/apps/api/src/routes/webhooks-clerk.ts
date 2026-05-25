import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { users, instances } from '@opensyber/db';
import type { Env, Variables } from '../types.js';
import { agentRuntime } from '../services/agent-runtime.js';
import { emailService } from '../services/email.js';
import { timingSafeCompare } from '../lib/timing-safe.js';

const clerkWebhookRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

clerkWebhookRoutes.post('/clerk', async (c) => {
  const db = c.get('db');

  const svixId = c.req.header('svix-id');
  const svixTimestamp = c.req.header('svix-timestamp');
  const svixSignature = c.req.header('svix-signature');
  if (!svixId || !svixTimestamp || !svixSignature) {
    return c.json({ error: 'Missing Svix headers' }, 401);
  }

  const rawBody = await c.req.text();

  const timestampSec = parseInt(svixTimestamp, 10);
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestampSec) > 300) {
    return c.json({ error: 'Timestamp too old' }, 401);
  }

  const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`;
  const secret = c.env.CLERK_WEBHOOK_SECRET.replace('whsec_', '');
  const secretBytes = Uint8Array.from(atob(secret), (ch) => ch.charCodeAt(0));

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', secretBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(signedContent));
  const expectedSignature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));

  const signatures = svixSignature.split(' ');
  const isValid = signatures.some((sig) => {
    const [, sigValue] = sig.split(',');
    return typeof sigValue === 'string' && timingSafeCompare(sigValue, expectedSignature);
  });

  if (!isValid) {
    console.error('Clerk webhook signature mismatch');
    return c.json({ error: 'Invalid signature' }, 401);
  }

  const body = JSON.parse(rawBody) as {
    type: string;
    data: {
      id: string;
      email_addresses: Array<{ email_address: string }>;
      first_name: string | null;
      last_name: string | null;
      unsafe_metadata?: { ref?: string };
    };
  };

  const { type, data } = body;

  switch (type) {
    case 'user.created': {
      const email = data.email_addresses[0]?.email_address;
      if (!email) break;

      const userName = [data.first_name, data.last_name].filter(Boolean).join(' ') || null;
      const referralCode = `REF-${crypto.randomUUID().slice(0, 6)}`;
      const referredBy = data.unsafe_metadata?.ref || null;

      await db.insert(users).values({
        id: data.id, email, name: userName, plan: 'free', referralCode, referredBy,
        trialStartedAt: new Date().toISOString(),
        emailFlags: JSON.stringify({ welcomeSent: true }),
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      });

      try {
        await emailService.sendWelcomeEmail({ to: email, userName, apiKey: c.env.RESEND_API_KEY });
      } catch (err) {
        console.error(`[Webhooks] Failed to send welcome email to ${email}:`, err);
      }
      break;
    }

    case 'user.updated': {
      const email = data.email_addresses[0]?.email_address;
      await db.update(users).set({
        email: email || undefined,
        name: [data.first_name, data.last_name].filter(Boolean).join(' ') || null,
        updatedAt: new Date().toISOString(),
      }).where(eq(users.id, data.id));
      break;
    }

    case 'user.deleted': {
      const userInstances = await db.select().from(instances).where(eq(instances.userId, data.id));

      for (const instance of userInstances) {
        await db.update(instances).set({ status: 'destroying' }).where(eq(instances.id, instance.id));
        await c.env.CREDENTIAL_VAULT.delete(`gateway:${instance.id}`);

        if (instance.containerId) {
          try {
            await agentRuntime.deleteInstance({
              containerId: instance.containerId,
              doNamespace: c.env.AGENT_DO,
            });
          } catch (err) {
            console.error(`[Webhooks] Failed to delete container ${instance.containerId}:`, err);
          }
        }
      }

      console.log(`[Webhooks] user.deleted cascade: ${userInstances.length} instance(s) destroyed for user ${data.id}`);
      break;
    }
  }

  return c.json({ received: true });
});

export { clerkWebhookRoutes };
