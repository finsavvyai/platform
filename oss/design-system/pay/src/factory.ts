import { PaymentProvider, PaymentError } from './types.js';
import { StripeClient } from './stripe/client.js';
import { LemonSqueezyClient } from './lemonsqueezy/client.js';

export interface PaymentClientConfig {
  apiKey: string;
  webhookSecret: string;
}

export function createPaymentClient(
  provider: 'stripe' | 'lemonsqueezy',
  config: PaymentClientConfig,
): PaymentProvider {
  if (!config.apiKey) {
    throw new PaymentError('CONFIG_ERROR', provider, 'API key is required');
  }

  if (!config.webhookSecret) {
    throw new PaymentError('CONFIG_ERROR', provider, 'Webhook secret is required');
  }

  switch (provider) {
    case 'stripe':
      return new StripeClient(config.apiKey, config.webhookSecret);

    case 'lemonsqueezy':
      return new LemonSqueezyClient(config.apiKey, config.webhookSecret);

    default:
      throw new PaymentError('CONFIG_ERROR', provider, `Unknown payment provider: ${provider}`);
  }
}

export function createPaymentClientFromEnv(provider: 'stripe' | 'lemonsqueezy'): PaymentProvider {
  const apiKeyEnv = provider === 'stripe' ? 'STRIPE_API_KEY' : 'LEMONSQUEEZY_API_KEY';
  const secretEnv = provider === 'stripe' ? 'STRIPE_WEBHOOK_SECRET' : 'LEMONSQUEEZY_WEBHOOK_SECRET';

  const apiKey = process.env[apiKeyEnv];
  const webhookSecret = process.env[secretEnv];

  if (!apiKey || !webhookSecret) {
    throw new PaymentError(
      'CONFIG_ERROR',
      provider,
      `Missing environment variables: ${apiKeyEnv}, ${secretEnv}`,
    );
  }

  return createPaymentClient(provider, { apiKey, webhookSecret });
}
