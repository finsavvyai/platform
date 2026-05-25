'use strict';

/**
 * Webhook Event Types
 * All possible events that can trigger webhooks
 */
export type WebhookEventType =
  | 'test.completed'
  | 'test.failed'
  | 'run.started'
  | 'run.completed'
  | 'alert.triggered'
  | 'deployment.status';

/**
 * Webhook Configuration
 * Stores webhook registration details
 */
export interface WebhookConfig {
  id: string;
  projectId: string;
  url: string;
  secret: string;
  events: WebhookEventType[];
  active: boolean;
  maxRetries: number;
  retryDelay: number;
  timeout: number;
  headers?: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

/**
 * Webhook Event
 * Payload sent to webhook endpoints
 */
export interface WebhookEvent {
  id: string;
  type: WebhookEventType;
  projectId: string;
  timestamp: Date;
  data: {
    testId?: string;
    testName?: string;
    runId?: string;
    status?: string;
    errorMessage?: string;
    duration?: number;
    [key: string]: any;
  };
}

/**
 * Webhook Delivery
 * Records individual webhook delivery attempts
 */
export interface WebhookDelivery {
  id: string;
  webhookId: string;
  eventId: string;
  attempt: number;
  status: 'success' | 'failed' | 'retrying';
  statusCode?: number;
  responseBody?: string;
  errorMessage?: string;
  timestamp: Date;
  deliveryTime: number;
  signature: string;
}

/**
 * Webhook Registration Request
 */
export interface WebhookRegistrationRequest {
  url: string;
  events: WebhookEventType[];
  secret?: string;
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
  headers?: Record<string, string>;
}

/**
 * Webhook Delivery Response
 */
export interface WebhookDeliveryResponse {
  success: boolean;
  statusCode: number;
  responseTime: number;
  errorMessage?: string;
}
