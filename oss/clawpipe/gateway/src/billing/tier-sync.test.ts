/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import {
  buildVariantMap,
  applyEvent,
  onSubscriptionCreated,
  onSubscriptionCancelled,
  onSubscriptionExpired,
  onPaymentFailed,
  onPaymentRecovered,
} from './tier-sync';
import type { LSWebhookEvent } from './types';

function makeDB() {
  const projects = new Map<string, Record<string, unknown>>();
  const prepare = (sql: string) => ({
    bind: (...binds: unknown[]) => ({
      run: async () => {
        if (sql.startsWith('UPDATE projects SET')) {
          const projectId = binds[binds.length - 1] as string;
          const current = projects.get(projectId) ?? {};
          const m = sql.match(/SET (.+) WHERE id = \?/);
          if (m) {
            const cols = m[1].split(',').map((c) => c.trim().split(' ')[0]);
            cols.forEach((col, i) => { current[col] = binds[i]; });
          }
          projects.set(projectId, current);
        }
        return { success: true };
      },
    }),
  });
  return { DB: { prepare }, _projects: projects };
}

function evt(event_name: string, projectId: string | null, attrs: Record<string, unknown> = {}, id = 'sub_1'): LSWebhookEvent {
  return {
    meta: { event_name, custom_data: projectId ? { project_id: projectId } : undefined },
    data: { id, attributes: attrs },
  };
}

const env = (extra: Record<string, string> = {}) => ({ ...extra }) as unknown as Parameters<typeof buildVariantMap>[0];

describe('buildVariantMap', () => {
  it('returns empty map when no env vars set', () => {
    expect(buildVariantMap(env())).toEqual({});
  });

  it('maps each configured variant id to its tier', () => {
    const m = buildVariantMap(env({
      LEMONSQUEEZY_VARIANT_DEV: 'v1',
      LEMONSQUEEZY_VARIANT_GROWTH: 'v2',
      LEMONSQUEEZY_VARIANT_SCALE: 'v3',
    }));
    expect(m).toEqual({ v1: 'dev', v2: 'growth', v3: 'scale' });
  });

  it('skips unset tiers', () => {
    expect(buildVariantMap(env({ LEMONSQUEEZY_VARIANT_GROWTH: 'g' })))
      .toEqual({ g: 'growth' });
  });
});

describe('subscription handlers', () => {
  it('onSubscriptionCreated populates tier, ls ids, status, renewal_at', async () => {
    const db = makeDB();
    const map = { vdev: 'dev' as const };
    const e = evt('subscription_created', 'p1', {
      variant_id: 'vdev', customer_id: 42, renews_at: '2026-05-01T00:00:00Z',
    }, 'sub_abc');
    await onSubscriptionCreated(db as unknown as Parameters<typeof onSubscriptionCreated>[0], e, map);
    const p = db._projects.get('p1')!;
    expect(p.tier).toBe('dev');
    expect(p.ls_subscription_id).toBe('sub_abc');
    expect(p.ls_customer_id).toBe('42');
    expect(p.tier_status).toBe('active');
    expect(typeof p.renewal_at).toBe('number');
    expect(p.renewal_at).toBe(Math.floor(Date.parse('2026-05-01T00:00:00Z') / 1000));
  });

  it('falls back to free when variant id is unknown', async () => {
    const db = makeDB();
    const e = evt('subscription_created', 'p2', { variant_id: 'unknown', customer_id: 1 });
    await onSubscriptionCreated(db as unknown as Parameters<typeof onSubscriptionCreated>[0], e, { vdev: 'dev' });
    expect(db._projects.get('p2')?.tier).toBe('free');
  });

  it('falls back to free when variant id missing entirely', async () => {
    const db = makeDB();
    const e = evt('subscription_created', 'p3', { customer_id: 1 });
    await onSubscriptionCreated(db as unknown as Parameters<typeof onSubscriptionCreated>[0], e, { vdev: 'dev' });
    expect(db._projects.get('p3')?.tier).toBe('free');
  });

  it('onSubscriptionCancelled sets cancel_at_period_end only', async () => {
    const db = makeDB();
    await onSubscriptionCancelled(db as unknown as Parameters<typeof onSubscriptionCancelled>[0], evt('subscription_cancelled', 'p4'));
    expect(db._projects.get('p4')).toEqual({ tier_status: 'cancel_at_period_end' });
  });

  it('onSubscriptionExpired drops to free + expired', async () => {
    const db = makeDB();
    await onSubscriptionExpired(db as unknown as Parameters<typeof onSubscriptionExpired>[0], evt('subscription_expired', 'p5'));
    expect(db._projects.get('p5')).toEqual({ tier: 'free', tier_status: 'expired' });
  });

  it('onPaymentFailed sets past_due', async () => {
    const db = makeDB();
    await onPaymentFailed(db as unknown as Parameters<typeof onPaymentFailed>[0], evt('subscription_payment_failed', 'p6'));
    expect(db._projects.get('p6')?.tier_status).toBe('past_due');
  });

  it('onPaymentRecovered sets active', async () => {
    const db = makeDB();
    await onPaymentRecovered(db as unknown as Parameters<typeof onPaymentRecovered>[0], evt('subscription_payment_recovered', 'p7'));
    expect(db._projects.get('p7')?.tier_status).toBe('active');
  });

  it('skips mutation when project_id missing from custom_data', async () => {
    const db = makeDB();
    await onSubscriptionCreated(db as unknown as Parameters<typeof onSubscriptionCreated>[0], evt('subscription_created', null, { variant_id: 'vdev' }), { vdev: 'dev' });
    expect(db._projects.size).toBe(0);
  });
});

describe('applyEvent dispatch', () => {
  it('applies known events', async () => {
    const db = makeDB();
    const r = await applyEvent(
      db as unknown as Parameters<typeof applyEvent>[0],
      evt('subscription_payment_recovered', 'p9'),
      {},
    );
    expect(r.applied).toBe(true);
    expect(db._projects.get('p9')?.tier_status).toBe('active');
  });

  it('returns applied=false for unknown event', async () => {
    const db = makeDB();
    const r = await applyEvent(
      db as unknown as Parameters<typeof applyEvent>[0],
      evt('something_else', 'p10'),
      {},
    );
    expect(r.applied).toBe(false);
    expect(r.reason).toBe('unknown_event');
  });

  it('returns applied=false for order_created (intentionally ignored)', async () => {
    const db = makeDB();
    const r = await applyEvent(
      db as unknown as Parameters<typeof applyEvent>[0],
      evt('order_created', 'p11'),
      {},
    );
    expect(r.applied).toBe(false);
  });
});
