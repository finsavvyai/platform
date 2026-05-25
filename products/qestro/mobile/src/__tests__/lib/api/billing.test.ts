import { billingApi } from '../../../lib/api';

const mockFetch = jest.fn();
jest.mock('../../../lib/api/client', () => ({
  apiFetch: (...args: unknown[]) => mockFetch(...args),
}));

describe('billingApi', () => {
  beforeEach(() => mockFetch.mockReset());

  it('getBillingPlans fetches plans', async () => {
    mockFetch.mockResolvedValue({ success: true, data: [{ id: 'p1', name: 'Pro' }] });
    const res = await billingApi.getBillingPlans();
    expect(mockFetch).toHaveBeenCalledWith('/api/billing/plans');
    expect(res.data).toHaveLength(1);
  });

  it('getSubscription fetches current subscription', async () => {
    mockFetch.mockResolvedValue({ success: true, data: { planId: 'p1', status: 'active' } });
    const res = await billingApi.getSubscription();
    expect(mockFetch).toHaveBeenCalledWith('/api/billing/subscription');
    expect(res.data).toBeTruthy();
  });

  it('createCheckout returns checkout URL', async () => {
    mockFetch.mockResolvedValue({ success: true, data: { url: 'https://checkout.stripe.com/xxx' } });
    const res = await billingApi.createCheckout({ planId: 'p1' });
    expect(mockFetch).toHaveBeenCalledWith('/api/billing/checkout', expect.objectContaining({ method: 'POST' }));
    expect(res.data?.url).toContain('stripe');
  });

  it('getBillingPortal returns portal URL', async () => {
    mockFetch.mockResolvedValue({ success: true, data: { url: 'https://billing.stripe.com' } });
    const res = await billingApi.getBillingPortal();
    expect(mockFetch).toHaveBeenCalledWith('/api/billing/portal', expect.objectContaining({ method: 'POST' }));
    expect(res.data?.url).toBeTruthy();
  });

  it('cancelSubscription sends POST', async () => {
    mockFetch.mockResolvedValue({ success: true });
    await billingApi.cancelSubscription();
    expect(mockFetch).toHaveBeenCalledWith('/api/billing/subscription/cancel', expect.objectContaining({ method: 'POST' }));
  });
});
