import { describe, it, expect } from 'vitest';
import { webhookPayloadSchema } from './webhook-schemas.js';

describe('webhookPayloadSchema', () => {
  const validPayload = {
    meta: {
      event_name: 'subscription_created',
      custom_data: { tenant_id: 'tenant-1' },
    },
    data: {
      id: 'sub_123',
      attributes: {
        store_id: 1,
        customer_id: 42,
        order_id: 10,
        product_id: 999,
        variant_id: 100,
        status: 'active',
        card_brand: 'visa',
        renews_at: '2026-03-01T00:00:00Z',
        ends_at: null,
        cancelled: false,
      },
    },
  };

  it('parses a valid payload', () => {
    const result = webhookPayloadSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it('rejects payload missing meta.event_name', () => {
    const invalid = { ...validPayload, meta: {} };
    const result = webhookPayloadSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects payload missing data.id', () => {
    const invalid = {
      ...validPayload,
      data: { attributes: validPayload.data.attributes },
    };
    const result = webhookPayloadSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects payload with missing attributes', () => {
    const invalid = {
      ...validPayload,
      data: { id: 'sub_123', attributes: {} },
    };
    const result = webhookPayloadSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('allows custom_data to be absent', () => {
    const noCustomData = {
      ...validPayload,
      meta: { event_name: 'subscription_created' },
    };
    const result = webhookPayloadSchema.safeParse(noCustomData);
    expect(result.success).toBe(true);
  });

  it('allows card_brand to be null', () => {
    const withNullBrand = {
      ...validPayload,
      data: {
        ...validPayload.data,
        attributes: { ...validPayload.data.attributes, card_brand: null },
      },
    };
    const result = webhookPayloadSchema.safeParse(withNullBrand);
    expect(result.success).toBe(true);
  });
});
