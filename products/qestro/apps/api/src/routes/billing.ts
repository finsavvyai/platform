import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

type Bindings = {
  DB: D1Database;
  STRIPE_SECRET: string;
};

const billingRouter = new Hono<{ Bindings: Bindings }>();

const CheckoutSchema = z.object({
  planId: z.enum(['free', 'pro', 'enterprise']),
  billingCycle: z.enum(['monthly', 'annual']),
});

const plans: Record<string, { name: string; monthlyPrice: number; annualPrice: number }> = {
  free: { name: 'Free', monthlyPrice: 0, annualPrice: 0 },
  pro: { name: 'Pro', monthlyPrice: 2999, annualPrice: 29990 },
  enterprise: { name: 'Enterprise', monthlyPrice: 9999, annualPrice: 99990 },
};

// POST /billing/checkout - Create checkout session
billingRouter.post('/checkout', zValidator('json', CheckoutSchema), async (c) => {
  try {
    const body = c.req.valid('json');
    const userId = c.req.header('x-user-id');
    const db = c.env.DB as D1Database;

    const plan = plans[body.planId];
    if (!plan) {
      return c.json({ error: 'Invalid plan' }, 400);
    }

    const amount = body.billingCycle === 'monthly' ? plan.monthlyPrice : plan.annualPrice;
    const sessionId = crypto.randomUUID();

    await db
      .prepare(
        'INSERT INTO checkout_sessions (id, user_id, plan_id, amount, currency, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .bind(sessionId, userId, body.planId, amount, 'usd', 'pending', new Date().toISOString())
      .run();

    const checkoutUrl = `https://checkout.stripe.com/${sessionId}`;
    return c.json({ sessionId, checkoutUrl, amount });
  } catch (error) {
    return c.json({ error: 'Checkout creation failed' }, 500);
  }
});

// POST /billing/webhook - Handle Stripe webhooks
billingRouter.post('/webhook', async (c) => {
  try {
    const body = await c.req.json();
    const db = c.env.DB as D1Database;

    // In production, verify webhook signature
    if (body.type === 'charge.succeeded') {
      const sessionId = body.data.object.metadata?.sessionId;
      const { results } = await db
        .prepare(
          'SELECT user_id, plan_id FROM checkout_sessions WHERE id = ? AND status = ? LIMIT 1'
        )
        .bind(sessionId, 'pending')
        .all();

      if (results?.[0]) {
        const session = results[0] as { user_id: string; plan_id: string };
        await db
          .prepare(
            'UPDATE checkout_sessions SET status = ?, paid_at = ? WHERE id = ?'
          )
          .bind('succeeded', new Date().toISOString(), sessionId)
          .run();

        await db
          .prepare('UPDATE users SET subscription_plan = ?, updated_at = ? WHERE id = ?')
          .bind(session.plan_id, new Date().toISOString(), session.user_id)
          .run();
      }
    }

    return c.json({ received: true });
  } catch (error) {
    return c.json({ error: 'Webhook processing failed' }, 500);
  }
});

// GET /billing/plans - List available plans
billingRouter.get('/plans', async (c) => {
  return c.json({
    plans: Object.entries(plans).map(([id, plan]) => ({
      id,
      ...plan,
      features: getFeatures(id),
    })),
  });
});

// GET /billing/subscription - Get user subscription
billingRouter.get('/subscription', async (c) => {
  try {
    const userId = c.req.header('x-user-id');
    const db = c.env.DB as D1Database;
    const { results } = await db
      .prepare('SELECT subscription_plan, updated_at FROM users WHERE id = ?')
      .bind(userId)
      .all();

    if (!results?.[0]) {
      return c.json({ error: 'User not found' }, 404);
    }

    const user = results[0] as { subscription_plan: string; updated_at: string };
    return c.json({
      plan: user.subscription_plan || 'free',
      updatedAt: user.updated_at,
    });
  } catch (error) {
    return c.json({ error: 'Failed to fetch subscription' }, 500);
  }
});

function getFeatures(planId: string): string[] {
  const features: Record<string, string[]> = {
    free: ['5 tests/month', 'Basic analytics', 'Email support'],
    pro: ['100 tests/month', 'Advanced analytics', 'Priority support', 'API access'],
    enterprise: ['Unlimited tests', 'Custom analytics', 'Dedicated support', 'Custom integrations'],
  };
  return features[planId] || [];
}

export default billingRouter;
