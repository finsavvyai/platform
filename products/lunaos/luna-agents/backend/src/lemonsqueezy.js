import config from './config.js';

export class LemonSqueezyService {
  constructor(env) {
    this.apiKey = env.LEMONSQUEEZY_API_KEY;
    this.storeId = config.lemonsqueezy.storeId;
    this.apiUrl = config.lemonsqueezy.apiUrl;
    this.webhookSecret = env.LEMONSQUEEZY_WEBHOOK_SECRET;
  }

  /**
   * Create checkout URL for subscription
   */
  async createCheckout(options) {
    const {
      email,
      variantId,
      productId,
      customData = {},
      redirectTo = null
    } = options;

    try {
      const response = await fetch(`${this.apiUrl}/checkouts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/vnd.api+json',
          'Accept': 'application/vnd.api+json'
        },
        body: JSON.stringify({
          data: {
            type: 'checkouts',
            attributes: {
              store_id: parseInt(this.storeId),
              variant_id: variantId,
              custom_price: null,
              product_options: {
                redirect_url: redirectTo,
                receipt_button_text: 'Go to Luna RAG',
                receipt_thank_you_note: 'Thank you for upgrading to Luna RAG Pro!',
                receipt_link_url: 'https://agent.lunaos.ai/docs'
              },
              checkout_options: {
                button_color: '#667eea',
                embed: false,
                logo: 'https://agent.lunaos.ai/logo.png'
              },
              checkout_data: {
                email,
                custom: {
                  user_id: customData.userId || null,
                  source: 'luna-rag-cloudflare'
                }
              }
            },
            relationships: {
              store: {
                data: {
                  type: 'stores',
                  id: this.storeId
                }
              }
            }
          }
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`LemonSqueezy API error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      return data.data.attributes.url;

    } catch (error) {
      console.error('Checkout creation error:', error);
      throw new Error('Failed to create checkout URL');
    }
  }

  /**
   * Get customer by email
   */
  async getCustomerByEmail(email) {
    try {
      const response = await fetch(`${this.apiUrl}/customers?filter[email]=${encodeURIComponent(email)}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/vnd.api+json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch customer: ${response.status}`);
      }

      const data = await response.json();
      return data.data[0] || null;

    } catch (error) {
      console.error('Customer fetch error:', error);
      return null;
    }
  }

  /**
   * Get subscription details
   */
  async getSubscription(subscriptionId) {
    try {
      const response = await fetch(`${this.apiUrl}/subscriptions/${subscriptionId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/vnd.api+json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch subscription: ${response.status}`);
      }

      const data = await response.json();
      return data.data;

    } catch (error) {
      console.error('Subscription fetch error:', error);
      return null;
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(subscriptionId) {
    try {
      const response = await fetch(`${this.apiUrl}/subscriptions/${subscriptionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/vnd.api+json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to cancel subscription: ${response.status}`);
      }

      const data = await response.json();
      return data.data;

    } catch (error) {
      console.error('Subscription cancellation error:', error);
      throw new Error('Failed to cancel subscription');
    }
  }

  /**
   * Update subscription
   */
  async updateSubscription(subscriptionId, updates) {
    try {
      const response = await fetch(`${this.apiUrl}/subscriptions/${subscriptionId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/vnd.api+json',
          'Accept': 'application/vnd.api+json'
        },
        body: JSON.stringify({
          data: {
            type: 'subscriptions',
            id: subscriptionId,
            attributes: updates
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to update subscription: ${response.status}`);
      }

      const data = await response.json();
      return data.data;

    } catch (error) {
      console.error('Subscription update error:', error);
      throw new Error('Failed to update subscription');
    }
  }

  /**
   * Get subscription list for customer
   */
  async getCustomerSubscriptions(customerId) {
    try {
      const response = await fetch(`${this.apiUrl}/subscriptions?filter[customer_id]=${customerId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/vnd.api+json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch subscriptions: ${response.status}`);
      }

      const data = await response.json();
      return data.data;

    } catch (error) {
      console.error('Subscriptions fetch error:', error);
      return [];
    }
  }

  /**
   * Create customer
   */
  async createCustomer(email, name = null) {
    try {
      const response = await fetch(`${this.apiUrl}/customers`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/vnd.api+json',
          'Accept': 'application/vnd.api+json'
        },
        body: JSON.stringify({
          data: {
            type: 'customers',
            attributes: {
              store_id: parseInt(this.storeId),
              name,
              email
            },
            relationships: {
              store: {
                data: {
                  type: 'stores',
                  id: this.storeId
                }
              }
            }
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to create customer: ${response.status}`);
      }

      const data = await response.json();
      return data.data;

    } catch (error) {
      console.error('Customer creation error:', error);
      throw new Error('Failed to create customer');
    }
  }

  /**
   * Get store information
   */
  async getStore() {
    try {
      const response = await fetch(`${this.apiUrl}/stores/${this.storeId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/vnd.api+json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch store: ${response.status}`);
      }

      const data = await response.json();
      return data.data;

    } catch (error) {
      console.error('Store fetch error:', error);
      return null;
    }
  }

  /**
   * Get variants for a product
   */
  async getProductVariants(productId) {
    try {
      const response = await fetch(`${this.apiUrl}/variants?filter[product_id]=${productId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/vnd.api+json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch variants: ${response.status}`);
      }

      const data = await response.json();
      return data.data;

    } catch (error) {
      console.error('Variants fetch error:', error);
      return [];
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload, signature) {
    // In Cloudflare Workers, we need to use the Web Crypto API
    const encoder = new TextEncoder();
    const keyData = encoder.encode(this.webhookSecret);
    const messageData = encoder.encode(payload);

    return crypto.subtle
      .importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'])
      .then(async (key) => {
        const signatureData = this.hexToBuffer(signature);
        return await crypto.subtle.verify('HMAC', key, signatureData, messageData);
      })
      .catch((error) => {
        console.error('Webhook signature verification error:', error);
        return false;
      });
  }

  /**
   * Convert hex string to ArrayBuffer
   */
  hexToBuffer(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes.buffer;
  }

  /**
   * Create Pro subscription checkout
   */
  async createProCheckout(email, userId = null) {
    const variantId = config.lemonsqueezy.products.pro.variantId;
    const redirectTo = `${this.getBaseUrl()}/subscription/success`;

    return await this.createCheckout({
      email,
      variantId: parseInt(variantId),
      customData: { userId },
      redirectTo
    });
  }

  /**
   * Create Enterprise subscription checkout
   */
  async createEnterpriseCheckout(email, userId = null) {
    const variantId = config.lemonsqueezy.products.enterprise.variantId;
    const redirectTo = `${this.getBaseUrl()}/subscription/success`;

    return await this.createCheckout({
      email,
      variantId: parseInt(variantId),
      customData: { userId },
      redirectTo
    });
  }

  /**
   * Get base URL for redirects
   */
  getBaseUrl() {
    // This should be set in wrangler.toml or environment
    return 'https://luna-rag-backend.your-subdomain.workers.dev';
  }

  /**
   * Parse webhook event
   */
  parseWebhookEvent(event) {
    const eventType = event.meta?.event_name;
    const eventData = event.data;

    return {
      type: eventType,
      data: eventData,
      attributes: eventData?.attributes || {},
      customData: eventData?.attributes?.custom || {},
      customerId: eventData?.attributes?.customer_id,
      subscriptionId: eventData?.attributes?.subscription_id,
      orderId: eventData?.attributes?.order_id,
      variantId: eventData?.attributes?.variant_id
    };
  }
}

export default LemonSqueezyService;