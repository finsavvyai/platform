import { jest } from '@jest/globals';
import { SubscriptionService } from '../../services/SubscriptionService.js';

// Mock Stripe
const mockStripe = {
  customers: {
    create: jest.fn(),
    retrieve: jest.fn(),
    update: jest.fn(),
  },
  subscriptions: {
    create: jest.fn(),
    retrieve: jest.fn(),
    update: jest.fn(),
    cancel: jest.fn(),
  },
  invoices: {
    create: jest.fn(),
    retrieve: jest.fn(),
  },
  paymentMethods: {
    create: jest.fn(),
    attach: jest.fn(),
  },
};

jest.mock('stripe', () => ({
  Stripe: jest.fn(() => mockStripe),
}));

// Mock database
const mockDb = {
  query: jest.fn(),
  execute: jest.fn(),
};

jest.mock('../../config/database.js', () => ({
  db: mockDb,
}));

describe('SubscriptionService', () => {
  let subscriptionService: SubscriptionService;

  beforeEach(() => {
    jest.clearAllMocks();
    subscriptionService = new SubscriptionService();
  });

  describe('createSubscription', () => {
    it('should create a new subscription successfully', async () => {
      const mockCustomer = { id: 'cus_123', email: 'test@example.com' };
      const mockSubscription = { 
        id: 'sub_123', 
        status: 'active',
        current_period_end: Math.floor(Date.now() / 1000) + 86400
      };

      mockStripe.customers.create.mockResolvedValue(mockCustomer);
      mockStripe.subscriptions.create.mockResolvedValue(mockSubscription);
      mockDb.execute.mockResolvedValue({ rows: [{ id: 1 }] });

      const subscriptionData = {
        userId: 'user_123',
        planId: 'plan_basic',
        email: 'test@example.com',
        paymentMethodId: 'pm_123'
      };

      const result = await subscriptionService.createSubscription(subscriptionData);

      expect(result).toBeDefined();
      expect(result.stripeCustomerId).toBe('cus_123');
      expect(result.stripeSubscriptionId).toBe('sub_123');
      expect(result.status).toBe('active');
      expect(mockStripe.customers.create).toHaveBeenCalledWith({
        email: 'test@example.com',
        payment_method: 'pm_123',
        invoice_settings: { default_payment_method: 'pm_123' }
      });
    });

    it('should handle subscription creation errors', async () => {
      mockStripe.customers.create.mockRejectedValue(new Error('Stripe error'));

      const subscriptionData = {
        userId: 'user_123',
        planId: 'plan_basic',
        email: 'test@example.com',
        paymentMethodId: 'pm_123'
      };

      await expect(subscriptionService.createSubscription(subscriptionData))
        .rejects.toThrow('Stripe error');
    });
  });

  describe('getSubscription', () => {
    it('should retrieve subscription by user ID', async () => {
      const mockSubscription = {
        id: 'sub_123',
        status: 'active',
        plan: { id: 'plan_basic', name: 'Basic Plan' }
      };

      mockDb.query.mockResolvedValue({
        rows: [{
          id: 1,
          user_id: 'user_123',
          stripe_subscription_id: 'sub_123',
          status: 'active',
          plan_id: 'plan_basic'
        }]
      });

      const result = await subscriptionService.getSubscription('user_123');

      expect(result).toBeDefined();
      expect(result.userId).toBe('user_123');
      expect(result.stripeSubscriptionId).toBe('sub_123');
      expect(result.status).toBe('active');
    });

    it('should return null for non-existent subscription', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await subscriptionService.getSubscription('user_123');

      expect(result).toBeNull();
    });
  });

  describe('updateSubscription', () => {
    it('should update subscription plan successfully', async () => {
      const mockSubscription = { 
        id: 'sub_123', 
        status: 'active',
        items: { data: [{ id: 'si_123', price: { id: 'price_pro' } }] }
      };

      mockStripe.subscriptions.retrieve.mockResolvedValue(mockSubscription);
      mockStripe.subscriptions.update.mockResolvedValue(mockSubscription);
      mockDb.execute.mockResolvedValue({ rows: [{ id: 1 }] });

      const updateData = {
        subscriptionId: 'sub_123',
        planId: 'plan_pro'
      };

      const result = await subscriptionService.updateSubscription(updateData);

      expect(result).toBeDefined();
      expect(result.status).toBe('active');
      expect(mockStripe.subscriptions.update).toHaveBeenCalledWith('sub_123', {
        items: [{ id: 'si_123', price: 'price_pro' }],
        proration_behavior: 'create_prorations'
      });
    });

    it('should handle subscription update errors', async () => {
      mockStripe.subscriptions.retrieve.mockRejectedValue(new Error('Update failed'));

      const updateData = {
        subscriptionId: 'sub_123',
        planId: 'plan_pro'
      };

      await expect(subscriptionService.updateSubscription(updateData))
        .rejects.toThrow('Update failed');
    });
  });

  describe('cancelSubscription', () => {
    it('should cancel subscription successfully', async () => {
      const mockSubscription = { 
        id: 'sub_123', 
        status: 'canceled',
        canceled_at: Math.floor(Date.now() / 1000)
      };

      mockStripe.subscriptions.cancel.mockResolvedValue(mockSubscription);
      mockDb.execute.mockResolvedValue({ rows: [{ id: 1 }] });

      const result = await subscriptionService.cancelSubscription('sub_123');

      expect(result).toBeDefined();
      expect(result.status).toBe('canceled');
      expect(mockStripe.subscriptions.cancel).toHaveBeenCalledWith('sub_123');
    });

    it('should handle cancellation errors', async () => {
      mockStripe.subscriptions.cancel.mockRejectedValue(new Error('Cancellation failed'));

      await expect(subscriptionService.cancelSubscription('sub_123'))
        .rejects.toThrow('Cancellation failed');
    });
  });

  describe('getSubscriptionPlans', () => {
    it('should return available subscription plans', async () => {
      const mockPlans = [
        { id: 'plan_basic', name: 'Basic', price: 9.99, features: ['Feature 1'] },
        { id: 'plan_pro', name: 'Pro', price: 19.99, features: ['Feature 1', 'Feature 2'] }
      ];

      mockDb.query.mockResolvedValue({ rows: mockPlans });

      const result = await subscriptionService.getSubscriptionPlans();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('plan_basic');
      expect(result[1].id).toBe('plan_pro');
    });
  });

  describe('getSubscriptionUsage', () => {
    it('should return subscription usage statistics', async () => {
      const mockUsage = {
        recordings: 45,
        tests: 120,
        apiCalls: 1000,
        storage: 2.5
      };

      mockDb.query.mockResolvedValue({ rows: [mockUsage] });

      const result = await subscriptionService.getSubscriptionUsage('user_123');

      expect(result).toBeDefined();
      expect(result.recordings).toBe(45);
      expect(result.tests).toBe(120);
      expect(result.apiCalls).toBe(1000);
      expect(result.storage).toBe(2.5);
    });
  });

  describe('processWebhook', () => {
    it('should process subscription updated webhook', async () => {
      const webhookEvent = {
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_123',
            status: 'active',
            customer: 'cus_123'
          }
        }
      };

      mockDb.execute.mockResolvedValue({ rows: [{ id: 1 }] });

      await subscriptionService.processWebhook(webhookEvent);

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE subscriptions'),
        expect.arrayContaining(['active', 'sub_123'])
      );
    });

    it('should process subscription deleted webhook', async () => {
      const webhookEvent = {
        type: 'customer.subscription.deleted',
        data: {
          object: {
            id: 'sub_123',
            customer: 'cus_123'
          }
        }
      };

      mockDb.execute.mockResolvedValue({ rows: [{ id: 1 }] });

      await subscriptionService.processWebhook(webhookEvent);

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE subscriptions'),
        expect.arrayContaining(['canceled', 'sub_123'])
      );
    });

    it('should handle unknown webhook events', async () => {
      const webhookEvent = {
        type: 'unknown.event',
        data: { object: {} }
      };

      await expect(subscriptionService.processWebhook(webhookEvent))
        .resolves.toBeUndefined();
    });
  });

  describe('validateSubscriptionAccess', () => {
    it('should validate subscription access for feature', async () => {
      const mockSubscription = {
        status: 'active',
        plan: { features: ['feature1', 'feature2'] }
      };

      mockDb.query.mockResolvedValue({ rows: [mockSubscription] });

      const result = await subscriptionService.validateSubscriptionAccess('user_123', 'feature1');

      expect(result).toBe(true);
    });

    it('should deny access for inactive subscription', async () => {
      const mockSubscription = {
        status: 'canceled',
        plan: { features: ['feature1'] }
      };

      mockDb.query.mockResolvedValue({ rows: [mockSubscription] });

      const result = await subscriptionService.validateSubscriptionAccess('user_123', 'feature1');

      expect(result).toBe(false);
    });

    it('should deny access for non-existent feature', async () => {
      const mockSubscription = {
        status: 'active',
        plan: { features: ['feature1'] }
      };

      mockDb.query.mockResolvedValue({ rows: [mockSubscription] });

      const result = await subscriptionService.validateSubscriptionAccess('user_123', 'feature3');

      expect(result).toBe(false);
    });
  });
});


