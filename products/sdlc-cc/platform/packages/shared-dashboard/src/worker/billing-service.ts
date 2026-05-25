/**
 * Billing Service for AutoBoot Framework
 * LemonSqueezy Integration
 */

// LemonSqueezy API Base URL
const LEMONSQUEEZY_API_URL = 'https://api.lemonsqueezy.com/v1';

// LemonSqueezy types
export interface LemonSqueezyCustomer {
  id: string;
  type: 'customers';
  attributes: {
    store_id: number;
    name: string;
    email: string;
    status: string;
    city: string | null;
    region: string | null;
    country: string | null;
    total_revenue_currency: number;
    mrr: number;
    status_formatted: string;
    country_formatted: string;
    total_revenue_currency_formatted: string;
    mrr_formatted: string;
    created_at: string;
    updated_at: string;
  };
}

export interface LemonSqueezySubscription {
  id: string;
  type: 'subscriptions';
  attributes: {
    store_id: number;
    customer_id: number;
    order_id: number;
    order_item_id: number;
    product_id: number;
    variant_id: number;
    product_name: string;
    variant_name: string;
    user_name: string;
    user_email: string;
    status: 'on_trial' | 'active' | 'paused' | 'past_due' | 'unpaid' | 'cancelled' | 'expired';
    status_formatted: string;
    card_brand: string | null;
    card_last_four: string | null;
    pause: { mode: 'void' | 'free' } | null;
    cancelled: boolean;
    trial_ends_at: string | null;
    billing_anchor: number;
    first_subscription_item: Record<string, unknown> | null;
    urls: {
      update_payment_method: string;
      customer_portal: string;
    };
    renews_at: string | null;
    ends_at: string | null;
    created_at: string;
    updated_at: string;
  };
}

export interface LemonSqueezyWebhookEvent {
  meta: {
    event_name: string;
    webhook_id: string;
    custom_data?: Record<string, unknown>;
  };
  data: {
    type: string;
    id: string;
    attributes: Record<string, unknown>;
    relationships?: Record<string, unknown>;
  };
}

/**
 * LemonSqueezy API Client
 */
export class LemonSqueezyClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Make authenticated request to LemonSqueezy API
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${LEMONSQUEEZY_API_URL}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Accept': 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json',
        'Authorization': `Bearer ${this.apiKey}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`LemonSqueezy API error: ${response.status} - ${error}`);
    }

    return await response.json();
  }

  /**
   * Create a customer in LemonSqueezy
   */
  async createCustomer(
    storeId: string,
    name: string,
    email: string
  ): Promise<LemonSqueezyCustomer> {
    const response = await this.request<{ data: LemonSqueezyCustomer }>('/customers', {
      method: 'POST',
      body: JSON.stringify({
        data: {
          type: 'customers',
          attributes: {
            store_id: storeId,
            name,
            email,
          },
        },
      }),
    });

    return response.data;
  }

  /**
   * Get customer by ID
   */
  async getCustomer(customerId: string): Promise<LemonSqueezyCustomer> {
    const response = await this.request<{ data: LemonSqueezyCustomer }>(
      `/customers/${customerId}`
    );
    return response.data;
  }

  /**
   * Get subscription by ID
   */
  async getSubscription(subscriptionId: string): Promise<LemonSqueezySubscription> {
    const response = await this.request<{ data: LemonSqueezySubscription }>(
      `/subscriptions/${subscriptionId}`
    );
    return response.data;
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(subscriptionId: string): Promise<LemonSqueezySubscription> {
    const response = await this.request<{ data: LemonSqueezySubscription }>(
      `/subscriptions/${subscriptionId}`,
      {
        method: 'DELETE',
      }
    );
    return response.data;
  }

  /**
   * Update subscription
   */
  async updateSubscription(
    subscriptionId: string,
    data: {
      pause?: { mode: 'void' | 'free' };
      cancelled?: boolean;
      variant_id?: number;
    }
  ): Promise<LemonSqueezySubscription> {
    const response = await this.request<{ data: LemonSqueezySubscription }>(
      `/subscriptions/${subscriptionId}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          data: {
            type: 'subscriptions',
            id: subscriptionId,
            attributes: data,
          },
        }),
      }
    );
    return response.data;
  }

  /**
   * Generate checkout URL
   */
  async createCheckout(
    storeId: string,
    variantId: string,
    customData?: Record<string, unknown>
  ): Promise<string> {
    const response = await this.request<{ data: { attributes: { url: string } } }>(
      '/checkouts',
      {
        method: 'POST',
        body: JSON.stringify({
          data: {
            type: 'checkouts',
            attributes: {
              store_id: storeId,
              variant_id: variantId,
              custom_data: customData,
            },
          },
        }),
      }
    );
    return response.data.attributes.url;
  }
}

