/**
 * 🚀 FinSavvy AI Suite - RAG Worker (Simplified)
 * Minimal RAG system for Cloudflare Workers deployment
 */

interface Env {
  // D1 Database
  DB_RAG: D1Database;

  // R2 Bucket
  DOCUMENTS_BUCKET: R2Bucket;

  // AI & Vector
  AI: any; // Workers AI binding
  RAG_EMBEDDINGS: any; // Vectorize index

  // Environment Variables
  ENVIRONMENT: string;
  LOG_LEVEL: string;
  AI_MODEL: string;
  EMBEDDING_MODEL: string;
  DEFAULT_REGION: string;
  ENABLE_AI_FEATURES: string;
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    try {
      const url = new URL(request.url);
      const path = url.pathname;

      // CORS headers
      const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      };

      // Handle CORS preflight requests
      if (request.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
      }

      // Route handling
      if (path === "/health") {
        return handleHealthCheck(env);
      }

      if (path.startsWith("/api/")) {
        return handleAPIRequest(request, env, ctx);
      }

      // Default response
      return new Response(
        JSON.stringify({
          message: "FinSavvy AI Suite RAG Worker",
          version: "1.0.0",
          endpoints: [
            "/health",
            "/api/query",
            "/api/ingest",
            "/api/compliance",
          ],
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    } catch (error) {
      console.error("Worker error:", error);
      return new Response(
        JSON.stringify({
          error: "Internal server error",
          message: error.message,
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  },
};

async function handleHealthCheck(env: Env): Promise<Response> {
  try {
    // Test database connection
    const dbTest = await env.DB_RAG.prepare("SELECT 1 as test").first();

    // Test AI binding
    const aiTest = env.AI ? "available" : "not available";

    // Test Vectorize binding
    const vectorTest = env.RAG_EMBEDDINGS ? "available" : "not available";

    return new Response(
      JSON.stringify({
        status: "healthy",
        timestamp: new Date().toISOString(),
        services: {
          database: dbTest ? "connected" : "error",
          ai: aiTest,
          vectorize: vectorTest,
          r2: "connected",
        },
        environment: env.ENVIRONMENT,
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        status: "unhealthy",
        error: error.message,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

async function handleAPIRequest(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  try {
    if (path === "/api/query" && request.method === "POST") {
      return handleQuery(request, env);
    }

    if (path === "/api/ingest" && request.method === "POST") {
      return handleIngestion(request, env);
    }

    if (path === "/api/compliance" && request.method === "POST") {
      return handleCompliance(request, env);
    }

    return new Response(
      JSON.stringify({
        error: "Endpoint not found",
        available: ["/api/query", "/api/ingest", "/api/compliance"],
      }),
      {
        status: 404,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "API request failed",
        message: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

async function handleQuery(request: Request, env: Env): Promise<Response> {
  try {
    const body = (await request.json()) as {
      query: string;
      type?: "semantic" | "compliance" | "risk";
      maxResults?: number;
      jurisdiction?: string;
    };

    if (!body.query) {
      return new Response(
        JSON.stringify({
          error: "Query is required",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Generate embedding for query
    const embeddingResponse = await env.AI.run(env.EMBEDDING_MODEL, {
      text: [body.query],
    });

    if (!embeddingResponse.data || !embeddingResponse.data[0]) {
      throw new Error("Failed to generate query embedding");
    }

    const queryVector = embeddingResponse.data[0].embedding;

    // Search in Vectorize
    const vectorResults = await env.RAG_EMBEDDINGS.query(queryVector, {
      topK: body.maxResults || 10,
      namespace: "default",
      includeMetadata: true,
    });

    // Format results
    const results = vectorResults.matches.map((match: any) => ({
      id: match.id,
      title: match.metadata?.title || "Untitled",
      content: match.metadata?.content || "",
      score: match.score,
      metadata: match.metadata || {},
    }));

    return new Response(
      JSON.stringify({
        query: body.query,
        results,
        totalResults: results.length,
        processingTime: Date.now(),
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Query error:", error);
    return new Response(
      JSON.stringify({
        error: "Query processing failed",
        message: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

async function handleIngestion(request: Request, env: Env): Promise<Response> {
  try {
    const body = (await request.json()) as {
      content: string;
      title: string;
      source: string;
      jurisdiction?: string;
    };

    if (!body.content || !body.title) {
      return new Response(
        JSON.stringify({
          error: "Content and title are required",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Generate embeddings for content
    const embeddingResponse = await env.AI.run(env.EMBEDDING_MODEL, {
      text: [body.content],
    });

    if (!embeddingResponse.data || !embeddingResponse.data[0]) {
      throw new Error("Failed to generate content embedding");
    }

    const contentVector = embeddingResponse.data[0].embedding;
    const documentId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Store in Vectorize
    await env.RAG_EMBEDDINGS.upsert([
      {
        id: documentId,
        values: contentVector,
        metadata: {
          title: body.title,
          content: body.content,
          source: body.source,
          jurisdiction: body.jurisdiction || "US",
          timestamp: new Date().toISOString(),
          type: "document",
        },
      },
    ]);

    // Store original document in R2
    const documentKey = `documents/${documentId}.json`;
    await env.DOCUMENTS_BUCKET.put(
      documentKey,
      JSON.stringify({
        id: documentId,
        title: body.title,
        content: body.content,
        source: body.source,
        jurisdiction: body.jurisdiction || "US",
        timestamp: new Date().toISOString(),
        embedding: contentVector,
      }),
    );

    return new Response(
      JSON.stringify({
        success: true,
        documentId,
        message: "Document ingested successfully",
        embeddingDimensions: contentVector.length,
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Ingestion error:", error);
    return new Response(
      JSON.stringify({
        error: "Document ingestion failed",
        message: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

async function handleCompliance(request: Request, env: Env): Promise<Response> {
  try {
    const body = (await request.json()) as {
      scope?: {
        jurisdiction?: string;
        timeRange?: {
          from: string;
          to: string;
        };
      };
      query?: string;
    };

    // Default compliance query if not provided
    const complianceQuery =
      body.query || "compliance requirements regulations BSA AML";
    const jurisdiction = body.scope?.jurisdiction || "US";

    // Generate embedding for compliance query
    const embeddingResponse = await env.AI.run(env.EMBEDDING_MODEL, {
      text: [complianceQuery],
    });

    if (!embeddingResponse.data || !embeddingResponse.data[0]) {
      throw new Error("Failed to generate compliance query embedding");
    }

    const queryVector = embeddingResponse.data[0].embedding;

    // Search in Vectorize with compliance filters
    const vectorResults = await env.RAG_EMBEDDINGS.query(queryVector, {
      topK: 20,
      namespace: "compliance",
      filter: {
        jurisdiction: jurisdiction,
        type: "regulation",
      },
      includeMetadata: true,
    });

    // Format compliance results
    const results = vectorResults.matches.map((match: any) => ({
      id: match.id,
      title: match.metadata?.title || "Untitled",
      content: match.metadata?.content || "",
      score: match.score,
      compliance: {
        jurisdiction: match.metadata?.jurisdiction,
        type: match.metadata?.type,
        requirements: extractRequirements(match.metadata?.content || ""),
        lastUpdated: match.metadata?.timestamp,
      },
    }));

    return new Response(
      JSON.stringify({
        query: complianceQuery,
        jurisdiction,
        results,
        totalResults: results.length,
        analysis: {
          complianceScore: calculateComplianceScore(results),
          riskLevel: assessRiskLevel(results),
          recommendations: generateRecommendations(results),
        },
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Compliance analysis error:", error);
    return new Response(
      JSON.stringify({
        error: "Compliance analysis failed",
        message: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

// Helper functions
function extractRequirements(content: string): string[] {
  const requirements = [];
  const lines = content.split("\n");

  for (const line of lines) {
    // Look for requirement patterns
    if (
      line.includes("shall") ||
      line.includes("must") ||
      line.includes("required")
    ) {
      requirements.push(line.trim());
    }
  }

  return requirements.slice(0, 10); // Limit to 10 requirements
}

function calculateComplianceScore(results: any[]): number {
  if (results.length === 0) return 0;

  const avgScore =
    results.reduce((sum, result) => sum + (result.score || 0), 0) /
    results.length;
  return Math.min(avgScore * 100, 100);
}

function assessRiskLevel(results: any[]): "low" | "medium" | "high" {
  const avgScore = calculateComplianceScore(results);

  if (avgScore > 80) return "low";
  if (avgScore > 60) return "medium";
  return "high";
}

function generateRecommendations(results: any[]): string[] {
  const recommendations = [];

  if (results.length < 5) {
    recommendations.push(
      "Consider adding more regulatory documents to improve coverage",
    );
  }

  const avgScore = calculateComplianceScore(results);
  if (avgScore < 70) {
    recommendations.push(
      "Review and update compliance policies based on findings",
    );
  }

  return recommendations;
}
