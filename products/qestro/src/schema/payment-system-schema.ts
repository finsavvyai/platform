import {
  sqliteTable,
  text,
  integer,
  real
} from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { coreSchema } from './core-schema.js';

// Payment Customers table - SQLite version
export const paymentCustomers = sqliteTable('payment_customers', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => coreSchema.users.id, { onDelete: 'cascade' }),
  lemonSqueezyCustomerId: text('lemon_squeezy_customer_id').notNull().unique(),
  email: text('email').notNull(),
  name: text('name').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
}, (table) => ({
  userIdIdx: sql`CREATE INDEX payment_customers_user_id_idx ON ${table.name} (user_id)`,
  lemonSqueezyIdIdx: sql`CREATE INDEX payment_customers_lemon_squeezy_customer_id_idx ON ${table.name} (lemon_squeezy_customer_id)`,
}));

// Subscriptions table - SQLite version
export const subscriptions = sqliteTable('subscriptions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => coreSchema.users.id, { onDelete: 'cascade' }),
  planId: text('plan_id').notNull(),
  status: text('status').notNull(), // active, canceled, past_due, unpaid, expired
  currentPeriodStart: integer('current_period_start', { mode: 'timestamp' }).notNull(),
  currentPeriodEnd: integer('current_period_end', { mode: 'timestamp' }).notNull(),
  cancelAtPeriodEnd: integer('cancel_at_period_end', { mode: 'boolean' }).notNull().default(false),
  lemonSqueezySubscriptionId: text('lemon_squeezy_subscription_id').notNull().unique(),
  lemonSqueezyCustomerId: text('lemon_squeezy_customer_id').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
}, (table) => ({
  userIdIdx: sql`CREATE INDEX subscriptions_user_id_idx ON ${table.name} (user_id)`,
  planIdIdx: sql`CREATE INDEX subscriptions_plan_id_idx ON ${table.name} (plan_id)`,
  statusIdx: sql`CREATE INDEX subscriptions_status_idx ON ${table.name} (status)`,
  lemonSqueezySubscriptionIdIdx: sql`CREATE INDEX subscriptions_lemon_squeezy_subscription_id_idx ON ${table.name} (lemon_squeezy_subscription_id)`,
}));

// Payment Methods table - SQLite version
export const paymentMethods = sqliteTable('payment_methods', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => coreSchema.users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // card, bank_account, etc.
  brand: text('brand').notNull(), // visa, mastercard, etc.
  last4: text('last4').notNull(),
  expiryMonth: integer('expiry_month').notNull(),
  expiryYear: integer('expiry_year').notNull(),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  lemonSqueezyPaymentMethodId: text('lemon_squeezy_payment_method_id').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
}, (table) => ({
  userIdIdx: sql`CREATE INDEX payment_methods_user_id_idx ON ${table.name} (user_id)`,
  typeIdx: sql`CREATE INDEX payment_methods_type_idx ON ${table.name} (type)`,
  isDefaultIdx: sql`CREATE INDEX payment_methods_is_default_idx ON ${table.name} (is_default)`,
}));

// Invoices table - SQLite version
export const invoices = sqliteTable('invoices', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => coreSchema.users.id, { onDelete: 'cascade' }),
  subscriptionId: text('subscription_id').references(() => subscriptions.id, { onDelete: 'set null' }),
  amount: real('amount').notNull(), // Using REAL for decimal values in SQLite
  currency: text('currency').notNull().default('USD'),
  status: text('status').notNull(), // draft, open, paid, void, uncollectible
  dueDate: integer('due_date', { mode: 'timestamp' }).notNull(),
  paidAt: integer('paid_at', { mode: 'timestamp' }),
  lemonSqueezyInvoiceId: text('lemon_squeezy_invoice_id').notNull().unique(),
  invoiceUrl: text('invoice_url').notNull(),
  metadata: text('metadata', { mode: 'json' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
}, (table) => ({
  userIdIdx: sql`CREATE INDEX invoices_user_id_idx ON ${table.name} (user_id)`,
  subscriptionIdIdx: sql`CREATE INDEX invoices_subscription_id_idx ON ${table.name} (subscription_id)`,
  statusIdx: sql`CREATE INDEX invoices_status_idx ON ${table.name} (status)`,
  lemonSqueezyInvoiceIdIdx: sql`CREATE INDEX invoices_lemon_squeezy_invoice_id_idx ON ${table.name} (lemon_squeezy_invoice_id)`,
}));