/**
 * Verify LemonSqueezy webhook signature using HMAC-SHA256
 */
export async function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const expected = Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Sync customer from LemonSqueezy to database
 */
export async function syncCustomer(
  db: D1Database,
  userId: string,
  lsCustomer: LemonSqueezyCustomer
): Promise<void> {
  const customerId = crypto.randomUUID();

  await db.prepare(`
    INSERT INTO billing_customers (
      id, user_id, lemonsqueezy_customer_id, email, name,
      country, region, city, metadata
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(lemonsqueezy_customer_id) DO UPDATE SET
      email = excluded.email,
      name = excluded.name,
      country = excluded.country,
      region = excluded.region,
      city = excluded.city,
      metadata = excluded.metadata,
      updated_at = datetime('now')
  `).bind(
    customerId,
    userId,
    lsCustomer.id,
    lsCustomer.attributes.email,
    lsCustomer.attributes.name,
    lsCustomer.attributes.country,
    lsCustomer.attributes.region,
    lsCustomer.attributes.city,
    JSON.stringify({
      status: lsCustomer.attributes.status,
      total_revenue: lsCustomer.attributes.total_revenue_currency,
      mrr: lsCustomer.attributes.mrr,
    })
  ).run();
}

/**
 * Sync subscription from LemonSqueezy to database
 */
export async function syncSubscription(
  db: D1Database,
  customerId: string,
  lsSubscription: LemonSqueezySubscription
): Promise<void> {
  const subscriptionId = crypto.randomUUID();

  await db.prepare(`
    INSERT INTO billing_subscriptions (
      id, customer_id, lemonsqueezy_subscription_id,
      product_id, variant_id, product_name, variant_name,
      status, trial_ends_at, billing_anchor, renews_at, ends_at,
      card_brand, card_last_four, update_payment_method_url,
      urls, metadata
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(lemonsqueezy_subscription_id) DO UPDATE SET
      status = excluded.status,
      trial_ends_at = excluded.trial_ends_at,
      renews_at = excluded.renews_at,
      ends_at = excluded.ends_at,
      card_brand = excluded.card_brand,
      card_last_four = excluded.card_last_four,
      update_payment_method_url = excluded.update_payment_method_url,
      urls = excluded.urls,
      metadata = excluded.metadata,
      updated_at = datetime('now')
  `).bind(
    subscriptionId,
    customerId,
    lsSubscription.id,
    lsSubscription.attributes.product_id.toString(),
    lsSubscription.attributes.variant_id.toString(),
    lsSubscription.attributes.product_name,
    lsSubscription.attributes.variant_name,
    lsSubscription.attributes.status,
    lsSubscription.attributes.trial_ends_at,
    lsSubscription.attributes.billing_anchor,
    lsSubscription.attributes.renews_at,
    lsSubscription.attributes.ends_at,
    lsSubscription.attributes.card_brand,
    lsSubscription.attributes.card_last_four,
    lsSubscription.attributes.urls.update_payment_method,
    JSON.stringify(lsSubscription.attributes.urls),
    JSON.stringify({
      order_id: lsSubscription.attributes.order_id,
      cancelled: lsSubscription.attributes.cancelled,
    })
  ).run();
}

