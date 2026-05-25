import {
  handleHealthCheck,
  handleOllamaRequest,
  handleOpenAIRequest,
  handleListModels,
  handleDatabaseRequest,
  handleCacheRequest,
} from './worker-routes';

export interface Env {
  QUERYFLUX_DB: D1Database;
  QUERYFLUX_CACHE: KVNamespace;
  QUERYFLUX_STORAGE: R2Bucket;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  OPENAI_API_KEY?: string;
  JWT_SECRET: string;
  OLLAMA_URL?: string;
  ALLOWED_ORIGINS?: string;
}

/** Build CORS headers using allowed origins from env var */
function getCorsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('Origin') || '';
  const raw = env.ALLOWED_ORIGINS || 'http://localhost:3000';
  const allowed = raw.split(',').map(o => o.trim()).filter(o => o !== '' && o !== '*');
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
  if (allowed.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

// Static fallback for contexts without request/env access
const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

async function handleAIRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  switch (path) {
    case '/api/ai/ollama':
      return handleOllamaRequest(request, env);
    case '/api/ai/openai':
      return handleOpenAIRequest(request, env);
    case '/api/ai/models':
      return handleListModels(request, env);
    default:
      return new Response('Not Found', { status: 404, headers: corsHeaders });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: getCorsHeaders(request, env) });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    if (path.startsWith('/api/ai')) {
      return handleAIRequest(request, env);
    }

    if (path.startsWith('/api/connections') || path.startsWith('/api/queries')) {
      return handleDatabaseRequest(request, env);
    }

    if (path.startsWith('/api/cache')) {
      return handleCacheRequest(request, env);
    }

    if (path === '/api/health' || path === '/health') {
      return handleHealthCheck();
    }

    return new Response('QueryFlux API - Cloudflare Worker', {
      headers: { 'Content-Type': 'text/plain', ...corsHeaders },
    });
  },
};
