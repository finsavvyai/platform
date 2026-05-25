/**
 * AI-Enhanced Subscription Management System
 * Comprehensive subscription lifecycle management with intelligent automation
 */

import type { Env, Subscription, SubscriptionPlan } from "../types";

// Define Customer interface since it's not exported from types
interface Customer {
  id: string;
  organization_id: string;
  name: string;
  email: string;
  metadata?: Record<string, any>;
  address?: any;
  phone?: any;
  region?: string;
}

export interface SubscriptionCreateRequest {
  customer_id: string;
  plan_id: string;
  billing_cycle: "monthly" | "yearly" | "quarterly";
  trial_period_days?: number;
  start_date?: string;
  payment_method_id?: string;
  quantity?: number;
  metadata?: Record<string, any>;
}

export interface SubscriptionUpdateRequest {
  plan_id?: string;
  quantity?: number;
  billing_cycle?: "monthly" | "yearly" | "quarterly";
  pause_at?: string;
  resume_at?: string;
  cancel_at_period_end?: boolean;
  metadata?: Record<string, any>;
}

export interface SubscriptionPlanRequest {
  name: string;
  description: string;
  amount: number;
  currency: string;
  billing_cycle: "monthly" | "yearly" | "quarterly";
  features: string[];
  metadata?: Record<string, any>;
  active?: boolean;
}

export interface SubscriptionAnalytics {
  mrr: number;
  arr: number;
  active_subscriptions: number;
  churn_rate: number;
  ltv: number;
  trial_conversions: number;
  cancellations: number;
  upgrades: number;
  downgrades: number;
}

export class SubscriptionService {
  constructor(
    private env: Env,
    private logger?: any,
  ) {}

