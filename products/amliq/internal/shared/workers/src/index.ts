/**
 * FinSavvy AI Suite - Revolutionary AI-Powered Financial Technology Platform
 * Main entry point with AI-enhanced subdomain routing and autonomous agent orchestration
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

import type { Env, ProductContext, APIRequest, APIResponse } from "./types";
import { SubdomainRouter } from "./middleware/subdomain-router";
import { AuthMiddleware } from "./middleware/auth";
import { RateLimitMiddleware } from "./middleware/rate-limit";
import { AIMiddleware } from "./middleware/ai-middleware";
import { MonitoringMiddleware } from "./middleware/monitoring";

// Product route handlers
import { billingRoutes } from "./billing/routes";
import { complianceRoutes } from "./compliance/routes";
import { intelligenceRoutes } from "./intelligence/routes";
import { riskRoutes } from "./risk/routes";
import { aiRoutes } from "./ai/routes";
import { openaiAppRoutes } from "./ai/openai-app";
import migrationRoutes from "./api/migration-api";
import orchestrationRoutes from "./api/ai-orchestration-api";
import ragRoutes from "./rag/routes";

// AI Agent Durable Objects
import { AgentOrchestrator } from "./agents/agent-orchestrator";
import { BillingAgent } from "./agents/billing-agent";
import { ComplianceAgent } from "./agents/compliance-agent";
import { IntelligenceAgent } from "./agents/intelligence-agent";
import { RiskAgent } from "./agents/risk-agent";

const app = new Hono<{ Bindings: Env }>();

// Global middleware stack with AI enhancement
app.use("*", logger());
app.use("*", secureHeaders());
app.use(
  "*",
  cors({
    origin: [
      "https://finsavvyai.com",
      "https://billing.finsavvyai.com",
      "https://compliance.finsavvyai.com",
      "https://intelligence.finsavvyai.com",
      "https://risk.finsavvyai.com",
      "https://api.finsavvyai.com",
    ],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "X-Organization-ID",
      "X-User-ID",
    ],
    credentials: true,
  }),
);

app.use("*", SubdomainRouter());
app.use("*", RateLimitMiddleware());
app.use("*", MonitoringMiddleware());
app.use("*", AIMiddleware());

// Health check endpoint
app.get("/health", async (c) => {
  const startTime = Date.now();

  // Comprehensive health check with AI system status
  const health = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    environment: c.env.ENVIRONMENT,
    latency_ms: Date.now() - startTime,
    services: {
      databases: await checkDatabases(c),
      kv: await checkKVStores(c),
      r2: await checkR2Buckets(c),
      ai: await checkAIServices(c),
      agents: await checkAgents(c),
    },
    ai_metrics: await getAIMetrics(c),
  };

  return c.json(health);
});

// Root domain - Unified platform landing and routing
app.get("/", async (c) => {
  const productContext = c.get("productContext") as ProductContext;

  if (
    productContext.subdomain === "www" ||
    productContext.subdomain === "api"
  ) {
    // Root API documentation and platform overview
    return c.json({
      name: "FinSavvy AI Suite",
      description:
        "Revolutionary AI-powered financial technology platform with autonomous agents",
      version: "1.0.0",
      products: {
        billing: {
          name: "Smart Billing & Payment SDK",
          description:
            "AI-enhanced invoice management and payment orchestration",
          url: "https://billing.finsavvyai.com",
        },
        compliance: {
          name: "Enterprise Compliance Platform",
          description:
            "AI-powered KYC, sanctions screening, and compliance workflows",
          url: "https://compliance.finsavvyai.com",
        },
        intelligence: {
          name: "Financial Intelligence System",
          description:
            "AI-driven financial analysis, forecasting, and insights",
          url: "https://intelligence.finsavvyai.com",
        },
        risk: {
          name: "Risk Investigator Engine",
          description: "Real-time AI-powered risk analysis and fraud detection",
          url: "https://risk.finsavvyai.com",
        },
      },
      ai_capabilities: {
        autonomous_agents:
          "Specialized financial agents with autonomous decision-making",
        rag_system: "Knowledge base with intelligent document processing",
        multimodal_ai:
          "Document analysis, voice processing, and natural language understanding",
        predictive_analytics: "Advanced forecasting and pattern recognition",
        continuous_learning: "Adaptive AI that improves from user interactions",
      },
      openai_app: {
        name: "FinSavvy AI Assistant",
        description: "ChatGPT integration for all platform capabilities",
        coming_soon: "Available in OpenAI GPT Store",
      },
      documentation: "https://docs.finsavvyai.com",
      status: "https://status.finsavvyai.com",
    });
  }

  // Redirect to appropriate product subdomain
  return c.redirect(`https://${productContext.subdomain}.finsavvyai.com`);
});

// AI-powered API endpoints
app.route("/api/ai", aiRoutes);
app.route("/api/openai", openaiAppRoutes);

// Database migration API endpoints
app.route("/api/migrations", migrationRoutes);

// AI orchestration API endpoints
app.route("/api/orchestration", orchestrationRoutes);

// RAG (Retrieval-Augmented Generation) API endpoints
app.route("/api/rag", ragRoutes);

// Product-specific routing based on subdomain
app.route("/api/billing", billingRoutes);
app.route("/api/compliance", complianceRoutes);
app.route("/api/intelligence", intelligenceRoutes);
app.route("/api/risk", riskRoutes);

// AI Agent communication endpoints
app.all("/api/agents/:agentId/*", async (c) => {
  const agentId = c.req.param("agentId");
  const agentType = determineAgentType(agentId);
  const agentNamespace = getAgentNamespace(c.env, agentType);

  if (!agentNamespace) {
    return c.json({ error: "Invalid agent type" }, 400);
  }

  const agentId_DO = agentNamespace.idFromName(agentId);
  const agentStub = agentNamespace.get(agentId_DO);

  // Forward request to the appropriate agent Durable Object
  const response = await agentStub.fetch(c.req.raw);

  return response;
});

// Autonomous agent orchestration
app.post("/api/orchestrator/execute", async (c) => {
  const { task, agent_type, priority, user_context } = await c.req.json();

  const orchestratorId = `orchestrator-${c.env.ENVIRONMENT}`;
  const orchestrator_DO = c.env.AGENT_ORCHESTRATOR.idFromName(orchestratorId);
  const orchestratorStub = c.env.AGENT_ORCHESTRATOR.get(orchestrator_DO);

  const response = await orchestratorStub.fetch(
    new Request(c.req.url, {
      method: "POST",
      headers: c.req.headers,
      body: JSON.stringify({
        action: "execute_task",
        task,
        agent_type,
        priority,
        user_context,
        request_id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      }),
    }),
  );

  const result = await response.json();
  return c.json(result);
});

// Real-time agent collaboration endpoint
app.post("/api/agents/collaborate", async (c) => {
  const { collaboration_request } = await c.req.json();

  const orchestrator_DO = c.env.AGENT_ORCHESTRATOR.get(
    c.env.AGENT_ORCHESTRATOR.idFromName(`orchestrator-${c.env.ENVIRONMENT}`),
  );

  const response = await orchestrator_DO.fetch(
    new Request(c.req.url, {
      method: "POST",
      headers: c.req.headers,
      body: JSON.stringify({
        action: "coordinate_agents",
        collaboration_request,
        request_id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      }),
    }),
  );

  const result = await response.json();
  return c.json(result);
});

// AI learning and feedback endpoint
app.post("/api/ai/feedback", async (c) => {
  const { agent_id, task_id, rating, comment, context } = await c.req.json();

  // Store feedback for AI learning
  await c.env.AGENT_MEMORY.put(
    `feedback:${agent_id}:${task_id}`,
    JSON.stringify({
      rating,
      comment,
      context,
      timestamp: new Date().toISOString(),
      user_id: c.get("user")?.id,
    }),
    { expirationTtl: 365 * 24 * 60 * 60 }, // 1 year
  );

  // Trigger agent learning process
  const agentType = determineAgentType(agent_id);
  const agentNamespace = getAgentNamespace(c.env, agentType);

  if (agentNamespace) {
    const agent_DO = agentNamespace.idFromName(agent_id);
    const agentStub = agentNamespace.get(agent_DO);

    await agentStub.fetch(
      new Request(c.req.url, {
        method: "POST",
        headers: c.req.headers,
        body: JSON.stringify({
          action: "process_feedback",
          feedback: { task_id, rating, comment, context },
        }),
      }),
    );
  }

  return c.json({
    success: true,
    message: "Feedback processed for AI learning",
  });
});

// Durable Object exports
export {
  AgentOrchestrator,
  BillingAgent,
  ComplianceAgent,
  IntelligenceAgent,
  RiskAgent,
};

// Error handling with AI-powered insights
app.onError(async (err, c) => {
  const requestId = c.get("requestId") || crypto.randomUUID();
  const productContext = (c.get("productContext") as ProductContext) || {
    subdomain: "unknown",
    product: "unknown",
  };

  console.error("Request error:", {
    requestId,
    error: err.message,
    stack: err.stack,
    subdomain: productContext.subdomain,
    user_id: c.get("user")?.id,
    organization_id: c.get("organization")?.id,
  });

  // AI-powered error analysis and recommendations
  const errorAnalysis = await analyzeError(c.env, err, productContext);

  return c.json(
    {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
        details: c.env.ENVIRONMENT === "development" ? err.message : undefined,
        request_id: requestId,
        ai_insights: errorAnalysis,
      },
      meta: {
        request_id: requestId,
        timestamp: new Date().toISOString(),
        product: productContext.product,
      },
    },
    500,
  );
});

// 404 handler with AI-powered suggestions
app.notFound(async (c) => {
  const productContext = (c.get("productContext") as ProductContext) || {
    subdomain: "unknown",
    product: "unknown",
  };
  const requestId = c.get("requestId") || crypto.randomUUID();

  // AI-powered suggestions for similar endpoints
  const suggestions = await suggestEndpoints(c.env, c.req.path, productContext);

  return c.json(
    {
      success: false,
      error: {
        code: "NOT_FOUND",
        message: "Endpoint not found",
        suggestions,
        request_id: requestId,
      },
      meta: {
        request_id: requestId,
        timestamp: new Date().toISOString(),
        available_endpoints: getAvailableEndpoints(productContext),
      },
    },
    404,
  );
});

// Helper functions
async function checkDatabases(c: any): Promise<Record<string, boolean>> {
  const checks: Record<string, boolean> = {};

  try {
    await c.env.DB_BILLING_US.prepare("SELECT 1").first();
    checks.billing_us = true;
  } catch {
    checks.billing_us = false;
  }

  try {
    await c.env.DB_COMPLIANCE_US.prepare("SELECT 1").first();
    checks.compliance_us = true;
  } catch {
    checks.compliance_us = false;
  }

  try {
    await c.env.DB_INTELLIGENCE_US.prepare("SELECT 1").first();
    checks.intelligence_us = true;
  } catch {
    checks.intelligence_us = false;
  }

  try {
    await c.env.DB_RISK_US.prepare("SELECT 1").first();
    checks.risk_us = true;
  } catch {
    checks.risk_us = false;
  }

  return checks;
}

async function checkKVStores(c: any): Promise<Record<string, boolean>> {
  const checks: Record<string, boolean> = {};

  try {
    await c.env.CACHE.put("health-check", "ok", { expirationTtl: 60 });
    checks.cache = true;
  } catch {
    checks.cache = false;
  }

  try {
    await c.env.SESSIONS.put("health-check", "ok", { expirationTtl: 60 });
    checks.sessions = true;
  } catch {
    checks.sessions = false;
  }

  try {
    await c.env.AGENT_MEMORY.put("health-check", "ok", { expirationTtl: 60 });
    checks.agent_memory = true;
  } catch {
    checks.agent_memory = false;
  }

  return checks;
}

async function checkR2Buckets(c: any): Promise<Record<string, boolean>> {
  const checks: Record<string, boolean> = {};

  try {
    await c.env.DOCUMENTS.head("health-check");
    checks.documents = true;
  } catch {
    checks.documents = false;
  }

  try {
    await c.env.EVIDENCE.head("health-check");
    checks.evidence = true;
  } catch {
    checks.evidence = false;
  }

  return checks;
}

async function checkAIServices(c: any): Promise<Record<string, boolean>> {
  const checks: Record<string, boolean> = {};

  try {
    // Test AI model availability
    const response = await c.env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
      messages: [{ role: "user", content: "test" }],
    });
    checks.llm = !!response;
  } catch {
    checks.llm = false;
  }

  try {
    // Test embedding model availability
    const response = await c.env.AI.run("@cf/baai/bge-base-en-v1.5", {
      text: ["test"],
    });
    checks.embeddings = !!response;
  } catch {
    checks.embeddings = false;
  }

  return checks;
}

async function checkAgents(c: any): Promise<Record<string, boolean>> {
  const checks: Record<string, boolean> = {};

  try {
    const orchestrator_DO = c.env.AGENT_ORCHESTRATOR.idFromName(
      `orchestrator-${c.env.ENVIRONMENT}`,
    );
    const orchestratorStub = c.env.AGENT_ORCHESTRATOR.get(orchestrator_DO);
    await orchestratorStub.fetch(new Request("https://test.url/health"));
    checks.orchestrator = true;
  } catch {
    checks.orchestrator = false;
  }

  return checks;
}

async function getAIMetrics(c: any): Promise<any> {
  try {
    // Get AI performance metrics from agent memory
    const metrics = await c.env.AGENT_MEMORY.get("global_metrics");
    return metrics ? JSON.parse(metrics) : {};
  } catch {
    return {};
  }
}

function determineAgentType(agentId: string): string {
  if (agentId.startsWith("billing-")) return "billing";
  if (agentId.startsWith("compliance-")) return "compliance";
  if (agentId.startsWith("intelligence-")) return "intelligence";
  if (agentId.startsWith("risk-")) return "risk";
  if (agentId.startsWith("orchestrator-")) return "orchestrator";
  return "unknown";
}

function getAgentNamespace(
  env: Env,
  agentType: string,
): DurableObjectNamespace | null {
  switch (agentType) {
    case "billing":
      return env.BILLING_AGENT;
    case "compliance":
      return env.COMPLIANCE_AGENT;
    case "intelligence":
      return env.INTELLIGENCE_AGENT;
    case "risk":
      return env.RISK_AGENT;
    case "orchestrator":
      return env.AGENT_ORCHESTRATOR;
    default:
      return null;
  }
}

async function analyzeError(
  env: Env,
  error: Error,
  context: ProductContext,
): Promise<any> {
  try {
    // Use AI to analyze error and provide insights
    const response = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
      messages: [
        {
          role: "user",
          content: `Analyze this error in a financial technology application and provide insights:
        Error: ${error.message}
        Product: ${context.product}
        Subdomain: ${context.subdomain}

        Provide:
        1. Likely root cause
        2. Potential impact on users
        3. Recommended immediate actions
        4. Prevention strategies

        Keep response concise and actionable.`,
        },
      ],
    });

    return {
      analysis: response?.response || "Analysis unavailable",
      timestamp: new Date().toISOString(),
    };
  } catch {
    return {
      analysis: "Error analysis unavailable",
      timestamp: new Date().toISOString(),
    };
  }
}

async function suggestEndpoints(
  env: Env,
  path: string,
  context: ProductContext,
): Promise<string[]> {
  // Simple path-based suggestions for now, can be enhanced with AI
  const commonEndpoints = {
    billing: [
      "/api/billing/invoices",
      "/api/billing/payments",
      "/api/billing/customers",
    ],
    compliance: [
      "/api/compliance/kyc",
      "/api/compliance/screening",
      "/api/compliance/cases",
    ],
    intelligence: [
      "/api/intelligence/transactions",
      "/api/intelligence/analytics",
      "/api/intelligence/forecasts",
    ],
    risk: ["/api/risk/events", "/api/risk/analysis", "/api/risk/policies"],
  };

  const basePath = path.split("/").slice(0, 3).join("/");
  const suggestions =
    commonEndpoints[context.product as keyof typeof commonEndpoints] || [];

  return suggestions.filter((ep) => ep !== path).slice(0, 3);
}

function getAvailableEndpoints(context: ProductContext): string[] {
  const endpoints = {
    billing: [
      "GET /api/billing/invoices",
      "POST /api/billing/invoices",
      "GET /api/billing/payments",
      "POST /api/billing/payments",
      "GET /api/billing/customers",
    ],
    compliance: [
      "GET /api/compliance/kyc",
      "POST /api/compliance/kyc",
      "POST /api/compliance/screening",
      "GET /api/compliance/cases",
    ],
    intelligence: [
      "GET /api/intelligence/transactions",
      "POST /api/intelligence/transactions",
      "GET /api/intelligence/analytics",
      "GET /api/intelligence/forecasts",
    ],
    risk: [
      "POST /api/risk/events",
      "GET /api/risk/analysis",
      "GET /api/risk/policies",
      "POST /api/risk/policies",
    ],
  };

  return endpoints[context.product as keyof typeof endpoints] || [];
}

export default {
  fetch: app.fetch,
};
