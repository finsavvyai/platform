// Cloudflare Worker API for QueryFlux Backend
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: corsHeaders
      });
    }

    // Route handling
    if (url.pathname === '/health') {
      return handleHealthCheck(request, env, corsHeaders);
    }

    if (url.pathname === '/api/connections') {
      return handleConnections(request, env, corsHeaders);
    }

    if (url.pathname === '/api/queries') {
      return handleQueries(request, env, corsHeaders);
    }

    if (url.pathname === '/api/ai/chat') {
      return handleAIChat(request, env, corsHeaders);
    }

    if (url.pathname === '/api/ai/ollama') {
      return handleOllamaRequest(request, env, corsHeaders);
    }

    return new Response(JSON.stringify({
      error: 'Endpoint not found',
      available_endpoints: ['/health', '/api/connections', '/api/queries', '/api/ai/chat', '/api/ai/ollama']
    }), {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
};

async function handleHealthCheck(request, env, corsHeaders) {
  try {
    // Check D1 database connection
    const dbHealth = await env.QUERYFLUX_DB.prepare('SELECT 1 as health_check').first();

    // Check KV storage
    const kvHealth = await env.QUERYFLUX_CACHE.get('health-check');
    if (!kvHealth) {
      await env.QUERYFLUX_CACHE.put('health-check', JSON.stringify({ timestamp: Date.now() }));
    }

    const healthData = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: dbHealth ? 'connected' : 'disconnected',
      cache: kvHealth ? 'connected' : 'disconnected',
      environment: env.ENVIRONMENT || 'development',
      version: '1.0.0'
    };

    return new Response(JSON.stringify(healthData), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      status: 'unhealthy',
      error: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
}

async function handleConnections(request, env, corsHeaders) {
  if (request.method === 'GET') {
    try {
      // Get connections from D1 database
      const result = await env.QUERYFLUX_DB.prepare(`
        SELECT id, name, type, host, created_at, updated_at
        FROM connections
        ORDER BY created_at DESC
      `).all();

      return new Response(JSON.stringify({ connections: result.results }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
  }

  if (request.method === 'POST') {
    try {
      const connectionData = await request.json();

      // Validate connection data
      if (!connectionData.name || !connectionData.type || !connectionData.host) {
        return new Response(JSON.stringify({
          error: 'Missing required fields: name, type, host'
        }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }

      // Insert new connection
      const result = await env.QUERYFLUX_DB.prepare(`
        INSERT INTO connections (name, type, host, port, database, username, password, ssl, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        RETURNING *
      `).bind(
        connectionData.name,
        connectionData.type,
        connectionData.host,
        connectionData.port || 5432,
        connectionData.database || '',
        connectionData.username || '',
        connectionData.password || '',
        connectionData.ssl || false
      ).first();

      return new Response(JSON.stringify({ connection: result }), {
        status: 201,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
  }
}

async function handleQueries(request, env, corsHeaders) {
  if (request.method === 'POST') {
    try {
      const { connection_id, query, database_type } = await request.json();

      // This is where you would connect to the actual database
      // For now, we'll simulate a query result
      const queryResult = {
        id: crypto.randomUUID(),
        connection_id,
        query,
        database_type,
        executed_at: new Date().toISOString(),
        status: 'success',
        rows: [
          { id: 1, name: 'Sample Data', created_at: '2024-01-01' }
        ],
        row_count: 1,
        execution_time: Math.random() * 1000
      };

      // Cache the result in KV
      await env.QUERYFLUX_CACHE.put(
        `query:${queryResult.id}`,
        JSON.stringify(queryResult),
        { expirationTtl: 3600 } // 1 hour
      );

      return new Response(JSON.stringify({ result: queryResult }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
  }
}

async function handleAIChat(request, env, corsHeaders) {
  if (request.method === 'POST') {
    try {
      const { prompt, context } = await request.json();

      // This would integrate with OpenAI or other AI providers
      // For now, return a mock response
      const aiResponse = {
        id: crypto.randomUUID(),
        prompt,
        response: `I understand you're asking about: "${prompt}". As a database assistant, I can help you with SQL queries, database optimization, and general database management.`,
        provider: 'openai',
        model: 'gpt-4',
        created_at: new Date().toISOString(),
        context
      };

      return new Response(JSON.stringify({ response: aiResponse }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
  }
}

async function handleOllamaRequest(request, env, corsHeaders) {
  if (request.method === 'POST') {
    try {
      const { model = 'llama3', prompt, stream = false } = await request.json();

      // Check if Ollama is running and accessible
      const ollamaUrl = env.OLLAMA_URL || 'http://localhost:11434';

      try {
        const ollamaResponse = await fetch(`${ollamaUrl}/api/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            prompt: `You are a helpful database assistant. User: ${prompt}\nAssistant:`,
            stream,
            options: {
              temperature: 0.7,
              num_predict: 1000
            }
          })
        });

        if (!ollamaResponse.ok) {
          throw new Error(`Ollama API error: ${ollamaResponse.status}`);
        }

        const result = await ollamaResponse.json();

        return new Response(JSON.stringify({
          response: result.response,
          model,
          done: result.done,
          context: result.context
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      } catch (ollamaError) {
        // Fallback response if Ollama is not available
        return new Response(JSON.stringify({
          response: `I understand you're asking about database assistance: "${prompt}". I can help you with SQL queries, database design, and optimization. Please make sure Ollama is running locally for more specific assistance.`,
          model: 'fallback',
          done: true,
          error: 'Ollama not available - using fallback response'
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
  }

  if (request.method === 'GET') {
    // Get available Ollama models
    try {
      const ollamaUrl = env.OLLAMA_URL || 'http://localhost:11434';

      const ollamaResponse = await fetch(`${ollamaUrl}/api/tags`);

      if (ollamaResponse.ok) {
        const models = await ollamaResponse.json();
        return new Response(JSON.stringify({ models: models.models }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      } else {
        return new Response(JSON.stringify({
          models: [],
          error: 'Ollama not available'
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }
    } catch (error) {
      return new Response(JSON.stringify({
        models: [],
        error: error.message
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
  }
}
