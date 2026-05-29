/// <reference types="@cloudflare/workers-types" />

interface CloudflareEnv {
  // KV Namespaces
  ANALYTICS_KV: KVNamespace;
  CACHE_KV: KVNamespace;

  // D1 Database
  ANALYTICS_DB: D1Database;

  // Durable Objects
  WEBSOCKET_MANAGER: DurableObjectNamespace;

  // Queues
  DEMO_REQUESTS_QUEUE: Queue;

  // R2 Storage
  UPLOADS_BUCKET: R2Bucket;

  // Vectorize Index
  VECTOR_INDEX: VectorizeIndex;

  // Environment Variables
  NEXT_PUBLIC_SITE_URL: string;
  NODE_ENV: string;

  // Secrets
  LEMONSQUEEZY_API_KEY?: string;
  NEXTAUTH_SECRET?: string;
  DATABASE_URL?: string;
  REDIS_URL?: string;
  SLACK_WEBHOOK_URL?: string;
}

declare global {
  const env: CloudflareEnv;
}