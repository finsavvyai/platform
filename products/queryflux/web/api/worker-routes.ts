import type { Env } from './cloudflare-worker';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

const jsonHeaders = { 'Content-Type': 'application/json', ...corsHeaders };

function errMsg(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

export async function handleHealthCheck(): Promise<Response> {
  const body = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    services: { database: 'connected', cache: 'connected', storage: 'connected' },
  };
  return new Response(JSON.stringify(body), { headers: jsonHeaders });
}

export async function handleOllamaRequest(request: Request, env: Env): Promise<Response> {
  try {
    const ollamaUrl = env.OLLAMA_URL || 'http://localhost:11434';
    const url = new URL(request.url);
    const newPath = url.pathname.replace('/api/ai', '/api');
    const targetUrl = `${ollamaUrl}${newPath}${url.search}`;

    const response = await fetch(targetUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body,
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`);
    }
    return response;
  } catch (error: unknown) {
    const message = errMsg(error);
    return new Response(
      JSON.stringify({ error: 'Ollama service unavailable', message }),
      { status: 503, headers: jsonHeaders }
    );
  }
}

export async function handleOpenAIRequest(request: Request, env: Env): Promise<Response> {
  if (!env.OPENAI_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'OpenAI API key not configured' }),
      { status: 503, headers: jsonHeaders }
    );
  }

  try {
    const { messages, model = 'gpt-4-turbo-preview' } = (await request.json()) as {
      messages: unknown[];
      model?: string;
    };

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, messages, temperature: 0.7, max_tokens: 2000 }),
    });

    const data = await response.json();
    return new Response(JSON.stringify(data), { headers: jsonHeaders });
  } catch (error: unknown) {
    return new Response(
      JSON.stringify({ error: 'OpenAI API error', message: errMsg(error) }),
      { status: 500, headers: jsonHeaders }
    );
  }
}

export async function handleListModels(_request: Request, env: Env): Promise<Response> {
  const models: { id: string; name: string; provider: string }[] = [];
  if (env.OLLAMA_URL) {
    try {
      const response = await fetch(`${env.OLLAMA_URL}/api/tags`);
      const data = (await response.json()) as { models: { name: string }[] };
      models.push(...data.models.map((m) => ({ id: m.name, name: m.name, provider: 'ollama' })));
    } catch { /* Ollama unavailable */ }
  }
  if (env.OPENAI_API_KEY) {
    models.push(
      { id: 'gpt-4-turbo-preview', name: 'GPT-4 Turbo', provider: 'openai' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'openai' }
    );
  }
  return new Response(JSON.stringify({ models }), { headers: jsonHeaders });
}

export async function handleDatabaseRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  try {
    if (path === '/api/connections') {
      if (request.method === 'GET') {
        const result = await env.QUERYFLUX_DB.prepare(
          'SELECT * FROM connections ORDER BY created_at DESC'
        ).all();
        return new Response(JSON.stringify(result), { headers: jsonHeaders });
      }
      if (request.method === 'POST') {
        const data = (await request.json()) as Record<string, unknown>;
        const sql = `INSERT INTO connections (id, name, type, host, port, database, username, created_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`;
        const result = await env.QUERYFLUX_DB.prepare(sql)
          .bind(crypto.randomUUID(), data.name, data.type, data.host, data.port,
            data.database, data.username, new Date().toISOString())
          .run();
        return new Response(
          JSON.stringify({ success: true, id: result.meta.last_row_id }), { headers: jsonHeaders }
        );
      }
    }

    if (path === '/api/queries' && request.method === 'GET') {
      const result = await env.QUERYFLUX_DB.prepare(
        'SELECT * FROM queries ORDER BY created_at DESC LIMIT 100'
      ).all();
      return new Response(JSON.stringify(result), { headers: jsonHeaders });
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  } catch (error: unknown) {
    const message = errMsg(error);
    return new Response(
      JSON.stringify({ error: 'Database operation failed', message }),
      { status: 500, headers: jsonHeaders }
    );
  }
}

export async function handleCacheRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const key = url.searchParams.get('key');

  if (!key) {
    return new Response('Missing key parameter', { status: 400, headers: corsHeaders });
  }

  try {
    if (request.method === 'GET') {
      const value = await env.QUERYFLUX_CACHE.get(key);
      if (value === null) {
        return new Response('Not Found', { status: 404, headers: corsHeaders });
      }
      return new Response(value, { headers: jsonHeaders });
    }

    if (request.method === 'PUT') {
      const value = await request.text();
      const ttl = parseInt(url.searchParams.get('ttl') || '3600');
      await env.QUERYFLUX_CACHE.put(key, value, { expirationTtl: ttl });
      return new Response('OK', { headers: corsHeaders });
    }

    if (request.method === 'DELETE') {
      await env.QUERYFLUX_CACHE.delete(key);
      return new Response('OK', { headers: corsHeaders });
    }

    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  } catch (error: unknown) {
    const message = errMsg(error);
    return new Response(
      JSON.stringify({ error: 'Cache operation failed', message }),
      { status: 500, headers: jsonHeaders }
    );
  }
}
