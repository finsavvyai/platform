import { describe, it, expect } from 'vitest';
import {
  SUPPORTED_EVENTS,
  createWebhookSchema,
  updateWebhookSchema,
  serializeWebhook,
  generateWebhookSecret,
  type WebhookRow,
} from './config-helpers.js';

describe('createWebhookSchema', () => {
  it('accepts a minimal payload (endpointUrl + events)', () => {
    const r = createWebhookSchema.safeParse({
      endpointUrl: 'https://example.com/hook',
      events: ['session.bound'],
    });
    expect(r.success).toBe(true);
  });

  it('rejects missing endpointUrl', () => {
    const r = createWebhookSchema.safeParse({ events: ['session.bound'] });
    expect(r.success).toBe(false);
  });

  it('rejects empty events array', () => {
    const r = createWebhookSchema.safeParse({
      endpointUrl: 'https://example.com/hook',
      events: [],
    });
    expect(r.success).toBe(false);
  });

  it('rejects unknown event names', () => {
    const r = createWebhookSchema.safeParse({
      endpointUrl: 'https://example.com/hook',
      events: ['some.fake.event'],
    });
    expect(r.success).toBe(false);
  });

  it('rejects malformed endpointUrl', () => {
    const r = createWebhookSchema.safeParse({
      endpointUrl: 'not-a-url',
      events: ['session.bound'],
    });
    expect(r.success).toBe(false);
  });

  it('accepts an optional secret with valid length', () => {
    const r = createWebhookSchema.safeParse({
      endpointUrl: 'https://example.com/hook',
      events: ['session.bound'],
      secret: 'whsec_validvalueOfAtLeast8Chars',
    });
    expect(r.success).toBe(true);
  });
});

describe('updateWebhookSchema', () => {
  it('accepts an empty payload (all fields optional)', () => {
    const r = updateWebhookSchema.safeParse({});
    expect(r.success).toBe(true);
  });

  it('rejects empty events array when events is provided', () => {
    const r = updateWebhookSchema.safeParse({ events: [] });
    expect(r.success).toBe(false);
  });

  it('accepts a partial update (enabled only)', () => {
    const r = updateWebhookSchema.safeParse({ enabled: false });
    expect(r.success).toBe(true);
  });
});

describe('serializeWebhook', () => {
  const baseRow: WebhookRow = {
    id: 'wh_1',
    tenantId: 't1',
    name: 'siem',
    endpointUrl: 'https://siem.x/y',
    secret: 'whsec_x',
    secretPrevious: null,
    secretPreviousValidUntil: null,
    events: 'session.bound,session.verified',
    enabled: 1,
    lastDeliveryAt: '2026-05-04T12:00:00Z',
    lastDeliveryStatus: 200,
    createdAt: '2026-05-01T00:00:00Z',
    updatedAt: '2026-05-04T12:00:00Z',
  } as unknown as WebhookRow;

  it('maps comma-separated events to a string array', () => {
    const out = serializeWebhook(baseRow);
    expect(out.events).toEqual(['session.bound', 'session.verified']);
  });

  it('coerces enabled=1 to true and enabled=0 to false', () => {
    expect(serializeWebhook(baseRow).enabled).toBe(true);
    const offRow = { ...baseRow, enabled: 0 } as WebhookRow;
    expect(serializeWebhook(offRow).enabled).toBe(false);
  });

  it('handles null fields with sensible fallbacks (empty string, empty array, null)', () => {
    const sparse = {
      ...baseRow,
      name: null,
      events: null,
      lastDeliveryAt: null,
      lastDeliveryStatus: null,
    } as unknown as WebhookRow;
    const out = serializeWebhook(sparse);
    expect(out.name).toBe('');
    expect(out.events).toEqual([]);
    expect(out.lastDeliveryAt).toBeNull();
    expect(out.lastDeliveryStatus).toBeNull();
  });

  it('drops empty strings from events list (filter(Boolean))', () => {
    const trailingComma = { ...baseRow, events: 'session.bound,' } as WebhookRow;
    expect(serializeWebhook(trailingComma).events).toEqual(['session.bound']);
  });
});

describe('generateWebhookSecret', () => {
  it('produces a string matching /^whsec_[a-f0-9]{64}$/', () => {
    const secret = generateWebhookSecret();
    expect(secret).toMatch(/^whsec_[a-f0-9]{64}$/);
  });

  it('returns distinct values across calls (CSPRNG, not constant)', () => {
    const a = generateWebhookSecret();
    const b = generateWebhookSecret();
    expect(a).not.toBe(b);
  });
});

describe('SUPPORTED_EVENTS constant', () => {
  it('exposes the canonical 11 event names that match the policy + dispatcher set', () => {
    expect(SUPPORTED_EVENTS).toContain('session.bound');
    expect(SUPPORTED_EVENTS).toContain('dbsc.risk_signal');
    expect(SUPPORTED_EVENTS).toContain('usage.cap_exceeded');
    expect(SUPPORTED_EVENTS.length).toBe(11);
  });
});
