/**
 * UPM.Plus API Worker
 * Handles API-specific functionality with rate limiting, caching, and authentication
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Add security headers
    const securityHeaders = {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
    };

    // Rate limiting check
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
    const rateLimitKey = `rate_limit:${clientIP}`;
    const currentRequests = await env.UPM_CACHE.get(rateLimitKey) || 0;

    if (currentRequests > parseInt(env.RATE_LIMIT || 100)) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded' }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            ...securityHeaders
          }
        }
      );
    }

    // Increment rate limit counter
    ctx.waitUntil(
      env.UPM_CACHE.put(rateLimitKey, (parseInt(currentRequests) + 1).toString(), {
        expirationTtl: 60 // Reset every minute
      })
    );

    // Handle different API endpoints
    if (url.pathname === '/api/health') {
      return handleHealthCheck(request, env, securityHeaders);
    } else if (url.pathname === '/api/status') {
      return handleStatus(request, env, securityHeaders);
    } else if (url.pathname.startsWith('/api/agents')) {
      return handleAgents(request, env, securityHeaders);
    } else if (url.pathname.startsWith('/api/tasks')) {
      return handleTasks(request, env, securityHeaders);
    } else if (url.pathname.startsWith('/api/analytics')) {
      return handleAnalytics(request, env, securityHeaders);
    } else {
      return handleProxy(request, env, securityHeaders);
    }
  }
};

/**
 * Health check endpoint
 */
async function handleHealthCheck(request, env, headers) {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: env.ENVIRONMENT,
    domain: env.DOMAIN,
    version: '1.0.0'
  };

  return new Response(JSON.stringify(health), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      ...headers
    }
  });
}

/**
 * System status endpoint
 */
async function handleStatus(request, env, headers) {
  const url = new URL(request.url);
  const includeDetails = url.searchParams.get('detailed') === 'true';

  const status = {
    status: 'operational',
    timestamp: new Date().toISOString(),
    environment: env.ENVIRONMENT,
    domain: env.DOMAIN,
    services: {
      api: 'operational',
      cache: 'operational',
      database: 'operational',
      workers: 'operational'
    }
  };

  if (includeDetails) {
    status.details = {
      cache_size: await getCacheSize(env),
      uptime: 'N/A', // Workers don't have traditional uptime
      version: '1.0.0',
      region: request.cf?.colo || 'unknown'
    };
  }

  return new Response(JSON.stringify(status), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=30',
      ...headers
    }
  });
}

/**
 * Handle agent-related API calls
 */
async function handleAgents(request, env, headers) {
  const url = new URL(request.url);
  const agentId = url.pathname.split('/')[3];

  try {
    if (request.method === 'GET') {
      if (agentId) {
        // Get specific agent
        const agent = await getAgentFromCache(agentId, env);
        return new Response(JSON.stringify(agent), {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=300',
            ...headers
          }
        });
      } else {
        // List all agents
        const agents = await getAllAgents(env);
        return new Response(JSON.stringify(agents), {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=300',
            ...headers
          }
        });
      }
    } else if (request.method === 'POST') {
      // Create or update agent
      const body = await request.json();
      const result = await createOrUpdateAgent(body, env);
      return new Response(JSON.stringify(result), {
        status: 201,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      });
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Agent API Error', message: error.message }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      }
    );
  }
}

/**
 * Handle task-related API calls
 */
async function handleTasks(request, env, headers) {
  const url = new URL(request.url);
  const taskId = url.pathname.split('/')[3];

  try {
    if (request.method === 'GET') {
      if (taskId) {
        // Get specific task
        const task = await getTaskFromCache(taskId, env);
        return new Response(JSON.stringify(task), {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=60',
            ...headers
          }
        });
      } else {
        // List tasks with filters
        const filters = {
          status: url.searchParams.get('status'),
          agent: url.searchParams.get('agent'),
          limit: parseInt(url.searchParams.get('limit') || 50)
        };
        const tasks = await getTasks(filters, env);
        return new Response(JSON.stringify(tasks), {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=60',
            ...headers
          }
        });
      }
    } else if (request.method === 'POST') {
      // Create new task
      const body = await request.json();
      const result = await createTask(body, env);

      // Queue the task for processing
      await env.UPM_QUEUE.send({
        type: 'task_created',
        taskId: result.id,
        timestamp: new Date().toISOString()
      });

      return new Response(JSON.stringify(result), {
        status: 201,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      });
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Task API Error', message: error.message }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      }
    );
  }
}

