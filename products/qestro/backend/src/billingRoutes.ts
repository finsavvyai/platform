import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import * as schema from './db/schema';
import { ALL_PLANS, getPlanById } from './config/subscriptionPlans';
import { verifyJWT } from './auth/jwt';

type Bindings = {
    DB: D1Database;
    ENVIRONMENT: string;
    JWT_SECRET: string;
    LEMONSQUEEZY_API_KEY: string;
    LEMONSQUEEZY_STORE_ID: string;
};

const billingRoutes = new Hono<{ Bindings: Bindings }>();

const paidPlanRank: Record<string, number> = {
    free: 0,
    starter: 1,
    'starter-annual': 1,
    professional: 2,
    pro: 2,
    'professional-annual': 2,
    team: 2,
    enterprise: 3,
    'enterprise-annual': 3,
};

const featureAccessConfig: Record<string, {
    name: string;
    minimumPlan: string;
    description: string;
    usageType: string;
    limits: Record<string, number>;
}> = {
    github_repository_scan: {
        name: 'GitHub Repository Scenario Builder',
        minimumPlan: 'professional',
        description: 'Connect a GitHub repository reference and generate AI scenarios.',
        usageType: 'repositoryScans',
        limits: {
            free: 0,
            starter: 0,
            'starter-annual': 0,
            professional: 50,
            pro: 50,
            'professional-annual': 50,
            team: 100,
            enterprise: -1,
            'enterprise-annual': -1,
        },
    },
};

const getVerifiedPlanId = async (c: any) => {
    const authorization = c.req.header('Authorization');
    if (!authorization?.startsWith('Bearer ')) {
        return 'free';
    }

    try {
        const payload = await verifyJWT(authorization.slice(7), c.env.JWT_SECRET);
        const userId = String(payload.userId || payload.sub || '');
        let planId = String(payload.planId || payload.subscription || 'free');
        if (userId) {
            try {
                const rows = await drizzle(c.env.DB)
                    .select({ subscription: schema.users.subscription })
                    .from(schema.users)
                    .where(eq(schema.users.id, userId))
                    .limit(1);
                if (rows[0]?.subscription) {
                    planId = rows[0].subscription;
                }
            } catch {
                // Keep verified token fallback when local DB is not seeded.
            }
        }
        return planId;
    } catch {
        return 'free';
    }
};

const buildFeatureAccess = (feature: string, planId: string) => {
    const config = featureAccessConfig[feature];
    if (!config) return null;
    const limit = config.limits[planId] ?? 0;
    const used = 0;
    const planHasAccess = (paidPlanRank[planId] ?? 0) >= (paidPlanRank[config.minimumPlan] ?? 0);
    const hasAccess = planHasAccess && (limit === -1 || used < limit);
    return {
        feature,
        name: config.name,
        planId,
        minimumPlan: config.minimumPlan,
        hasAccess,
        upgradeUrl: '/billing',
        description: config.description,
        usage: {
            type: config.usageType,
            used,
            limit,
            remaining: limit === -1 ? -1 : Math.max(0, limit - used),
        },
        denialReason: hasAccess ? null : 'plan_required',
    };
};

// 1. Get all available plans
billingRoutes.get('/plans', async (c) => {
    try {
        const plans = ALL_PLANS.map(plan => ({
            id: plan.id,
            name: plan.name,
            description: plan.description,
            price: plan.price,
            currency: plan.currency,
            interval: plan.interval,
            features: plan.features,
            limits: plan.limits,
            popular: plan.popular,
            trialDays: plan.trialDays,
        }));

        return c.json({ success: true, plans });
    } catch (err: any) {
        return c.json({ success: false, error: 'Failed to fetch plans' }, 500);
    }
});

