/**
 * QueryFlux Cloudflare Worker
 *
 * Handles database operations for QueryFlux frontend
 * Works within Cloudflare Workers constraints (no TCP connections)
 * Uses HTTP APIs and edge databases
 */

import { DatabaseService } from './services/database';
import { SupabaseService } from './services/supabase';
import { AIService } from './services/ai';

export interface Env {
  // Supabase configuration
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;

  // KV Storage for caching and sessions
  QUERYFLUX_KV: KVNamespace;

  // D1 Database (SQLite) for edge operations
  QUERYFLUX_DB: D1Database;

  // R2 Storage for file operations
  QUERYFLUX_STORAGE: R2Bucket;

  // AI bindings
  AI?: Fetcher;

  // Feature flags
  ENABLE_AI_FEATURES: string;
  ENABLE_VOICE_COMMANDS: string;

  // CORS — comma-separated allowed origins
  ALLOWED_ORIGINS?: string;
}

/** Parse allowed origins from env var (comma-separated) */
function getAllowedOrigins(env: Env): string[] {
  const raw = env.ALLOWED_ORIGINS || 'http://localhost:3000';
  return raw.split(',').map(o => o.trim()).filter(o => o !== '' && o !== '*');
}

/** Build CORS headers for a given request origin */
function corsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('Origin') || '';
  const allowed = getAllowedOrigins(env);
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Request-ID',
    'Vary': 'Origin',
  };
  if (allowed.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      // Handle CORS preflight
      const cors = corsHeaders(request, env);

      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: cors });
      }

      const url = new URL(request.url);
      const path = url.pathname;

      // Route handling
      switch (path) {
        case '/api/health':
          return handleHealthCheck(request, env);

        case '/api/database/test':
          return handleDatabaseTest(request, env);

        case '/api/database/connect':
          return handleDatabaseConnect(request, env);

        case '/api/database/query':
          return handleDatabaseQuery(request, env);

        case '/api/database/schema':
          return handleDatabaseSchema(request, env);

        case '/api/connections':
          return handleConnections(request, env);

        case '/api/ai/generate-sql':
          return handleAIGenerateSQL(request, env);

        case '/api/ai/optimize-query':
          return handleAIOptimizeQuery(request, env);

        default:
          return new Response(
            JSON.stringify({ error: 'Endpoint not found' }),
            {
              status: 404,
              headers: {
                ...cors,
                'Content-Type': 'application/json'
              }
            }
          );
      }
    } catch (error) {
      console.error('Worker error:', error);
      return new Response(
        JSON.stringify({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error'
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders(request, env)
          }
        }
      );
    }
  }
};

/**
 * Health check endpoint
 */
async function handleHealthCheck(request: Request, env: Env): Promise<Response> {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      supabase: await checkSupabaseHealth(env),
      kv: await checkKVHealth(env.QUERYFLUX_KV),
      d1: await checkD1Health(env.QUERYFLUX_DB),
      ai: env.AI ? 'available' : 'disabled'
    },
    features: {
      ai: env.ENABLE_AI_FEATURES === 'true',
      voice: env.ENABLE_VOICE_COMMANDS === 'true'
    }
  };

  return new Response(JSON.stringify(health), {
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(request, env)
    }
  });
}

/**
 * Test database connection
 */
async function handleDatabaseTest(request: Request, env: Env): Promise<Response> {
  try {
    const { connectionConfig } = await request.json() as { connectionConfig: any };

    const databaseService = new DatabaseService(env);
    const result = await databaseService.testConnection(connectionConfig);

    return new Response(JSON.stringify(result), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders(request, env)
      }
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Connection test failed'
      }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders(request, env)
        }
      }
    );
  }
}

/**
 * Create database connection
 */
async function handleDatabaseConnect(request: Request, env: Env): Promise<Response> {
  try {
    const { connectionData, authToken } = await request.json() as {
      connectionData: any;
      authToken: string;
    };

    // Verify auth token with Supabase
    const supabaseService = new SupabaseService(env);
    const user = await supabaseService.verifyToken(authToken);

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders(request, env)
          }
        }
      );
    }

    const databaseService = new DatabaseService(env);
    const result = await databaseService.createConnection(connectionData, user.id);

    return new Response(JSON.stringify(result), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders(request, env)
      }
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Connection failed'
      }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders(request, env)
        }
      }
    );
  }
}

/**
 * Execute database query
 */
