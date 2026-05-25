/**
 * Shared test fixtures for Luna-OS Wave 1
 */

import { faker } from '@faker-js/faker';
import { User, JwtPayload } from '../../src/auth/types';
import { Subscription } from '../../src/payment/types';

export function createMockUser(overrides?: Partial<User>): User {
  return {
    id: faker.string.uuid(),
    email: faker.internet.email(),
    name: faker.person.fullName(),
    role: 'user',
    subscriptionPlan: 'free',
    createdAt: faker.date.past(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function createMockAdmin(overrides?: Partial<User>): User {
  return createMockUser({
    role: 'admin',
    ...overrides,
  });
}

export function createMockSubscription(
  overrides?: Partial<Subscription>
): Subscription {
  const now = new Date();
  const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  return {
    id: faker.string.uuid(),
    userId: faker.string.uuid(),
    planId: 'pro',
    status: 'active',
    variantId: '2',
    orderId: faker.string.uuid(),
    currentPeriodStart: now,
    currentPeriodEnd: thirtyDaysLater,
    createdAt: faker.date.past(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function createMockApiKey(): string {
  return `sk_live_${faker.string.alphanumeric(32)}`;
}

export function createMockJwtPayload(overrides?: Partial<JwtPayload>): JwtPayload {
  return {
    userId: faker.string.uuid(),
    email: faker.internet.email(),
    role: 'user',
    subscriptionPlan: 'free',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
    ...overrides,
  };
}

export function createMockCheckoutUrl(): string {
  return `https://checkout.lemonsqueezy.com/${faker.string.alphanumeric(10)}`;
}

export function createMockWebhookSignature(): string {
  return `sha256=${faker.string.hexaDecimal(64)}`;
}

export const mockEnv = {
  LEMONSQUEEZY_API_KEY: 'test-api-key',
  LEMONSQUEEZY_STORE_ID: 'test-store-id',
  LEMONSQUEEZY_WEBHOOK_SECRET: 'test-webhook-secret',
  JWT_SECRET: 'test-jwt-secret',
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
};
