export function getWebhookTemplate(): string {
  return `import { Hono } from 'hono';
import { getD1, getKV } from '@finsavvyai/cf-stack';

interface StripeWebhook {
  id: string;
  type: string;
  data: {
    object: {
      id: string;
      customer: string;
      amount: number;
      currency: string;
    };
  };
}

const app = new Hono();

app.post('/webhooks/stripe', async (c) => {
  const signature = c.req.header('stripe-signature');
  if (!signature) {
    return c.json({ error: 'Missing signature' }, 401);
  }

  const body = await c.req.text();
  let event: StripeWebhook;

  try {
    event = JSON.parse(body);
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }

  const db = getD1(c, 'DB');
  const kv = getKV(c, 'KV');

  switch (event.type) {
    case 'charge.succeeded':
      await db
        .prepare(\`
          INSERT INTO payments (stripe_id, customer_id, amount, status)
          VALUES (?, ?, ?, 'completed')
        \`)
        .bind(event.data.object.id, event.data.object.customer, event.data.object.amount)
        .run();

      await kv.put(
        \`charge:\${event.data.object.id}\`,
        JSON.stringify({ status: 'completed', timestamp: new Date().toISOString() }),
        { expirationTtl: 86400 },
      );
      break;

    case 'charge.refunded':
      await db
        .prepare('UPDATE payments SET status = ? WHERE stripe_id = ?')
        .bind('refunded', event.data.object.id)
        .run();
      break;
  }

  return c.json({ received: true });
});

export default app;
`;
}