// Usage Metrics table - SQLite version
export const usageMetrics = sqliteTable('usage_metrics', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => coreSchema.users.id, { onDelete: 'cascade' }),
  period: integer('period', { mode: 'timestamp' }).notNull(),
  tests: integer('tests').notNull().default(0),
  users: integer('users').notNull().default(0),
  storage: integer('storage').notNull().default(0), // bytes
  apiCalls: integer('api_calls').notNull().default(0),
  metadata: text('metadata', { mode: 'json' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
}, (table) => ({
  userIdIdx: sql`CREATE INDEX usage_metrics_user_id_idx ON ${table.name} (user_id)`,
  periodIdx: sql`CREATE INDEX usage_metrics_period_idx ON ${table.name} (period)`,
  userIdPeriodIdx: sql`CREATE UNIQUE INDEX usage_metrics_user_period_unique ON ${table.name} (user_id, period)`,
}));

// Promo Codes table - SQLite version
export const promoCodes = sqliteTable('promo_codes', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  code: text('code').notNull().unique(),
  description: text('description'),
  discountType: text('discount_type').notNull(), // percentage, fixed_amount
  discountValue: real('discount_value').notNull(), // Using REAL for decimal values
  applicablePlans: text('applicable_plans', { mode: 'json' }), // JSON array of plan IDs
  maxUses: integer('max_uses'),
  usedCount: integer('used_count').notNull().default(0),
  validFrom: integer('valid_from', { mode: 'timestamp' }).notNull(),
  validUntil: integer('valid_until', { mode: 'timestamp' }).notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
}, (table) => ({
  codeIdx: sql`CREATE INDEX promo_codes_code_idx ON ${table.name} (code)`,
  discountTypeIdx: sql`CREATE INDEX promo_codes_discount_type_idx ON ${table.name} (discount_type)`,
  isActiveIdx: sql`CREATE INDEX promo_codes_is_active_idx ON ${table.name} (is_active)`,
  validFromIdx: sql`CREATE INDEX promo_codes_valid_from_idx ON ${table.name} (valid_from)`,
  validUntilIdx: sql`CREATE INDEX promo_codes_valid_until_idx ON ${table.name} (valid_until)`,
}));

// Promo Code Usages table - SQLite version
export const promoCodeUsages = sqliteTable('promo_code_usages', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  promoCodeId: text('promo_code_id').notNull().references(() => promoCodes.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => coreSchema.users.id, { onDelete: 'cascade' }),
  subscriptionId: text('subscription_id').references(() => subscriptions.id, { onDelete: 'set null' }),
  discountAmount: real('discount_amount').notNull(), // Using REAL for decimal values
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
}, (table) => ({
  promoCodeIdIdx: sql`CREATE INDEX promo_code_usages_promo_code_id_idx ON ${table.name} (promo_code_id)`,
  userIdIdx: sql`CREATE INDEX promo_code_usages_user_id_idx ON ${table.name} (user_id)`,
  subscriptionIdIdx: sql`CREATE INDEX promo_code_usages_subscription_id_idx ON ${table.name} (subscription_id)`,
}));

// Subscription Events table - For audit trail (SQLite version)
export const subscriptionEvents = sqliteTable('subscription_events', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  subscriptionId: text('subscription_id').notNull().references(() => subscriptions.id, { onDelete: 'cascade' }),
  eventType: text('event_type').notNull(), // created, updated, cancelled, renewed, payment_failed, etc.
  previousStatus: text('previous_status'),
  newStatus: text('new_status'),
  eventData: text('event_data', { mode: 'json' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
}, (table) => ({
  subscriptionIdIdx: sql`CREATE INDEX subscription_events_subscription_id_idx ON ${table.name} (subscription_id)`,
  eventTypeIdx: sql`CREATE INDEX subscription_events_event_type_idx ON ${table.name} (event_type)`,
  createdAtIdx: sql`CREATE INDEX subscription_events_created_at_idx ON ${table.name} (created_at)`,
}));

// Payment system schema export
export const paymentSystemSchema = {
  paymentCustomers,
  subscriptions,
  paymentMethods,
  invoices,
  usageMetrics,
  promoCodes,
  promoCodeUsages,
  subscriptionEvents,
};

export default paymentSystemSchema;