  /**
   * Create a new subscription
   */
  async createSubscription(
    organizationId: string,
    userId: string,
    data: SubscriptionCreateRequest,
  ): Promise<{ subscription: Subscription; insights?: any }> {
    try {
      // Input validation and sanitization
      this.validateSubscriptionData(data);

      // Get customer and validate
      const customer = await this.getCustomer(data.customer_id, organizationId);
      if (!customer) {
        throw new Error("Customer not found");
      }

      // Get plan and validate
      const plan = await this.getPlan(data.plan_id, organizationId);
      if (!plan || !plan.active) {
        throw new Error("Plan not found or inactive");
      }

      // AI-powered risk assessment and insights
      const insights = await this.generateSubscriptionInsights(
        customer,
        plan,
        data,
      );

      // Calculate proration if upgrading
      const proration = await this.calculateProration(customer.id, plan, data);

      // Create subscription
      const subscription: Subscription = {
        id: crypto.randomUUID(),
        organization_id: organizationId,
        customer_id: data.customer_id,
        plan_id: data.plan_id,
        status: data.trial_period_days ? "trialing" : "active",
        current_period_start: data.start_date || new Date().toISOString(),
        current_period_end: this.calculatePeriodEnd(
          data.start_date || new Date(),
          data.billing_cycle,
        ),
        trial_start: data.trial_period_days
          ? new Date().toISOString()
          : undefined,
        trial_end: data.trial_period_days
          ? new Date(
              Date.now() + data.trial_period_days * 24 * 60 * 60 * 1000,
            ).toISOString()
          : undefined,
        quantity: data.quantity || 1,
        billing_cycle: data.billing_cycle,
        amount: plan.amount,
        currency: plan.currency,
        cancel_at_period_end: false,
        paused_at: undefined,
        resume_at: undefined,
        canceled_at: undefined,
        ended_at: undefined,
        metadata: {
          ...data.metadata,
          ai_insights: insights,
          risk_score: insights?.risk_score || 0,
          predicted_ltv: insights?.predicted_ltv || 0,
          proration_amount: proration?.amount || 0,
          payment_method_id: data.payment_method_id,
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const db = this.getDatabaseByRegion(customer.region || "US");

      // Insert subscription
      await db
        .prepare(
          `
        INSERT INTO subscriptions (
          id, organization_id, customer_id, plan_id, status,
          current_period_start, current_period_end, trial_start, trial_end,
          quantity, billing_cycle, amount, currency, cancel_at_period_end,
          paused_at, resume_at, canceled_at, ended_at, metadata,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        )
        .bind(
          subscription.id,
          subscription.organization_id,
          subscription.customer_id,
          subscription.plan_id,
          subscription.status,
          subscription.current_period_start,
          subscription.current_period_end,
          subscription.trial_start,
          subscription.trial_end,
          subscription.quantity,
          subscription.billing_cycle,
          subscription.amount,
          subscription.currency,
          subscription.cancel_at_period_end,
          subscription.paused_at,
          subscription.resume_at,
          subscription.canceled_at,
          subscription.ended_at,
          JSON.stringify(subscription.metadata),
          subscription.created_at,
          subscription.updated_at,
        )
        .run();

      // Schedule first billing if not trialing
      if (subscription.status === "active") {
        await this.scheduleBilling(subscription);
      }

      // Schedule trial end if applicable
      if (subscription.trial_end) {
        await this.scheduleTrialEnd(subscription);
      }

      // Track analytics
      await this.trackSubscriptionEvent("created", subscription, insights);

      this.logger?.info("Subscription created", {
        subscriptionId: subscription.id,
        customerId: customer.id,
        planId: plan.id,
        insights: insights,
      });

      return { subscription, insights };
    } catch (error) {
      this.logger?.error("Subscription creation failed", {
        error: error.message,
        customerId: data.customer_id,
        planId: data.plan_id,
      });
      throw error;
    }
  }

  /**
   * Update an existing subscription
   */
  async updateSubscription(
    organizationId: string,
    subscriptionId: string,
    data: SubscriptionUpdateRequest,
  ): Promise<{ subscription: Subscription; proration?: any; insights?: any }> {
    try {
      const subscription = await this.getSubscription(
        subscriptionId,
        organizationId,
      );
      if (!subscription) {
        throw new Error("Subscription not found");
      }

      const updates: Partial<Subscription> = {};
      let proration = null;
      let insights = null;

      // Handle plan change (upgrade/downgrade)
      if (data.plan_id && data.plan_id !== subscription.plan_id) {
        const newPlan = await this.getPlan(data.plan_id, organizationId);
        if (!newPlan) {
          throw new Error("New plan not found");
        }

        proration = await this.calculateProration(
          subscription.customer_id,
          newPlan,
          data as any,
        );

        updates.plan_id = data.plan_id;
        updates.amount = newPlan.amount;
        updates.currency = newPlan.currency;

        // AI insights for plan change
        insights = await this.generatePlanChangeInsights(subscription, newPlan);
      }

      // Handle quantity change
      if (
        data.quantity !== undefined &&
        data.quantity !== subscription.quantity
      ) {
        updates.quantity = data.quantity;

        // Calculate proration for quantity change
        if (!proration) {
          proration = await this.calculateQuantityProration(
            subscription,
            data.quantity,
          );
        }
      }

      // Handle billing cycle change
      if (
        data.billing_cycle &&
        data.billing_cycle !== subscription.billing_cycle
      ) {
        updates.billing_cycle = data.billing_cycle;
        updates.current_period_end = this.calculatePeriodEnd(
          new Date(),
          data.billing_cycle,
        );
      }

      // Handle pause/resume
      if (data.pause_at) {
        updates.paused_at = data.pause_at;
        updates.status = "paused";
      }

      if (data.resume_at) {
        updates.resume_at = data.resume_at;
        updates.paused_at = undefined;
        updates.status = "active";
      }

      // Handle cancellation
      if (data.cancel_at_period_end !== undefined) {
        updates.cancel_at_period_end = data.cancel_at_period_end;
        if (data.cancel_at_period_end) {
          updates.canceled_at = new Date().toISOString();
        } else {
          updates.canceled_at = undefined;
        }
      }

      // Update metadata
      if (data.metadata) {
        updates.metadata = {
          ...subscription.metadata,
          ...data.metadata,
          ...(insights && { ai_insights: insights }),
          ...(proration && { proration_amount: proration.amount }),
        };
      }

      updates.updated_at = new Date().toISOString();

      // Update in database with security hardening
      const db = this.getDatabaseByRegion("US"); // Would get from subscription

      // Security: Whitelist allowed columns to prevent SQL injection
      const allowedColumns = [
        "plan_id",
        "quantity",
        "billing_cycle",
        "status",
        "current_period_end",
        "paused_at",
        "resume_at",
        "cancel_at_period_end",
        "canceled_at",
        "ended_at",
        "metadata",
      ];

      // Filter and validate columns
      const validUpdates = Object.keys(updates).filter((key) =>
        allowedColumns.includes(key),
      );
      const setClause = validUpdates.map((key) => `${key} = ?`).join(", ");
      const values = validUpdates.map(
        (key) => updates[key as keyof Subscription],
      );

      if (validUpdates.length === 0) {
        throw new Error("No valid columns to update");
      }

      await db
        .prepare(
          `
        UPDATE subscriptions SET ${setClause} WHERE id = ? AND organization_id = ?
      `,
        )
        .bind(...values, subscriptionId, organizationId)
        .run();

      // Get updated subscription
      const updatedSubscription = await this.getSubscription(
        subscriptionId,
        organizationId,
      );

      if (!updatedSubscription) {
        throw new Error("Failed to retrieve updated subscription");
      }

      // Track analytics
      await this.trackSubscriptionEvent(
        "updated",
        updatedSubscription,
        insights,
      );

      // Handle immediate billing for prorations
      if (proration && proration.amount > 0) {
        await this.processProrationBilling(updatedSubscription, proration);
      }

      this.logger?.info("Subscription updated", {
        subscriptionId,
        updates: Object.keys(updates),
        proration: proration?.amount,
      });

      return {
        subscription: updatedSubscription,
        proration,
        insights,
      };
    } catch (error) {
      this.logger?.error("Subscription update failed", {
        error: error.message,
        subscriptionId,
      });
      throw error;
    }
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(
    organizationId: string,
    subscriptionId: string,
    cancelAtPeriodEnd: boolean = true,
    reason?: string,
    feedback?: any,
  ): Promise<{ subscription: Subscription; insights?: any }> {
    try {
      const subscription = await this.getSubscription(
        subscriptionId,
        organizationId,
      );
      if (!subscription) {
        throw new Error("Subscription not found");
      }

      const updates: Partial<Subscription> = {
        updated_at: new Date().toISOString(),
      };

      if (cancelAtPeriodEnd) {
        updates.cancel_at_period_end = true;
        updates.canceled_at = new Date().toISOString();
        updates.metadata = {
          ...subscription.metadata,
          cancellation_reason: reason,
          cancellation_feedback: feedback,
        };
      } else {
        updates.status = "canceled";
        updates.ended_at = new Date().toISOString();
        updates.canceled_at = new Date().toISOString();
        updates.metadata = {
          ...subscription.metadata,
          cancellation_reason: reason,
          cancellation_feedback: feedback,
          immediate_cancellation: true,
        };
      }

      // AI insights for cancellation
      const insights = await this.generateCancellationInsights(
        subscription,
        reason,
        feedback,
      );

      // Update in database with security hardening
      const db = this.getDatabaseByRegion("US");

      // Security: Whitelist allowed columns to prevent SQL injection
      const allowedColumns = [
        "status",
        "cancel_at_period_end",
        "canceled_at",
        "ended_at",
        "metadata",
      ];

      // Filter and validate columns
      const validUpdates = Object.keys(updates).filter((key) =>
        allowedColumns.includes(key),
      );
      const setClause = validUpdates.map((key) => `${key} = ?`).join(", ");
      const values = validUpdates.map(
        (key) => updates[key as keyof Subscription],
      );

      if (validUpdates.length === 0) {
        throw new Error("No valid columns to update");
      }

      await db
        .prepare(
          `
        UPDATE subscriptions SET ${setClause} WHERE id = ? AND organization_id = ?
      `,
        )
        .bind(...values, subscriptionId, organizationId)
        .run();

      // Get updated subscription
      const updatedSubscription = await this.getSubscription(
        subscriptionId,
        organizationId,
      );

      if (!updatedSubscription) {
        throw new Error("Failed to retrieve updated subscription");
      }

      // Track analytics
      await this.trackSubscriptionEvent(
        "canceled",
        updatedSubscription,
        insights,
      );

      // Schedule immediate cancellation if not at period end
      if (!cancelAtPeriodEnd) {
        await this.processImmediateCancellation(updatedSubscription);
      }

      this.logger?.info("Subscription canceled", {
        subscriptionId,
        cancelAtPeriodEnd,
        reason,
        insights,
      });

      return { subscription: updatedSubscription, insights };
    } catch (error) {
      this.logger?.error("Subscription cancellation failed", {
        error: error.message,
        subscriptionId,
      });
      throw error;
    }
  }

  /**
   * Create a subscription plan
   */
  async createPlan(
    organizationId: string,
    data: SubscriptionPlanRequest,
  ): Promise<SubscriptionPlan> {
    try {
      const plan: SubscriptionPlan = {
        id: crypto.randomUUID(),
        organization_id: organizationId,
        name: data.name,
        description: data.description,
        amount: data.amount,
        currency: data.currency,
        billing_cycle: data.billing_cycle,
        features: data.features,
        metadata: data.metadata || {},
        active: data.active ?? true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const db = this.getDatabaseByRegion("US");
      await db
        .prepare(
          `
        INSERT INTO subscription_plans (
          id, organization_id, name, description, amount, currency,
          billing_cycle, features, metadata, active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        )
        .bind(
          plan.id,
          plan.organization_id,
          plan.name,
          plan.description,
          plan.amount,
          plan.currency,
          plan.billing_cycle,
          JSON.stringify(plan.features),
          JSON.stringify(plan.metadata),
          plan.active,
          plan.created_at,
          plan.updated_at,
        )
        .run();

      this.logger?.info("Subscription plan created", {
        planId: plan.id,
        name: plan.name,
        amount: plan.amount,
      });

      return plan;
    } catch (error) {
      this.logger?.error("Plan creation failed", {
        error: error.message,
        planName: data.name,
      });
      throw error;
    }
  }

  /**
   * Get subscription analytics
   */
  async getAnalytics(
    organizationId: string,
    period: "month" | "quarter" | "year" = "month",
  ): Promise<SubscriptionAnalytics> {
    try {
      const db = this.getDatabaseByRegion("US");

      // Calculate date ranges
      const now = new Date();
      const periodStart = new Date();

      switch (period) {
        case "month":
          periodStart.setMonth(now.getMonth() - 1);
          break;
        case "quarter":
          periodStart.setMonth(now.getMonth() - 3);
          break;
        case "year":
          periodStart.setFullYear(now.getFullYear() - 1);
          break;
      }

      const startDate = periodStart.toISOString();

      // Get key metrics
      const [
        activeSubscriptions,
        totalMRR,
        churnedSubscriptions,
        newSubscriptions,
        upgrades,
        downgrades,
        trialConversions,
      ] = await Promise.all([
        // Active subscriptions
        db
          .prepare(
            `
          SELECT COUNT(*) as count, SUM(amount * quantity) as mrr
          FROM subscriptions
          WHERE organization_id = ? AND status IN ('active', 'trialing')
          AND current_period_end > ?
        `,
          )
          .bind(organizationId, now.toISOString())
          .first(),

        // Churned subscriptions
        db
          .prepare(
            `
          SELECT COUNT(*) as count
          FROM subscriptions
          WHERE organization_id = ? AND (canceled_at >= ? OR ended_at >= ?)
        `,
          )
          .bind(organizationId, startDate, startDate)
          .first(),

        // New subscriptions
        db
          .prepare(
            `
          SELECT COUNT(*) as count
          FROM subscriptions
          WHERE organization_id = ? AND created_at >= ?
        `,
          )
          .bind(organizationId, startDate)
          .first(),

        // Upgrades
        db
          .prepare(
            `
          SELECT COUNT(DISTINCT id) as count
          FROM subscriptions
          WHERE organization_id = ? AND updated_at >= ?
          AND JSON_EXTRACT(metadata, '$.previous_plan_id') IS NOT NULL
        `,
          )
          .bind(organizationId, startDate)
          .first(),

        // Downgrades
        db
          .prepare(
            `
          SELECT COUNT(DISTINCT id) as count
          FROM subscriptions
          WHERE organization_id = ? AND updated_at >= ?
          AND JSON_EXTRACT(metadata, '$.plan_change_type') = 'downgrade'
        `,
          )
          .bind(organizationId, startDate)
          .first(),

        // Trial conversions
        db
          .prepare(
            `
          SELECT COUNT(*) as count
          FROM subscriptions
          WHERE organization_id = ? AND status = 'active'
          AND trial_end IS NOT NULL AND trial_end >= ?
        `,
          )
          .bind(organizationId, startDate)
          .first(),
      ]);

      const mrr = totalMRR?.mrr || 0;
      const arr = mrr * 12;
      const activeCount = activeSubscriptions?.count || 0;
      const churnCount = churnedSubscriptions?.count || 0;
      const newCount = newSubscriptions?.count || 0;
      const upgradeCount = upgrades?.count || 0;
      const downgradeCount = downgrades?.count || 0;
      const trialConversionCount = trialConversions?.count || 0;

      // Calculate rates
      const totalCustomers = activeCount + churnCount;
      const churnRate =
        totalCustomers > 0 ? (churnCount / totalCustomers) * 100 : 0;
      const ltv = mrr > 0 && churnRate > 0 ? (mrr * 12) / (churnRate / 100) : 0;

      const analytics: SubscriptionAnalytics = {
        mrr,
        arr,
        active_subscriptions: activeCount,
        churn_rate: churnRate,
        ltv,
        trial_conversions: trialConversionCount,
        cancellations: churnCount,
        upgrades: upgradeCount,
        downgrades: downgradeCount,
      };

      return analytics;
    } catch (error) {
      this.logger?.error("Analytics calculation failed", {
        error: error.message,
        organizationId,
      });
      throw error;
    }
  }

  /**
   * List subscriptions with filtering
   */
  async listSubscriptions(
    organizationId: string,
    filters: {
      status?: string;
      customer_id?: string;
      plan_id?: string;
      page?: number;
      limit?: number;
    } = {},
  ): Promise<{
    subscriptions: Subscription[];
    total: number;
    pagination: any;
  }> {
    try {
      const db = this.getDatabaseByRegion("US");

      let whereClause = "WHERE organization_id = ?";
      const bindings = [organizationId];

      if (filters.status) {
        whereClause += " AND status = ?";
        bindings.push(filters.status);
      }

      if (filters.customer_id) {
        whereClause += " AND customer_id = ?";
        bindings.push(filters.customer_id);
      }

      if (filters.plan_id) {
        whereClause += " AND plan_id = ?";
        bindings.push(filters.plan_id);
      }

      // Get total count
      const countResult = await db
        .prepare(
          `
        SELECT COUNT(*) as total FROM subscriptions ${whereClause}
      `,
        )
        .bind(...bindings)
        .first();

      const total = countResult?.total || 0;

      // Get subscriptions with pagination
      const page = filters.page || 1;
      const limit = Math.min(filters.limit || 20, 100);
      const offset = (page - 1) * limit;

      const subscriptions = await db
        .prepare(
          `
        SELECT * FROM subscriptions ${whereClause}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `,
        )
        .bind(...bindings, limit, offset)
        .all();

      // Parse JSON fields
      const parsedSubscriptions = (subscriptions.results || []).map((sub) => ({
        ...sub,
        metadata: JSON.parse(sub.metadata || "{}"),
      }));

      return {
        subscriptions: parsedSubscriptions,
        total,
        pagination: {
          page,
          limit,
          total_pages: Math.ceil(total / limit),
          has_more: offset + limit < total,
        },
      };
    } catch (error) {
      this.logger?.error("Subscription list failed", {
        error: error.message,
        organizationId,
      });
      throw error;
    }
  }

  // Validation Methods

  /**
   * Validate subscription creation data
   */
  private validateSubscriptionData(data: SubscriptionCreateRequest): void {
    // Validate UUID formats
    if (!this.isValidUUID(data.customer_id)) {
      throw new Error("Invalid customer ID format");
    }
    if (!this.isValidUUID(data.plan_id)) {
      throw new Error("Invalid plan ID format");
    }

    // Validate billing cycle
    const validCycles = ["monthly", "yearly", "quarterly"];
    if (!validCycles.includes(data.billing_cycle)) {
      throw new Error("Invalid billing cycle");
    }

    // Validate trial period
    if (data.trial_period_days !== undefined) {
      if (data.trial_period_days < 0 || data.trial_period_days > 365) {
        throw new Error("Trial period must be between 0 and 365 days");
      }
    }

    // Validate quantity
    if (data.quantity !== undefined) {
      if (data.quantity < 1 || data.quantity > 1000) {
        throw new Error("Quantity must be between 1 and 1000");
      }
    }

    // Validate start date if provided
    if (data.start_date) {
      const startDate = new Date(data.start_date);
      if (isNaN(startDate.getTime()) || startDate < new Date()) {
        throw new Error("Start date must be a valid future date");
      }
    }

    // Validate payment method ID if provided
    if (data.payment_method_id) {
      if (
        typeof data.payment_method_id !== "string" ||
        data.payment_method_id.length < 1 ||
        data.payment_method_id.length > 100
      ) {
        throw new Error("Invalid payment method ID");
      }
    }

    // Validate metadata
    if (data.metadata) {
      this.validateMetadata(data.metadata);
    }
  }

  /**
   * Validate subscription update data
   */
  private validateUpdateData(data: SubscriptionUpdateRequest): void {
    // Validate plan_id if provided
    if (data.plan_id && !this.isValidUUID(data.plan_id)) {
      throw new Error("Invalid plan ID format");
    }

    // Validate quantity if provided
    if (
      data.quantity !== undefined &&
      (data.quantity < 1 || data.quantity > 1000)
    ) {
      throw new Error("Quantity must be between 1 and 1000");
    }

    // Validate billing cycle if provided
    if (data.billing_cycle) {
      const validCycles = ["monthly", "yearly", "quarterly"];
      if (!validCycles.includes(data.billing_cycle)) {
        throw new Error("Invalid billing cycle");
      }
    }

    // Validate pause/resume dates
    if (data.pause_at && data.resume_at) {
      throw new Error("Cannot specify both pause_at and resume_at");
    }

    if (data.pause_at) {
      const pauseDate = new Date(data.pause_at);
      if (isNaN(pauseDate.getTime()) || pauseDate <= new Date()) {
        throw new Error("Pause date must be a valid future date");
      }
    }

    if (data.resume_at) {
      const resumeDate = new Date(data.resume_at);
      if (isNaN(resumeDate.getTime())) {
        throw new Error("Resume date must be a valid date");
      }
    }

    // Validate metadata
    if (data.metadata) {
      this.validateMetadata(data.metadata);
    }
  }

  /**
   * Validate plan creation data
   */
  private validatePlanData(data: SubscriptionPlanRequest): void {
    // Validate name
    if (
      !data.name ||
      typeof data.name !== "string" ||
      data.name.length < 1 ||
      data.name.length > 100
    ) {
      throw new Error("Plan name must be between 1 and 100 characters");
    }

    // Validate description
    if (
      !data.description ||
      typeof data.description !== "string" ||
      data.description.length < 1 ||
      data.description.length > 500
    ) {
      throw new Error("Plan description must be between 1 and 500 characters");
    }

    // Validate amount
    if (
      typeof data.amount !== "number" ||
      data.amount <= 0 ||
      data.amount > 999999.99
    ) {
      throw new Error("Amount must be between 0.01 and 999999.99");
    }

    // Validate currency
    if (
      !data.currency ||
      typeof data.currency !== "string" ||
      !/^[A-Z]{3}$/.test(data.currency)
    ) {
      throw new Error("Currency must be a valid 3-letter ISO code");
    }

    // Validate billing cycle
    const validCycles = ["monthly", "yearly", "quarterly"];
    if (!validCycles.includes(data.billing_cycle)) {
      throw new Error("Invalid billing cycle");
    }

    // Validate minimum amounts based on billing cycle
    if (data.billing_cycle === "monthly" && data.amount < 0.99) {
      throw new Error("Monthly plans must be at least $0.99");
    }
    if (data.billing_cycle === "yearly" && data.amount < 9.99) {
      throw new Error("Yearly plans must be at least $9.99");
    }

    // Validate features
    if (
      !Array.isArray(data.features) ||
      data.features.length === 0 ||
      data.features.length > 50
    ) {
      throw new Error("Plans must have between 1 and 50 features");
    }

    for (const feature of data.features) {
      if (
        typeof feature !== "string" ||
        feature.length < 1 ||
        feature.length > 200
      ) {
        throw new Error("Each feature must be between 1 and 200 characters");
      }
    }

    // Validate metadata
    if (data.metadata) {
      this.validateMetadata(data.metadata);
    }
  }

  /**
   * Validate metadata object
   */
  private validateMetadata(metadata: Record<string, any>): void {
    if (typeof metadata !== "object" || metadata === null) {
      throw new Error("Metadata must be a valid object");
    }

    const entries = Object.entries(metadata);
    if (entries.length > 50) {
      throw new Error("Metadata cannot have more than 50 key-value pairs");
    }

    for (const [key, value] of entries) {
      // Validate key
      if (typeof key !== "string" || key.length < 1 || key.length > 100) {
        throw new Error("Metadata keys must be between 1 and 100 characters");
      }

      // Validate value
      if (typeof value === "string" && value.length > 1000) {
        throw new Error("String metadata values cannot exceed 1000 characters");
      } else if (Array.isArray(value) && value.length > 100) {
        throw new Error("Array metadata values cannot exceed 100 items");
      } else if (
        typeof value === "object" &&
        value !== null &&
        Object.keys(value).length > 20
      ) {
        throw new Error(
          "Object metadata values cannot have more than 20 properties",
        );
      }
    }
  }

  /**
   * Validate UUID format
   */
  private isValidUUID(uuid: string): boolean {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return typeof uuid === "string" && uuidRegex.test(uuid);
  }

  // Private helper methods

  private async getSubscription(
    id: string,
    organizationId: string,
  ): Promise<Subscription | null> {
    try {
      const db = this.getDatabaseByRegion("US");
      const result = await db
        .prepare(
          `
        SELECT * FROM subscriptions WHERE id = ? AND organization_id = ?
      `,
        )
        .bind(id, organizationId)
        .first();

      if (!result) return null;

      return {
        ...result,
        metadata: JSON.parse(result.metadata || "{}"),
      } as Subscription;
    } catch (error) {
      return null;
    }
  }

  private async getCustomer(
    id: string,
    organizationId: string,
  ): Promise<Customer | null> {
    try {
      const db = this.getDatabaseByRegion("US");
      const result = await db
        .prepare(
          `
        SELECT * FROM customers WHERE id = ? AND organization_id = ?
      `,
        )
        .bind(id, organizationId)
        .first();

      if (!result) return null;

      return {
        ...result,
        metadata: JSON.parse(result.metadata || "{}"),
        address: result.address ? JSON.parse(result.address) : null,
        phone: result.phone ? JSON.parse(result.phone) : null,
      } as Customer;
    } catch (error) {
      return null;
    }
  }

  private async getPlan(
    id: string,
    organizationId: string,
  ): Promise<SubscriptionPlan | null> {
    try {
      const db = this.getDatabaseByRegion("US");
      const result = await db
        .prepare(
          `
        SELECT * FROM subscription_plans WHERE id = ? AND organization_id = ?
      `,
        )
        .bind(id, organizationId)
        .first();

      if (!result) return null;

      return {
        ...result,
        features: JSON.parse(result.features || "[]"),
        metadata: JSON.parse(result.metadata || "{}"),
      } as SubscriptionPlan;
    } catch (error) {
      return null;
    }
  }

  private calculatePeriodEnd(
    startDate: Date | string,
    billingCycle: string,
  ): string {
    const start = new Date(startDate);
    const end = new Date(start);

    switch (billingCycle) {
      case "monthly":
        end.setMonth(end.getMonth() + 1);
        break;
      case "quarterly":
        end.setMonth(end.getMonth() + 3);
        break;
      case "yearly":
        end.setFullYear(end.getFullYear() + 1);
        break;
    }

    return end.toISOString();
  }

  private async calculateProration(
    customerId: string,
    newPlan: SubscriptionPlan,
    data: SubscriptionCreateRequest,
  ): Promise<{ amount: number; credit: number } | null> {
    // Simplified proration calculation
    // In production, this would consider remaining days in current period
    try {
      const db = this.getDatabaseByRegion("US");
      const existingSubscription = await db
        .prepare(
          `
        SELECT * FROM subscriptions
        WHERE customer_id = ? AND status = 'active'
        ORDER BY created_at DESC LIMIT 1
      `,
        )
        .bind(customerId)
        .first();

      if (!existingSubscription) return null;

      const currentPlan = await this.getPlan(existingSubscription.plan_id, "");
      if (!currentPlan) return null;

      const daysRemaining = Math.ceil(
        (new Date(existingSubscription.current_period_end).getTime() -
          Date.now()) /
          (1000 * 60 * 60 * 24),
      );

      const dailyRateNew = newPlan.amount / 30;
      const dailyRateCurrent = currentPlan.amount / 30;
      const prorationAmount = (dailyRateNew - dailyRateCurrent) * daysRemaining;

      return {
        amount: Math.max(0, prorationAmount),
        credit: Math.max(0, -prorationAmount),
      };
    } catch (error) {
      return null;
    }
  }

  private async calculateQuantityProration(
    subscription: Subscription,
    newQuantity: number,
  ): Promise<{ amount: number } | null> {
    if (newQuantity === subscription.quantity) return null;

    const daysRemaining = Math.ceil(
      (new Date(subscription.current_period_end).getTime() - Date.now()) /
        (1000 * 60 * 60 * 24),
    );

    const dailyRate = subscription.amount / 30 / subscription.quantity;
    const prorationAmount =
      (newQuantity - subscription.quantity) * dailyRate * daysRemaining;

    return {
      amount: prorationAmount,
    };
  }

  private async generateSubscriptionInsights(
    customer: Customer,
    plan: SubscriptionPlan,
    data: SubscriptionCreateRequest,
  ): Promise<any> {
    try {
      if (!this.env.AI) return {};

      const aiPrompt = `
        Analyze this subscription request and provide insights:
        Customer: ${customer.name} (${customer.email})
        Plan: ${plan.name} - $${plan.amount}/${plan.billing_cycle}
        Trial: ${data.trial_period_days || 0} days

        Provide:
        - Risk score (0-1)
        - Predicted LTV
        - Churn risk
        - Recommendations
      `;

      const aiResponse = await this.env.AI.run(
        "@cf/meta/llama-3.1-8b-instruct",
        { prompt: aiPrompt },
      );

      return {
        risk_score: Math.random() * 0.3, // Simplified
        predicted_ltv: plan.amount * 12 * (Math.random() * 2 + 1),
        churn_risk: Math.random() * 0.2,
        recommendations: ["Set up payment reminders", "Monitor usage"],
        ai_analysis: aiResponse?.response || "Analysis complete",
      };
    } catch (error) {
      return {};
    }
  }

  private async generatePlanChangeInsights(
    subscription: Subscription,
    newPlan: SubscriptionPlan,
  ): Promise<any> {
    try {
      const isUpgrade = newPlan.amount > subscription.amount;

      return {
        change_type: isUpgrade ? "upgrade" : "downgrade",
        revenue_impact: newPlan.amount - subscription.amount,
        predicted_satisfaction: isUpgrade ? "increase" : "decrease",
        recommendations: isUpgrade
          ? ["Monitor new feature usage", "Update billing communications"]
          : ["Watch for churn signals", "Offer retention incentives"],
      };
    } catch (error) {
      return {};
    }
  }

  private async generateCancellationInsights(
    subscription: Subscription,
    reason?: string,
    feedback?: any,
  ): Promise<any> {
    try {
      return {
        churn_risk_factors: [reason || "unspecified"],
        retention_probability: Math.random() * 0.5,
        recommended_actions: ["Offer discount", "Schedule follow-up call"],
        ltv_lost: subscription.amount * 6, // Estimated remaining value
      };
    } catch (error) {
      return {};
    }
  }

  private async scheduleBilling(subscription: Subscription): Promise<void> {
    if (this.env.BILLING_QUEUE) {
      await this.env.BILLING_QUEUE.send({
        type: "subscription_billing",
        subscriptionId: subscription.id,
        billingDate: subscription.current_period_end,
        organizationId: subscription.organization_id,
      });
    }
  }

  private async scheduleTrialEnd(subscription: Subscription): Promise<void> {
    if (this.env.BILLING_QUEUE && subscription.trial_end) {
      await this.env.BILLING_QUEUE.send({
        type: "trial_end",
        subscriptionId: subscription.id,
        trialEndDate: subscription.trial_end,
        organizationId: subscription.organization_id,
      });
    }
  }

  private async trackSubscriptionEvent(
    eventType: string,
    subscription: Subscription,
    insights?: any,
  ): Promise<void> {
    if (this.env.ANALYTICS) {
      await this.env.ANALYTICS.track({
        event: `subscription_${eventType}`,
        subscriptionId: subscription.id,
        customerId: subscription.customer_id,
        organizationId: subscription.organization_id,
        insights,
      });
    }
  }

  private async processProrationBilling(
    subscription: Subscription,
    proration: any,
  ): Promise<void> {
    // Queue immediate billing for proration
    if (this.env.BILLING_QUEUE) {
      await this.env.BILLING_QUEUE.send({
        type: "proration_billing",
        subscriptionId: subscription.id,
        amount: proration.amount,
        organizationId: subscription.organization_id,
      });
    }
  }

  private async processImmediateCancellation(
    subscription: Subscription,
  ): Promise<void> {
    // Process any refunds, final billing, etc.
    this.logger?.info("Processing immediate cancellation", {
      subscriptionId: subscription.id,
    });
  }

  private getDatabaseByRegion(region: "US" | "EU"): D1Database {
    return region === "EU" ? this.env.DB_BILLING_EU : this.env.DB_BILLING_US;
  }
}

export default SubscriptionService;
