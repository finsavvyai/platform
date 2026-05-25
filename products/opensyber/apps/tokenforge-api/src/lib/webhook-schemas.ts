import { z } from 'zod';

export const webhookAttributesSchema = z.object({
  store_id: z.number(),
  customer_id: z.number(),
  order_id: z.number().optional(),
  product_id: z.number().optional(),
  variant_id: z.number().optional(),
  status: z.string(),
  card_brand: z.string().nullable().optional(),
  renews_at: z.string().nullable().optional(),
  ends_at: z.string().nullable().optional(),
  cancelled: z.boolean().optional(),
  user_email: z.string().optional(),
  user_name: z.string().optional(),
});

export const webhookPayloadSchema = z.object({
  meta: z.object({
    event_name: z.string(),
    custom_data: z
      .object({
        tenant_id: z.string().optional(),
      })
      .optional(),
  }),
  data: z.object({
    id: z.string(),
    attributes: webhookAttributesSchema,
  }),
});

export type WebhookPayload = z.infer<typeof webhookPayloadSchema>;

export const WEBHOOK_EVENTS = [
  'subscription_created',
  'subscription_updated',
  'subscription_cancelled',
  'subscription_expired',
  'subscription_payment_success',
  'subscription_payment_failed',
] as const;

export type WebhookEventName = (typeof WEBHOOK_EVENTS)[number];