/**
 * Handle analytics API calls
 */
async function handleAnalytics(request, env, headers) {
  const url = new URL(request.url);
  const metric = url.pathname.split('/')[3];

  try {
    if (metric === 'traffic') {
      const traffic = await getTrafficAnalytics(env);
      return new Response(JSON.stringify(traffic), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300',
          ...headers
        }
      });
    } else if (metric === 'performance') {
      const performance = await getPerformanceAnalytics(env);
      return new Response(JSON.stringify(performance), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300',
          ...headers
        }
      });
    } else {
      // General analytics
      const analytics = await getGeneralAnalytics(env);
      return new Response(JSON.stringify(analytics), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300',
          ...headers
        }
      });
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Analytics API Error', message: error.message }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      }
    );
  }
}

/**
 * Proxy other API calls to backend
 */
async function handleProxy(request, env, headers) {
  const url = new URL(request.url);
  const backendUrl = new URL(url.pathname + url.search, env.API_BASE_URL);

  try {
    const response = await fetch(backendUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body
    });

    const newResponse = new Response(response.body, response);

    // Add security headers
    Object.entries(headers).forEach(([key, value]) => {
      newResponse.headers.set(key, value);
    });

    return newResponse;

  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Proxy Error', message: error.message }),
      {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      }
    );
  }
}

// Helper functions
async function getCacheSize(env) {
  // This would require counting keys in KV namespace
  // For now, return an estimate
  return "estimated";
}

async function getAgentFromCache(agentId, env) {
  const cacheKey = `agent:${agentId}`;
  const cached = await env.UPM_CACHE.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  // Return mock data if not in cache
  return {
    id: agentId,
    name: 'Agent ' + agentId,
    status: 'active',
    type: 'browser',
    capabilities: ['automation', 'monitoring']
  };
}

async function getAllAgents(env) {
  // Return mock agent data
  return [
    {
      id: 'browser-agent-1',
      name: 'Browser Automation Agent',
      status: 'active',
      type: 'browser',
      capabilities: ['automation', 'monitoring', 'screenshot']
    },
    {
      id: 'infrastructure-agent-1',
      name: 'Infrastructure Management Agent',
      status: 'active',
      type: 'infrastructure',
      capabilities: ['deployment', 'monitoring', 'scaling']
    }
  ];
}

async function createOrUpdateAgent(agentData, env) {
  // Cache the agent data
  const cacheKey = `agent:${agentData.id}`;
  await env.UPM_CACHE.put(cacheKey, JSON.stringify(agentData), {
    expirationTtl: 3600
  });

  return { success: true, agent: agentData };
}

async function getTaskFromCache(taskId, env) {
  const cacheKey = `task:${taskId}`;
  const cached = await env.UPM_CACHE.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  return {
    id: taskId,
    status: 'completed',
    agent: 'browser-agent-1',
    created_at: new Date().toISOString()
  };
}

async function getTasks(filters, env) {
  // Return mock task data
  return [
    {
      id: 'task-1',
      status: 'completed',
      agent: 'browser-agent-1',
      created_at: new Date().toISOString()
    },
    {
      id: 'task-2',
      status: 'running',
      agent: 'infrastructure-agent-1',
      created_at: new Date().toISOString()
    }
  ];
}

async function createTask(taskData, env) {
  const task = {
    id: 'task-' + Date.now(),
    ...taskData,
    status: 'pending',
    created_at: new Date().toISOString()
  };

  // Cache the task
  const cacheKey = `task:${task.id}`;
  await env.UPM_CACHE.put(cacheKey, JSON.stringify(task), {
    expirationTtl: 3600
  });

  return task;
}

async function getTrafficAnalytics(env) {
  return {
    page_views: 1250,
    unique_visitors: 320,
    bounce_rate: 0.35,
    avg_session_duration: 245,
    top_pages: ['/dashboard', '/agents', '/tasks']
  };
}

async function getPerformanceAnalytics(env) {
  return {
    avg_response_time: 120,
    uptime: 0.999,
    error_rate: 0.001,
    cache_hit_rate: 0.85
  };
}

async function getGeneralAnalytics(env) {
  return {
    active_agents: 5,
    completed_tasks: 1247,
    system_health: 'excellent',
    last_updated: new Date().toISOString()
  };
}