async function handleDatabaseQuery(request: Request, env: Env): Promise<Response> {
  try {
    const { connectionId, query, authToken } = await request.json() as {
      connectionId: string;
      query: string;
      authToken: string;
    };

    // Verify auth token
    const supabaseService = new SupabaseService(env);
    const user = await supabaseService.verifyToken(authToken);

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders(request, env)
          }
        }
      );
    }

    const databaseService = new DatabaseService(env);
    const result = await databaseService.executeQuery(connectionId, query, user.id);

    return new Response(JSON.stringify(result), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders(request, env)
      }
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Query execution failed'
      }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders(request, env)
        }
      }
    );
  }
}

/**
 * Get database schema
 */
async function handleDatabaseSchema(request: Request, env: Env): Promise<Response> {
  try {
    const { connectionId, authToken } = await request.json() as {
      connectionId: string;
      authToken: string;
    };

    // Verify auth token
    const supabaseService = new SupabaseService(env);
    const user = await supabaseService.verifyToken(authToken);

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders(request, env)
          }
        }
      );
    }

    const databaseService = new DatabaseService(env);
    const result = await databaseService.getSchema(connectionId, user.id);

    return new Response(JSON.stringify(result), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders(request, env)
      }
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Schema retrieval failed'
      }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders(request, env)
        }
      }
    );
  }
}

/**
 * Handle user connections
 */
async function handleConnections(request: Request, env: Env): Promise<Response> {
  try {
    const { authToken } = await request.json() as { authToken: string };

    const supabaseService = new SupabaseService(env);
    const user = await supabaseService.verifyToken(authToken);

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders(request, env)
          }
        }
      );
    }

    const connections = await supabaseService.getUserConnections(user.id);

    return new Response(JSON.stringify(connections), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders(request, env)
      }
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to retrieve connections'
      }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders(request, env)
        }
      }
    );
  }
}

/**
 * Generate SQL using AI
 */
async function handleAIGenerateSQL(request: Request, env: Env): Promise<Response> {
  try {
    if (env.AI === undefined || env.ENABLE_AI_FEATURES !== 'true') {
      return new Response(
        JSON.stringify({ error: 'AI features not available' }),
        {
          status: 503,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders(request, env)
          }
        }
      );
    }

    const { prompt, databaseType, authToken } = await request.json() as {
      prompt: string;
      databaseType: string;
      authToken: string;
    };

    const supabaseService = new SupabaseService(env);
    const user = await supabaseService.verifyToken(authToken);

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders(request, env)
          }
        }
      );
    }

    const aiService = new AIService(env);
    const result = await aiService.generateSQL(prompt, databaseType);

    return new Response(JSON.stringify(result), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders(request, env)
      }
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'AI SQL generation failed'
      }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders(request, env)
        }
      }
    );
  }
}

/**
 * Optimize query using AI
 */
async function handleAIOptimizeQuery(request: Request, env: Env): Promise<Response> {
  try {
    if (env.AI === undefined || env.ENABLE_AI_FEATURES !== 'true') {
      return new Response(
        JSON.stringify({ error: 'AI features not available' }),
        {
          status: 503,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders(request, env)
          }
        }
      );
    }

    const { query, databaseType, authToken } = await request.json() as {
      query: string;
      databaseType: string;
      authToken: string;
    };

    const supabaseService = new SupabaseService(env);
    const user = await supabaseService.verifyToken(authToken);

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders(request, env)
          }
        }
      );
    }

    const aiService = new AIService(env);
    const result = await aiService.optimizeQuery(query, databaseType);

    return new Response(JSON.stringify(result), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders(request, env)
      }
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'AI query optimization failed'
      }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders(request, env)
        }
      }
    );
  }
}

/**
 * Health check helpers
 */
async function checkSupabaseHealth(env: Env): Promise<string> {
  try {
    const supabaseService = new SupabaseService(env);
    await supabaseService.healthCheck();
    return 'healthy';
  } catch {
    return 'unhealthy';
  }
}

async function checkKVHealth(kv: KVNamespace): Promise<string> {
  try {
    await kv.put('health-check', 'ok');
    const result = await kv.get('health-check');
    return result === 'ok' ? 'healthy' : 'unhealthy';
  } catch {
    return 'unhealthy';
  }
}

async function checkD1Health(d1: D1Database): Promise<string> {
  try {
    await d1.prepare('SELECT 1').first();
    return 'healthy';
  } catch {
    return 'unhealthy';
  }
}
