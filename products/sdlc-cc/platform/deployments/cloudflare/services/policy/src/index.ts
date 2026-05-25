/**
 * Cloudflare Worker Policy Service
 *
 * This service provides policy evaluation capabilities using OPA integration
 * with Cloudflare Workers for edge-native policy enforcement.
 */

import { PolicyEngine } from './policy-engine';
import { BundleManager } from './bundle-manager';
import { OPAClient } from './opa-client';
import { DecisionCache } from './decision-cache';
import { MetricsCollector } from './metrics-collector';

export interface Env {
  // D1 Database
  POLICY_DB: D1Database;

  // KV Namespaces
  POLICY_CACHE: KVNamespace;
  DECISION_CACHE: KVNamespace;

  // R2 Bucket
  POLICY_STORAGE: R2Bucket;

  // Queue
  POLICY_UPDATE_QUEUE: Queue;

  // Service bindings
  OPA_SERVER?: Fetcher;

  // Environment variables
  ENVIRONMENT: string;
  LOG_LEVEL: string;
  SERVICE_NAME: string;
  VERSION: string;
  OPA_EVALUATION_TIMEOUT: string;
  POLICY_CACHE_TTL: string;

  // Analytics Engine
  POLICY_ANALYTICS?: AnalyticsEngineDataset;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const startTime = Date.now();

    try {
      // Initialize policy engine
      const policyEngine = new PolicyEngine(env);

      // Parse request
      const url = new URL(request.url);
      const path = url.pathname;

      // Route request
      if (path === '/health') {
        return handleHealth(request, env, policyEngine);
      }

      if (path === '/v1/evaluate') {
        return handlePolicyEvaluation(request, env, policyEngine, ctx);
      }

      if (path === '/v1/policies' && request.method === 'POST') {
        return handlePolicyUpload(request, env, policyEngine);
      }

      if (path.startsWith('/v1/policies/') && request.method === 'GET') {
        return handlePolicyGet(request, env, policyEngine);
      }

      if (path === '/v1/bundles' && request.method === 'POST') {
        return handleBundleUpload(request, env, policyEngine);
      }

      if (path === '/v1/test' && request.method === 'POST') {
        return handlePolicyTest(request, env, policyEngine);
      }

      if (path === '/v1/metrics') {
        return handleMetrics(request, env, policyEngine);
      }

      if (path === '/v1/cache/clear' && request.method === 'DELETE') {
        return handleCacheClear(request, env, policyEngine);
      }

      return new Response('Not Found', { status: 404 });

    } catch (error) {
      console.error('Policy service error:', error);

      return new Response(JSON.stringify({
        error: 'Internal Server Error',
        message: error.message,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'X-Duration': String(Date.now() - startTime)
        }
      });
    }
  },

  async queue(batch: MessageBatch, env: Env): Promise<void> {
    // Handle policy update queue messages
    for (const message of batch.messages) {
      try {
        const policyEngine = new PolicyEngine(env);
        await policyEngine.handlePolicyUpdate(message);
        message.ack();
      } catch (error) {
        console.error('Queue processing error:', error);
        message.retry();
      }
    }
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    // Handle scheduled tasks
    if (event.cron === '*/5 * * * *') {
      // Every 5 minutes: update metrics and cleanup cache
      const policyEngine = new PolicyEngine(env);
      await policyEngine.maintenanceTasks();
    }
  }
};

