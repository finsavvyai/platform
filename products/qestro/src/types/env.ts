/**
 * Qestro Workers - Environment Types
 *
 * Type definitions for Cloudflare Workers environment bindings
 */

export interface Env {
  // D1 Database
  DB: D1Database

  // KV Namespaces
  SESSIONS: KVNamespace
  CACHE: KVNamespace
  REALTIME: KVNamespace

  // R2 Buckets
  ARTIFACTS: R2Bucket
  MEDIA: R2Bucket
  BACKUPS: R2Bucket

  // Durable Objects
  COLLABORATION_DO: DurableObject
  SESSION_DO: DurableObject
  TEST_EXECUTION_DO: DurableObject

  // Queues
  AI_QUEUE: Queue
  TEST_QUEUE: Queue
  BILLING_QUEUE: Queue

  // Secrets and Configuration
  JWT_SECRET: string
  OPENAI_API_KEY: string
  HUGGINGFACE_API_KEY: string
  LEMONSQUEEZY_API_KEY: string
  RESEND_API_KEY: string

  // Environment Configuration
  NODE_ENV: string
  ENVIRONMENT: string
  API_URL: string
  FRONTEND_URL: string
  LOG_LEVEL: string
}

export interface RequestWithContext extends Request {
  waitUntil?: (promise: Promise<any>) => void
}

export interface ExecutionContext {
  waitUntil(promise: Promise<any>): void
  passThroughOnException?: () => void
}
