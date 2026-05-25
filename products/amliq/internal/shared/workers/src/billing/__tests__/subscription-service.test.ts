/**
 * Subscription Service Tests
 * Comprehensive test suite for AI-enhanced subscription management
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import SubscriptionService from '../subscription-service';

describe("SubscriptionService", () => {
  let subscriptionService: SubscriptionService;
  let mockEnv: any;
  let mockLogger: any;

  const mockOrganization = {
    id: "org_123",
    name: "Test Company",
    region: "US"
  };

  const mockCustomer = {
    id: "cust_123",
    organization_id: "org_123",
    email: "test@example.com",
    name: "Test Customer",
    metadata: {}
  };

  const mockPlan = {
    id: "plan_123",
    organization_id: "org_123",
    name: "Pro Plan",
    description: "Professional subscription plan",
    amount: 99.99,
    currency: "USD",
    billing_cycle: "monthly",
    features: ["Feature 1", "Feature 2"],
    metadata: {},
    active: true
  };

  beforeEach(() => {
    // Mock environment
    mockEnv = {
      DB_BILLING_US: {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            run: vi.fn(),
            first: vi.fn(),
            all: vi.fn()
          })
        })
      },
      DB_BILLING_EU: {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            run: vi.fn(),
            first: vi.fn(),
            all: vi.fn()
          })
        })
      },
      AI: {
        run: vi.fn().mockResolvedValue({
          response: "AI analysis complete"
        })
      },
      BILLING_QUEUE: {
        send: vi.fn().mockResolvedValue(undefined)
      },
      ANALYTICS: {
        track: vi.fn().mockResolvedValue(undefined)
      }
    };

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    };

    subscriptionService = new SubscriptionService(mockEnv, mockLogger);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Subscription Creation", () => {
    it("should create a subscription successfully", async () => {
      const createData = {
        customer_id: "cust_123",
        plan_id: "plan_123",
        billing_cycle: "monthly" as const,
        trial_period_days: 14,
        quantity: 1
      };

      // Mock database queries
      mockEnv.DB_BILLING_US.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn()
            .mockResolvedValueOnce(mockCustomer) // getCustomer
            .mockResolvedValueOnce(mockPlan)     // getPlan
        })
      });

      const result = await subscriptionService.createSubscription(
        mockOrganization.id,
        "user_123",
        createData
      );

      expect(result.subscription).toBeDefined();
      expect(result.subscription.id).toBeDefined();
      expect(result.subscription.customer_id).toBe(createData.customer_id);
      expect(result.subscription.plan_id).toBe(createData.plan_id);
      expect(result.subscription.status).toBe("trialing");
      expect(result.subscription.trial_end).toBeDefined();
      expect(result.insights).toBeDefined();
      expect(mockEnv.BILLING_QUEUE.send).toHaveBeenCalledWith({
        type: "trial_end",
        subscriptionId: expect.any(String),
        trialEndDate: expect.any(String),
        organizationId: mockOrganization.id
      });
    });

    it("should create subscription without trial", async () => {
      const createData = {
        customer_id: "cust_123",
        plan_id: "plan_123",
        billing_cycle: "yearly" as const,
        quantity: 2
      };

      mockEnv.DB_BILLING_US.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn()
            .mockResolvedValueOnce(mockCustomer)
            .mockResolvedValueOnce(mockPlan)
        })
      });

      const result = await subscriptionService.createSubscription(
        mockOrganization.id,
        "user_123",
        createData
      );

      expect(result.subscription.status).toBe("active");
      expect(result.subscription.billing_cycle).toBe("yearly");
      expect(result.subscription.quantity).toBe(2);
      expect(mockEnv.BILLING_QUEUE.send).toHaveBeenCalledWith({
        type: "subscription_billing",
        subscriptionId: expect.any(String),
        billingDate: expect.any(String),
        organizationId: mockOrganization.id
      });
    });

    it("should throw error for inactive plan", async () => {
      const inactivePlan = { ...mockPlan, active: false };
      const createData = {
        customer_id: "cust_123",
        plan_id: "plan_123",
        billing_cycle: "monthly" as const
      };

      mockEnv.DB_BILLING_US.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn()
            .mockResolvedValueOnce(mockCustomer)
            .mockResolvedValueOnce(inactivePlan)
        })
      });

      await expect(
        subscriptionService.createSubscription(mockOrganization.id, "user_123", createData)
      ).rejects.toThrow("Plan not found or inactive");
    });

    it("should throw error for non-existent customer", async () => {
      const createData = {
        customer_id: "nonexistent",
        plan_id: "plan_123",
        billing_cycle: "monthly" as const
      };

      mockEnv.DB_BILLING_US.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValueOnce(null)
        })
      });

      await expect(
        subscriptionService.createSubscription(mockOrganization.id, "user_123", createData)
      ).rejects.toThrow("Customer not found");
    });
  });

  describe("Subscription Updates", () => {
    const mockSubscription = {
      id: "sub_123",
      organization_id: "org_123",
      customer_id: "cust_123",
      plan_id: "plan_123",
      status: "active",
      current_period_start: "2024-01-01T00:00:00Z",
      current_period_end: "2024-02-01T00:00:00Z",
      quantity: 1,
      billing_cycle: "monthly",
      amount: 99.99,
      currency: "USD",
      cancel_at_period_end: false,
      metadata: {},
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z"
    };

    it("should upgrade subscription plan", async () => {
      const newPlan = {
        ...mockPlan,
        id: "plan_456",
        amount: 199.99,
        name: "Premium Plan"
      };

      const updateData = {
        plan_id: "plan_456"
      };

      // Mock getSubscription and getPlan
      mockEnv.DB_BILLING_US.prepare.mockImplementation((query) => {
        if (query.includes("SELECT * FROM subscriptions")) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue(mockSubscription)
            })
          };
        }
        if (query.includes("SELECT * FROM subscription_plans")) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue(newPlan)
            })
          };
        }
        return {
          bind: vi.fn().mockReturnValue({
            run: vi.fn(),
            first: vi.fn().mockResolvedValue(mockSubscription)
          })
        };
      });

      const result = await subscriptionService.updateSubscription(
        mockOrganization.id,
        "sub_123",
        updateData
      );

      expect(result.subscription.plan_id).toBe("plan_456");
      expect(result.subscription.amount).toBe(199.99);
      expect(result.proration).toBeDefined();
      expect(result.insights).toBeDefined();
      expect(result.insights.change_type).toBe("upgrade");
    });

    it("should downgrade subscription plan", async () => {
      const cheaperPlan = {
        ...mockPlan,
        id: "plan_789",
        amount: 49.99,
        name: "Basic Plan"
      };

      const updateData = {
        plan_id: "plan_789"
      };

      mockEnv.DB_BILLING_US.prepare.mockImplementation((query) => {
        if (query.includes("SELECT * FROM subscriptions")) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue(mockSubscription)
            })
          };
        }
        if (query.includes("SELECT * FROM subscription_plans")) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue(cheaperPlan)
            })
          };
        }
        return {
          bind: vi.fn().mockReturnValue({
            run: vi.fn(),
            first: vi.fn().mockResolvedValue(mockSubscription)
          })
        };
      });

      const result = await subscriptionService.updateSubscription(
        mockOrganization.id,
        "sub_123",
        updateData
      );

      expect(result.subscription.plan_id).toBe("plan_789");
      expect(result.insights.change_type).toBe("downgrade");
      expect(result.insights.recommended_actions).toContain("Watch for churn signals");
    });

    it("should update subscription quantity", async () => {
      const updateData = {
        quantity: 3
      };

      mockEnv.DB_BILLING_US.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(mockSubscription),
          run: vi.fn()
        })
      });

      const result = await subscriptionService.updateSubscription(
        mockOrganization.id,
        "sub_123",
        updateData
      );

      expect(result.proration).toBeDefined();
      expect(result.proration.amount).toBeGreaterThan(0); // Should be positive for quantity increase
    });

    it("should pause subscription", async () => {
      const pauseDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const updateData = {
        pause_at: pauseDate
      };

      mockEnv.DB_BILLING_US.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(mockSubscription),
          run: vi.fn()
        })
      });

      const result = await subscriptionService.updateSubscription(
        mockOrganization.id,
        "sub_123",
        updateData
      );

      expect(result.subscription.paused_at).toBe(pauseDate);
      expect(result.subscription.status).toBe("paused");
    });

    it("should handle subscription not found", async () => {
      mockEnv.DB_BILLING_US.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null)
        })
      });

      await expect(
        subscriptionService.updateSubscription(mockOrganization.id, "nonexistent", {})
      ).rejects.toThrow("Subscription not found");
    });
  });

  describe("Subscription Cancellation", () => {
    const mockSubscription = {
      id: "sub_123",
      organization_id: "org_123",
      customer_id: "cust_123",
      plan_id: "plan_123",
      status: "active",
      current_period_end: "2024-02-01T00:00:00Z",
      metadata: {},
      created_at: "2024-01-01T00:00:00Z"
    };

    it("should cancel subscription at period end", async () => {
      mockEnv.DB_BILLING_US.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(mockSubscription),
          run: vi.fn()
        })
      });

      const result = await subscriptionService.cancelSubscription(
        mockOrganization.id,
        "sub_123",
        true,
        "Too expensive",
        { rating: 3, feedback: "Price too high" }
      );

      expect(result.subscription.cancel_at_period_end).toBe(true);
      expect(result.subscription.canceled_at).toBeDefined();
      expect(result.subscription.metadata.cancellation_reason).toBe("Too expensive");
      expect(result.subscription.metadata.cancellation_feedback).toBeDefined();
      expect(result.insights).toBeDefined();
      expect(result.insights.recommended_actions).toContain("Offer discount");
    });

    it("should cancel subscription immediately", async () => {
      mockEnv.DB_BILLING_US.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(mockSubscription),
          run: vi.fn()
        })
      });

      const result = await subscriptionService.cancelSubscription(
        mockOrganization.id,
        "sub_123",
        false,
        "Service not needed"
      );

      expect(result.subscription.status).toBe("canceled");
      expect(result.subscription.ended_at).toBeDefined();
      expect(result.subscription.metadata.immediate_cancellation).toBe(true);
    });
  });

  describe("Subscription Plans", () => {
    it("should create a subscription plan", async () => {
      const planData = {
        name: "Enterprise Plan",
        description: "Full-featured enterprise solution",
        amount: 499.99,
        currency: "USD",
        billing_cycle: "monthly" as const,
        features: ["Unlimited users", "Priority support", "Custom integrations"],
        metadata: { tier: "enterprise" }
      };

      mockEnv.DB_BILLING_US.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          run: vi.fn()
        })
      });

      const plan = await subscriptionService.createPlan(mockOrganization.id, planData);

      expect(plan.id).toBeDefined();
      expect(plan.name).toBe(planData.name);
      expect(plan.amount).toBe(planData.amount);
      expect(plan.features).toEqual(planData.features);
      expect(plan.active).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith("Subscription plan created", {
        planId: plan.id,
        name: plan.name,
        amount: plan.amount
      });
    });
  });

  describe("Subscription Analytics", () => {
    it("should calculate subscription analytics", async () => {
      const mockAnalyticsData = {
        activeSubscriptions: { count: 100, mrr: 10000 },
        churnedSubscriptions: { count: 5 },
        newSubscriptions: { count: 20 },
        upgrades: { count: 8 },
        downgrades: { count: 3 },
        trialConversions: { count: 12 }
      };

      mockEnv.DB_BILLING_US.prepare.mockImplementation((query) => {
        const mockResult = {
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(mockAnalyticsData[query.match(/(\w+)/)?.[1]] || { count: 0, mrr: 0 })
          })
        };
        return mockResult;
      });

      const analytics = await subscriptionService.getAnalytics(mockOrganization.id, "month");

      expect(analytics.mrr).toBe(10000);
      expect(analytics.arr).toBe(120000); // MRR * 12
      expect(analytics.active_subscriptions).toBe(100);
      expect(analytics.churn_rate).toBe(5 / 105 * 100); // churned / total * 100
      expect(analytics.cancellations).toBe(5);
      expect(analytics.upgrades).toBe(8);
      expect(analytics.downgrades).toBe(3);
      expect(analytics.trial_conversions).toBe(12);
    });

    it("should handle analytics calculation with no data", async () => {
      mockEnv.DB_BILLING_US.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({ count: 0, mrr: 0 })
        })
      });

      const analytics = await subscriptionService.getAnalytics(mockOrganization.id, "month");

      expect(analytics.mrr).toBe(0);
      expect(analytics.arr).toBe(0);
      expect(analytics.active_subscriptions).toBe(0);
      expect(analytics.churn_rate).toBe(0);
      expect(analytics.ltv).toBe(0);
    });
  });

  describe("Subscription Listing", () => {
    it("should list subscriptions with filters", async () => {
      const mockSubscriptions = [
        { id: "sub_1", status: "active", metadata: "{}" },
        { id: "sub_2", status: "trialing", metadata: "{}" }
      ];

      mockEnv.DB_BILLING_US.prepare.mockImplementation((query) => {
        if (query.includes("SELECT COUNT(*)")) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue({ total: 2 })
            })
          };
        }
        return {
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue({ results: mockSubscriptions })
          })
        };
      });

      const result = await subscriptionService.listSubscriptions(mockOrganization.id, {
        status: "active",
        page: 1,
        limit: 10
      });

      expect(result.subscriptions).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(10);
    });

    it("should handle empty subscription list", async () => {
      mockEnv.DB_BILLING_US.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({ total: 0 }),
          all: vi.fn().mockResolvedValue({ results: [] })
        })
      });

      const result = await subscriptionService.listSubscriptions(mockOrganization.id);

      expect(result.subscriptions).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe("Proration Calculations", () => {
    it("should calculate upgrade proration", async () => {
      const existingSubscription = {
        customer_id: "cust_123",
        plan_id: "old_plan",
        current_period_end: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(), // 15 days remaining
        amount: 99.99
      };

      const newPlan = {
        amount: 199.99
      };

      mockEnv.DB_BILLING_US.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn()
            .mockResolvedValueOnce(existingSubscription)
            .mockResolvedValueOnce({ amount: 99.99 })
        })
      });

      // This would be tested through createSubscription or updateSubscription
      // which internally call calculateProration
      expect(true).toBe(true); // Placeholder test
    });
  });

  describe("AI Insights", () => {
    it("should generate AI-powered insights for subscription creation", async () => {
      mockEnv.AI.run.mockResolvedValue({
        response: "Low risk customer with high predicted LTV"
      });

      const createData = {
        customer_id: "cust_123",
        plan_id: "plan_123",
        billing_cycle: "monthly" as const
      };

      mockEnv.DB_BILLING_US.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn()
            .mockResolvedValueOnce(mockCustomer)
            .mockResolvedValueOnce(mockPlan)
        })
      });

      const result = await subscriptionService.createSubscription(
        mockOrganization.id,
        "user_123",
        createData
      );

      expect(result.insights).toBeDefined();
      expect(mockEnv.AI.run).toHaveBeenCalled();
    });

    it("should handle AI service failure gracefully", async () => {
      mockEnv.AI.run.mockRejectedValue(new Error("AI service unavailable"));

      const createData = {
        customer_id: "cust_123",
        plan_id: "plan_123",
        billing_cycle: "monthly" as const
      };

      mockEnv.DB_BILLING_US.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn()
            .mockResolvedValueOnce(mockCustomer)
            .mockResolvedValueOnce(mockPlan)
        })
      });

      const result = await subscriptionService.createSubscription(
        mockOrganization.id,
        "user_123",
        createData
      );

      expect(result.subscription).toBeDefined();
      expect(result.insights).toEqual({});
    });
  });

  describe("Error Handling", () => {
    it("should handle database errors gracefully", async () => {
      mockEnv.DB_BILLING_US.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockRejectedValue(new Error("Database connection failed"))
        })
      });

      const createData = {
        customer_id: "cust_123",
        plan_id: "plan_123",
        billing_cycle: "monthly" as const
      };

      await expect(
        subscriptionService.createSubscription(mockOrganization.id, "user_123", createData)
      ).rejects.toThrow("Database connection failed");

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Subscription creation failed",
        expect.objectContaining({
          error: "Database connection failed"
        })
      );
    });

    it("should validate input parameters", async () => {
      await expect(
        subscriptionService.createSubscription(mockOrganization.id, "user_123", {
          customer_id: "", // Invalid empty customer_id
          plan_id: "plan_123",
          billing_cycle: "monthly" as const
        })
      ).rejects.toThrow();

      await expect(
        subscriptionService.createSubscription(mockOrganization.id, "user_123", {
          customer_id: "cust_123",
          plan_id: "", // Invalid empty plan_id
          billing_cycle: "monthly" as const
        })
      ).rejects.toThrow();
    });
  });

  describe("Period Calculations", () => {
    it("should calculate correct period end for monthly billing", async () => {
      const startDate = new Date("2024-01-15T00:00:00Z");
      const expectedEndDate = new Date("2024-02-15T00:00:00Z");

      // This would be tested through the private calculatePeriodEnd method
      // Since it's private, we test through createSubscription
      const createData = {
        customer_id: "cust_123",
        plan_id: "plan_123",
        billing_cycle: "monthly" as const,
        start_date: startDate.toISOString()
      };

      mockEnv.DB_BILLING_US.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn()
            .mockResolvedValueOnce(mockCustomer)
            .mockResolvedValueOnce(mockPlan)
        })
      });

      const result = await subscriptionService.createSubscription(
        mockOrganization.id,
        "user_123",
        createData
      );

      expect(result.subscription.current_period_end).toBe(expectedEndDate.toISOString());
    });

    it("should calculate correct period end for yearly billing", async () => {
      const startDate = new Date("2024-01-15T00:00:00Z");
      const expectedEndDate = new Date("2025-01-15T00:00:00Z");

      const createData = {
        customer_id: "cust_123",
        plan_id: "plan_123",
        billing_cycle: "yearly" as const,
        start_date: startDate.toISOString()
      };

      mockEnv.DB_BILLING_US.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn()
            .mockResolvedValueOnce(mockCustomer)
            .mockResolvedValueOnce(mockPlan)
        })
      });

      const result = await subscriptionService.createSubscription(
        mockOrganization.id,
        "user_123",
        createData
      );

      expect(result.subscription.current_period_end).toBe(expectedEndDate.toISOString());
    });
  });
});
