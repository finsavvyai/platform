import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { paymentService } from '../services/payment';
import { auditService } from '../services/audit';
import { authMiddleware, type Env } from '../middleware/auth';

const enterpriseRouter = new Hono<{ Bindings: Env }>();

// Request Demo
enterpriseRouter.post(
    '/demo',
    zValidator(
        'json',
        z.object({
            first_name: z.string(),
            last_name: z.string(),
            email: z.string().email(),
            company: z.string(),
            description: z.string().optional(),
        })
    ),
    async (c) => {
        const body = c.req.valid('json');

        // In reality: Trigger CRM workflow, email sales team, etc.
        return c.json({
            message: 'Demo request received',
            id: `demo_req_${Date.now()}`
        });
    }
);

// Get Dedicated Config
enterpriseRouter.get('/dedicated-config', (c) => {
    return c.json({
        regions: [
            'us-east-1-dedicated',
            'eu-west-1-dedicated',
        ],
        instance_types: [
            'm5.large',
            'm5.xlarge',
            'c5.xlarge',
        ],
        isolation_levels: [
            'pod',
            'node',
            'cluster',
        ],
    });
});

// Create Payment Intent (requires auth)
enterpriseRouter.post(
    '/payments/intent',
    authMiddleware,
    zValidator(
        'json',
        z.object({
            user_email: z.string().email(),
            variant_id: z.string(),
            amount: z.number().optional()
        })
    ),
    async (c) => {
        const body = c.req.valid('json');

        const params = {
            user_email: body.user_email,
            amount: body.amount || 0,
            currency: 'USD',
            variant_id: body.variant_id
        };

        try {
            const result = await paymentService.createPayment(params);

            // Audit the transaction
            await auditService.log(c, 'create_payment_intent', 'payment', {
                amount: params.amount,
                variant_id: params.variant_id
            });

            return c.json(result);
        } catch (err: any) {
            return c.json({ error: err.message }, 500);
        }
    }
);

export { enterpriseRouter };
