/**
 * Payment Database Schema
 * Database schema for payments, subscriptions, and billing
 */

import { pgTable, text, timestamp, boolean, integer, decimal, uuid, jsonb } from 'drizzle-orm/pg-core';

// Forward reference to users table - we'll use string references since users is defined in main schema
// Note: In drizzle-orm, we can use lazy references for cross-file dependencies

// Payment Customers table
export const paymentCustomers = pgTable('payment_customers', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  lemonSqueezyCustomerId: text('lemon_squeezy_customer_id').notNull().unique(),
  stripeCustomerId: text('stripe_customer_id'),
  email: text('email').notNull(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Subscriptions table
export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  planId: text('plan_id').notNull(),
  status: text('status').notNull(), // active, canceled, past_due, unpaid, expired
  currentPeriodStart: timestamp('current_period_start'),
  currentPeriodEnd: timestamp('current_period_end'),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
  trialEnd: timestamp('trial_end'),
  lemonSqueezySubscriptionId: text('lemon_squeezy_subscription_id'),
  lemonSqueezyCustomerId: text('lemon_squeezy_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  stripeCustomerId: text('stripe_customer_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Payment Methods table
export const paymentMethods = pgTable('payment_methods', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  type: text('type').notNull(), // card, bank_account, etc.
  brand: text('brand').notNull(), // visa, mastercard, etc.
  last4: text('last4').notNull(),
  expiryMonth: integer('expiry_month').notNull(),
  expiryYear: integer('expiry_year').notNull(),
  isDefault: boolean('is_default').notNull().default(false),
  lemonSqueezyPaymentMethodId: text('lemon_squeezy_payment_method_id'),
  stripePaymentMethodId: text('stripe_payment_method_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Invoices table
export const invoices = pgTable('invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  subscriptionId: uuid('subscription_id'),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  currency: text('currency').notNull().default('USD'),
  status: text('status').notNull(), // draft, open, paid, void, uncollectible
  dueDate: timestamp('due_date'),
  paidAt: timestamp('paid_at'),
  lemonSqueezyInvoiceId: text('lemon_squeezy_invoice_id'),
  stripeInvoiceId: text('stripe_invoice_id'),
  invoiceUrl: text('invoice_url'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Usage Metrics table
export const usageMetrics = pgTable('usage_metrics', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  period: timestamp('period').notNull(),
  tests: integer('tests').notNull().default(0),
  users: integer('users').notNull().default(0),
  storage: integer('storage').notNull().default(0), // bytes
  apiCalls: integer('api_calls').notNull().default(0),
  recordingCount: integer('recording_count').default(0),
  testExecutionCount: integer('test_execution_count').default(0),
  storageUsedMB: integer('storage_used_mb').default(0),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Promo Codes table
export const promoCodes = pgTable('promo_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  description: text('description'),
  discountType: text('discount_type').notNull(), // percentage, fixed_amount
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }).notNull(),
  applicablePlans: text('applicable_plans').array(), // Array of plan IDs
  maxUses: integer('max_uses'),
  usedCount: integer('used_count').notNull().default(0),
  validFrom: timestamp('valid_from').notNull(),
  validUntil: timestamp('valid_until').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Promo Code Usages table
export const promoCodeUsages = pgTable('promo_code_usages', {
  id: uuid('id').primaryKey().defaultRandom(),
  promoCodeId: uuid('promo_code_id').notNull(),
  userId: uuid('user_id').notNull(),
  subscriptionId: uuid('subscription_id'),
  discountAmount: decimal('discount_amount', { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Subscription Events table (for audit trail)
export const subscriptionEvents = pgTable('subscription_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  subscriptionId: uuid('subscription_id').notNull(),
  eventType: text('event_type').notNull(), // created, updated, cancelled, renewed, payment_failed, etc.
  previousStatus: text('previous_status'),
  newStatus: text('new_status'),
  eventData: jsonb('event_data'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Export types
export type PaymentCustomer = typeof paymentCustomers.$inferSelect;
export type NewPaymentCustomer = typeof paymentCustomers.$inferInsert;

export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;

export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type NewPaymentMethod = typeof paymentMethods.$inferInsert;

export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;

export type UsageMetric = typeof usageMetrics.$inferSelect;
export type NewUsageMetric = typeof usageMetrics.$inferInsert;

export type PromoCode = typeof promoCodes.$inferSelect;
export type NewPromoCode = typeof promoCodes.$inferInsert;

export type PromoCodeUsage = typeof promoCodeUsages.$inferSelect;
export type NewPromoCodeUsage = typeof promoCodeUsages.$inferInsert;

export type SubscriptionEvent = typeof subscriptionEvents.$inferSelect;
export type NewSubscriptionEvent = typeof subscriptionEvents.$inferInsert;