import { beforeEach, describe, expect, it, vi } from 'vitest';
import SubscriptionService from '../subscription-service';

describe('SubscriptionService input validation', () => {
  let subscriptionService: SubscriptionService;

  beforeEach(() => {
    const mockDb = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn(),
          run: vi.fn(),
          all: vi.fn()
        })
      })
    };

    subscriptionService = new SubscriptionService({
      DB_BILLING_US: mockDb,
      DB_BILLING_EU: mockDb
    } as any);
  });

  it('rejects invalid customer UUID format', async () => {
    await expect(
      subscriptionService.createSubscription(
        '550e8400-e29b-41d4-a716-446655440010',
        'user_123',
        {
          customer_id: 'cust_123',
          plan_id: '550e8400-e29b-41d4-a716-446655440001',
          billing_cycle: 'monthly'
        }
      )
    ).rejects.toThrow('Invalid customer ID format');
  });

  it('rejects invalid plan UUID format', async () => {
    await expect(
      subscriptionService.createSubscription(
        '550e8400-e29b-41d4-a716-446655440010',
        'user_123',
        {
          customer_id: '550e8400-e29b-41d4-a716-446655440000',
          plan_id: 'plan_123',
          billing_cycle: 'monthly'
        }
      )
    ).rejects.toThrow('Invalid plan ID format');
  });

  it('rejects unsupported billing cycle', async () => {
    await expect(
      subscriptionService.createSubscription(
        '550e8400-e29b-41d4-a716-446655440010',
        'user_123',
        {
          customer_id: '550e8400-e29b-41d4-a716-446655440000',
          plan_id: '550e8400-e29b-41d4-a716-446655440001',
          billing_cycle: 'weekly' as any
        }
      )
    ).rejects.toThrow('Invalid billing cycle');
  });
});