// 2. Get the current user's subscription
billingRoutes.get('/subscription', async (c) => {
    // Using a mock auth payload since we don't have the auth middleware hooked into this router context yet
    // In a real iteration, this would be: const user = c.get('user')
    const userId = 'user-demo-001';
    try {
        const db = drizzle(c.env.DB);
        let planId = 'free';

        // Attempt to grab the user's subscription ID from D1
        try {
            const users = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
            if (users.length > 0) {
                planId = users[0].subscription || 'free';
            }
        } catch (e) { /* DB not seeded logic */ }

        const plan = getPlanById(planId);

        return c.json({
            success: true,
            subscription: {
                id: `sub_${Date.now()}`,
                planId: planId,
                status: 'active',
                currentPeriodStart: new Date(Date.now() - 10000000).toISOString(),
                currentPeriodEnd: new Date(Date.now() + 20000000).toISOString(),
                cancelAtPeriodEnd: false,
            },
            plan: plan || getPlanById('free')
        });
    } catch (err: any) {
        return c.json({ success: false, error: 'Failed to fetch subscription' }, 500);
    }
});

// 3. Get current billing usage metrics
billingRoutes.get('/usage', async (c) => {
    try {
        return c.json({
            success: true,
            usage: {
                recordingCount: 45,
                testExecutionCount: 120,
                storageUsedMB: 250,
                apiCallCount: 1540
            },
            period: new Date().toISOString().substring(0, 7)
        });
    } catch (err: any) {
        return c.json({ success: false, error: 'Failed to fetch usage' }, 500);
    }
});

billingRoutes.get('/feature-access/:feature', async (c) => {
    const feature = c.req.param('feature');
    const planId = await getVerifiedPlanId(c);
    const access = buildFeatureAccess(feature, planId);
    if (!access) {
        return c.json({ success: false, error: 'Unknown feature' }, 404);
    }

    return c.json({ success: true, access });
});

// 4. Get historical invoices
billingRoutes.get('/invoices', async (c) => {
    try {
        // Return mock historical invoices
        return c.json({
            success: true,
            invoices: [
                {
                    id: 'inv_1',
                    amount: 9900,
                    currency: 'usd',
                    status: 'paid',
                    paidAt: new Date(Date.now() - 2592000000).toISOString(), // 30 days ago
                    dueDate: new Date(Date.now() - 2592000000).toISOString(),
                    periodStart: new Date(Date.now() - 5184000000).toISOString(),
                    periodEnd: new Date(Date.now() - 2592000000).toISOString(),
                    hostedInvoiceUrl: 'https://qestro.app/billing/invoice/1'
                }
            ]
        });
    } catch (err: any) {
        return c.json({ success: false, error: 'Failed to fetch invoices' }, 500);
    }
});

// 5. Create LemonSqueezy Checkout Session
billingRoutes.post('/checkout', async (c) => {
    try {
        const { planId, interval } = await c.req.json();

        // In a real environment, we would POST to https://api.lemonsqueezy.com/v1/checkouts
        // Since we're in a demo/Hono environment, we'll simulate the successful checkout generation

        // Validate that the request has a LEMONSQUEEZY_API_KEY available via env
        // c.env.LEMONSQUEEZY_API_KEY

        const targetPlan = getPlanById(planId);
        if (!targetPlan) {
            return c.json({ success: false, error: 'Invalid plan selected' }, 400);
        }

        // Generate a simulated secure LemonSqueezy checkout URL matching the target tier
        const variantId = targetPlan.lemonSqueezyVariantId || 'demo-variant';
        const checkoutUrl = `https://qestro.lemonsqueezy.com/checkout/buy/${variantId}?embed=1&checkout[custom][user_id]=demo-user`;

        return c.json({
            success: true,
            checkoutUrl,
            sessionId: `ls_session_${Date.now()}`
        });
    } catch (err: any) {
        console.error('Checkout error:', err);
        return c.json({ success: false, error: 'Failed to create checkout session' }, 500);
    }
});

// 6. Create Billing Customer Portal Session
billingRoutes.post('/portal', async (c) => {
    try {
        return c.json({
            success: true,
            portalUrl: 'https://qestro.lemonsqueezy.com/billing'
        });
    } catch (err: any) {
        return c.json({ success: false, error: 'Failed to launch billing portal' }, 500);
    }
});

export default billingRoutes;