/** Summary of a customer subscription returned by getCustomerSubscriptions */
export interface CustomerSubscriptionSummary {
  id: string;
  lemonSqueezyId: string;
  productName: string;
  variantName: string;
  status: string;
  trialEndsAt: string | null;
  renewsAt: string | null;
  endsAt: string | null;
  cardBrand: string | null;
  cardLastFour: string | null;
  updatePaymentMethodUrl: string | null;
  urls: Record<string, unknown>;
  createdAt: string;
}

/**
 * Get customer's subscriptions
 */
export async function getCustomerSubscriptions(
  db: D1Database,
  userId: string
): Promise<CustomerSubscriptionSummary[]> {
  const { results } = await db.prepare(`
    SELECT
      s.id,
      s.lemonsqueezy_subscription_id,
      s.product_name,
      s.variant_name,
      s.status,
      s.trial_ends_at,
      s.renews_at,
      s.ends_at,
      s.card_brand,
      s.card_last_four,
      s.update_payment_method_url,
      s.urls,
      s.created_at
    FROM billing_subscriptions s
    INNER JOIN billing_customers c ON s.customer_id = c.id
    WHERE c.user_id = ?
    ORDER BY s.created_at DESC
  `).bind(userId).all();

  return results.map((sub) => ({
    id: sub.id as string,
    lemonSqueezyId: sub.lemonsqueezy_subscription_id as string,
    productName: sub.product_name as string,
    variantName: sub.variant_name as string,
    status: sub.status as string,
    trialEndsAt: sub.trial_ends_at as string | null,
    renewsAt: sub.renews_at as string | null,
    endsAt: sub.ends_at as string | null,
    cardBrand: sub.card_brand as string | null,
    cardLastFour: sub.card_last_four as string | null,
    updatePaymentMethodUrl: sub.update_payment_method_url as string | null,
    urls: JSON.parse((sub.urls as string) || '{}'),
    createdAt: sub.created_at as string,
  }));
}

/**
 * Record usage for metered billing
 */
export async function recordUsage(
  db: D1Database,
  subscriptionId: string,
  subscriptionItemId: string,
  quantity: number,
  action: 'increment' | 'decrement' | 'set' = 'increment'
): Promise<void> {
  const recordId = crypto.randomUUID();

  await db.prepare(`
    INSERT INTO billing_usage_records (
      id, subscription_id, subscription_item_id, quantity, action
    ) VALUES (?, ?, ?, ?, ?)
  `).bind(recordId, subscriptionId, subscriptionItemId, quantity, action).run();
}

/**
 * Get usage summary for a subscription
 */
export async function getUsageSummary(
  db: D1Database,
  subscriptionId: string,
  startDate?: string,
  endDate?: string
): Promise<{ total: number; records: Record<string, unknown>[] }> {
  let query = `
    SELECT
      id,
      subscription_item_id,
      quantity,
      action,
      timestamp
    FROM billing_usage_records
    WHERE subscription_id = ?
  `;

  const params = [subscriptionId];

  if (startDate) {
    query += ' AND timestamp >= ?';
    params.push(startDate);
  }

  if (endDate) {
    query += ' AND timestamp <= ?';
    params.push(endDate);
  }

  query += ' ORDER BY timestamp DESC';

  const { results } = await db.prepare(query).bind(...params).all();

  const total = results.reduce((sum: number, record: Record<string, unknown>) => {
    const quantity = record.quantity as number;
    if (record.action === 'increment') {
      return sum + quantity;
    } else if (record.action === 'decrement') {
      return sum - quantity;
    } else {
      return quantity; // 'set' action
    }
  }, 0);

  return { total, records: results };
}