async function handleHealth(request: Request, env: Env, policyEngine: PolicyEngine): Promise<Response> {
  const health = await policyEngine.healthCheck();

  return new Response(JSON.stringify({
    status: health.status,
    version: env.VERSION,
    environment: env.ENVIRONMENT,
    timestamp: new Date().toISOString(),
    uptime: health.uptime,
    checks: health.checks
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

async function handlePolicyEvaluation(
  request: Request,
  env: Env,
  policyEngine: PolicyEngine,
  ctx: ExecutionContext
): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const body = await request.json() as PolicyEvaluationRequest;

  // Validate request
  if (!body.input || !body.query) {
    return new Response(JSON.stringify({
      error: 'Bad Request',
      message: 'input and query are required'
    }), { status: 400 });
  }

  // Evaluate policy
  const decision = await policyEngine.evaluatePolicy(body);

  // Log decision for audit
  ctx.waitUntil(logDecision(env, decision));

  // Update metrics
  if (env.POLICY_ANALYTICS) {
    ctx.waitUntil(updateAnalytics(env, decision));
  }

  return new Response(JSON.stringify(decision), {
    headers: {
      'Content-Type': 'application/json',
      'X-Evaluation-Time': String(decision.metrics.execution_time_ms)
    }
  });
}

async function handlePolicyUpload(request: Request, env: Env, policyEngine: PolicyEngine): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const body = await request.json() as PolicyUploadRequest;

  // Validate policy
  const validation = await policyEngine.validatePolicy(body);
  if (!validation.valid) {
    return new Response(JSON.stringify({
      error: 'Validation Error',
      message: 'Policy validation failed',
      errors: validation.errors
    }), { status: 400 });
  }

  // Save policy
  const policy = await policyEngine.savePolicy(body);

  // Trigger hot reload
  const policyEngine = new PolicyEngine(env);
  await policyEngine.reloadPolicies();

  return new Response(JSON.stringify({
    success: true,
    policy: {
      id: policy.id,
      name: policy.name,
      version: policy.version,
      created_at: policy.created_at
    }
  }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function handlePolicyGet(request: Request, env: Env, policyEngine: PolicyEngine): Promise<Response> {
  const url = new URL(request.url);
  const policyName = url.pathname.split('/').pop();

  const policy = await policyEngine.getPolicy(policyName);
  if (!policy) {
    return new Response('Policy Not Found', { status: 404 });
  }

  return new Response(JSON.stringify(policy), {
    headers: { 'Content-Type': 'application/json' }
  });
}

async function handleBundleUpload(request: Request, env: Env, policyEngine: PolicyEngine): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const body = await request.json() as BundleUploadRequest;

  // Validate bundle
  const validation = await policyEngine.validateBundle(body);
  if (!validation.valid) {
    return new Response(JSON.stringify({
      error: 'Validation Error',
      message: 'Bundle validation failed',
      errors: validation.errors
    }), { status: 400 });
  }

  // Save bundle
  const bundle = await policyEngine.saveBundle(body);

  // Trigger hot reload
  await policyEngine.reloadPolicies();

  return new Response(JSON.stringify({
    success: true,
    bundle: {
      id: bundle.id,
      name: bundle.name,
      version: bundle.version,
      created_at: bundle.created_at
    }
  }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function handlePolicyTest(request: Request, env: Env, policyEngine: PolicyEngine): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const body = await request.json() as PolicyTestRequest;

  // Test policy
  const results = await policyEngine.testPolicy(body);

  return new Response(JSON.stringify({
    success: true,
    results: results,
    summary: {
      total: results.length,
      passed: results.filter(r => r.passed).length,
      failed: results.filter(r => !r.passed).length
    }
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

async function handleMetrics(request: Request, env: Env, policyEngine: PolicyEngine): Promise<Response> {
  const metrics = await policyEngine.getMetrics();

  return new Response(JSON.stringify(metrics), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache'
    }
  });
}

async function handleCacheClear(request: Request, env: Env, policyEngine: PolicyEngine): Promise<Response> {
  const url = new URL(request.url);
  const pattern = url.searchParams.get('pattern') || '*';

  await policyEngine.clearCache(pattern);

  return new Response(JSON.stringify({
    success: true,
    message: `Cache cleared for pattern: ${pattern}`
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

async function logDecision(env: Env, decision: PolicyDecision): Promise<void> {
  try {
    await env.POLICY_DB.prepare(`
      INSERT INTO policy_evaluations (
        tenant_id, user_id, request_id, decision, reason,
        input_data, output_data, execution_time_ms, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      decision.audit_log.tenant_id,
      decision.audit_log.user_id,
      decision.audit_log.event_id,
      decision.allowed,
      decision.reason,
      JSON.stringify(decision.audit_log.input_data),
      JSON.stringify(decision.audit_log.output_data),
      decision.metrics.execution_time_ms,
      new Date().toISOString()
    ).run();
  } catch (error) {
    console.error('Failed to log decision:', error);
  }
}

async function updateAnalytics(env: Env, decision: PolicyDecision): Promise<void> {
  if (!env.POLICY_ANALYTICS) return;

  try {
    await env.POLICY_ANALYTICS.writeDataPoint({
      blobs: [decision.audit_log.tenant_id, decision.audit_log.user_id],
      doubles: [decision.metrics.execution_time_ms, decision.allowed ? 1 : 0],
      dimensions: {
        action: decision.audit_log.action,
        resource: decision.audit_log.resource,
        result: decision.allowed ? 'allow' : 'deny'
      },
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Failed to update analytics:', error);
  }
}

// Type definitions
interface PolicyEvaluationRequest {
  input: Record<string, unknown>;
  query: string;
  options?: {
    timeout?: number;
    cache?: boolean;
  };
}

interface PolicyDecision {
  allowed: boolean;
  reason: string;
  conditions: unknown[];
  audit_log: Record<string, unknown>;
  metrics: {
    execution_time_ms: number;
    policies_checked: number;
    rules_evaluated: number;
  };
  cache_hit: boolean;
}

interface PolicyUploadRequest {
  name: string;
  content: string;
  type: string;
  metadata?: Record<string, unknown>;
}

interface BundleUploadRequest {
  name: string;
  version: string;
  policies: Record<string, string>;
  data?: Record<string, string>;
  signatures?: string[];
  metadata?: Record<string, unknown>;
}

interface PolicyTestRequest {
  policy: string;
  test_cases: Array<{
    name: string;
    input: Record<string, unknown>;
    expected: boolean;
  }>;
}

interface PolicyTestResult {
  name: string;
  passed: boolean;
  actual: boolean;
  expected: boolean;
  error?: string;
  duration: number;
}
