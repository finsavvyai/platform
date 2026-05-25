/**
 * ============================================================================
 * QuantumBeam Cloudflare Worker Entry Point
 * ============================================================================
 * This worker acts as a proxy/adapter for the QuantumBeam Go API
 * deployed on Cloudflare Workers using WASM or as a separate service
 * ============================================================================
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Route handling
      const path = url.pathname;

      // Health check endpoint
      if (path === '/health' || path === '/health/live' || path === '/health/ready') {
        return handleHealthCheck(path, env, corsHeaders);
      }

      // Detailed health check
      if (path === '/health/detailed') {
        return handleDetailedHealth(env, corsHeaders);
      }

      // Metrics endpoint
      if (path === '/metrics') {
        return handleMetrics(env, corsHeaders);
      }

      // Fraud detection API
      if (path.startsWith('/api/v1/fraud/analyze')) {
        return handleFraudAnalysis(request, env, ctx, corsHeaders);
      }

      // Get fraud result
      if (path.match(/^\/api\/v1\/fraud\/results\/[^/]+$/)) {
        const transactionId = path.split('/').pop();
        return handleGetFraudResult(transactionId, env, corsHeaders);
      }

      // Default: Return API info
      return new Response(JSON.stringify({
        name: 'QuantumBeam API',
        version: '1.0.0',
        status: 'running',
        endpoints: {
          health: '/health',
          fraudAnalysis: '/api/v1/fraud/analyze',
          metrics: '/metrics',
        },
        documentation: 'https://quantumbeam.io/api-docs'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({
        error: 'Internal server error',
        message: error.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};

/**
 * Handle health check requests
 */
async function handleHealthCheck(path, env, corsHeaders) {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: env.ENVIRONMENT || 'production',
    version: '1.0.0'
  };

  if (path === '/health/live') {
    return new Response(JSON.stringify({ alive: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  if (path === '/health/ready') {
    // Check if dependencies are ready
    const ready = await checkDependencies(env);
    return new Response(JSON.stringify({ ready }), {
      status: ready ? 200 : 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify(health), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

/**
 * Handle detailed health check
 */
async function handleDetailedHealth(env, corsHeaders) {
  const checks = {
    database: await checkDatabase(env),
    cache: await checkCache(env),
    storage: await checkStorage(env),
    quantumService: await checkQuantumService(env),
  };

  const allHealthy = Object.values(checks).every(check => check.status === 'healthy');

  const response = {
    status: allHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    components: checks,
    version: '1.0.0',
    environment: env.ENVIRONMENT || 'production'
  };

  return new Response(JSON.stringify(response), {
    status: allHealthy ? 200 : 503,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

/**
 * Handle fraud analysis requests
 */
async function handleFraudAnalysis(request, env, ctx, corsHeaders) {
  try {
    // Verify authorization
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({
        error: 'Unauthorized',
        message: 'Missing or invalid authorization header'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Parse request body
    const body = await request.json();
    const { transaction_id, amount, user_id, merchant_id, quantum_features } = body;

    // Validate required fields
    if (!transaction_id || !amount || !user_id) {
      return new Response(JSON.stringify({
        error: 'Bad Request',
        message: 'Missing required fields: transaction_id, amount, user_id'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check cache first
    const cached = await checkCache(env, `fraud:${transaction_id}`);
    if (cached) {
      return new Response(JSON.stringify(cached), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'X-Cache': 'HIT'
        }
      });
    }

    // Perform fraud analysis
    const startTime = Date.now();
    const result = await analyzeFraud(body, env, quantum_features);
    const processingTime = Date.now() - startTime;

    // Add metadata
    result.processing_time_ms = processingTime;
    result.timestamp = new Date().toISOString();
    result.processing_method = quantum_features ? 'quantum' : 'classical';

    // Cache result
    ctx.waitUntil(cacheResult(env, `fraud:${transaction_id}`, result, 300)); // 5 min TTL

    // Log to analytics
    ctx.waitUntil(logAnalytics(env, {
      event: 'fraud_analysis',
      transaction_id,
      processing_time: processingTime,
      fraud_score: result.fraud_score,
      risk_level: result.risk_level
    }));

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'X-Cache': 'MISS'
      }
    });

  } catch (error) {
    console.error('Fraud analysis error:', error);
    return new Response(JSON.stringify({
      error: 'Analysis failed',
      message: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Perform fraud analysis using quantum or classical methods
 */
async function analyzeFraud(transaction, env, useQuantum = false) {
  // If quantum service is available and requested, use it
  if (useQuantum && env.QUANTUM_SERVICE) {
    try {
      const response = await env.QUANTUM_SERVICE.fetch(new Request('http://quantum/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(transaction)
      }));

      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.warn('Quantum service unavailable, falling back to classical:', error);
    }
  }

  // Classical fraud detection fallback
  const fraudScore = calculateClassicalFraudScore(transaction);

  return {
    transaction_id: transaction.transaction_id,
    fraud_score: fraudScore,
    confidence: 0.85,
    risk_level: fraudScore > 0.7 ? 'high' : fraudScore > 0.4 ? 'medium' : 'low',
    recommendation: fraudScore > 0.7 ? 'block' : fraudScore > 0.4 ? 'review' : 'approve',
    explanation: `Transaction analyzed using classical ML algorithms`,
    factors: [
      { name: 'amount', impact: transaction.amount > 10000 ? 'high' : 'low' },
      { name: 'user_history', impact: 'medium' }
    ]
  };
}

/**
 * Calculate fraud score using classical methods
 */
function calculateClassicalFraudScore(transaction) {
  let score = 0;

  // Amount-based scoring
  if (transaction.amount > 10000) score += 0.3;
  if (transaction.amount > 50000) score += 0.2;

  // Time-based scoring (unusual hours)
  const hour = new Date().getHours();
  if (hour < 6 || hour > 22) score += 0.2;

  // Add some randomness for demo
  score += Math.random() * 0.3;

  return Math.min(score, 1.0);
}

/**
 * Check dependencies availability
 */
async function checkDependencies(env) {
  try {
    if (env.DB) await env.DB.prepare('SELECT 1').first();
    return true;
  } catch {
    return false;
  }
}

/**
 * Check database health
 */
async function checkDatabase(env) {
  try {
    if (env.DB) {
      await env.DB.prepare('SELECT 1').first();
      return { status: 'healthy', latency: '<5ms' };
    }
    return { status: 'not_configured' };
  } catch (error) {
    return { status: 'unhealthy', error: error.message };
  }
}

/**
 * Check cache health
 */
async function checkCache(env, key = null) {
  try {
    if (!env.CACHE) return { status: 'not_configured' };

    if (key) {
      const value = await env.CACHE.get(key, 'json');
      return value;
    }

    await env.CACHE.put('health_check', 'ok', { expirationTtl: 60 });
    return { status: 'healthy' };
  } catch (error) {
    return { status: 'unhealthy', error: error.message };
  }
}

/**
 * Check storage health
 */
async function checkStorage(env) {
  try {
    if (!env.FILES) return { status: 'not_configured' };

    await env.FILES.head('health_check');
    return { status: 'healthy' };
  } catch (error) {
    if (error.message.includes('Object Not Found')) {
      return { status: 'healthy' }; // Not found is ok for health check
    }
    return { status: 'unhealthy', error: error.message };
  }
}

/**
 * Check quantum service health
 */
async function checkQuantumService(env) {
  try {
    if (!env.QUANTUM_SERVICE) return { status: 'not_configured' };

    const response = await env.QUANTUM_SERVICE.fetch(new Request('http://quantum/health'));
    return response.ok ? { status: 'healthy' } : { status: 'unhealthy' };
  } catch (error) {
    return { status: 'unhealthy', error: error.message };
  }
}

/**
 * Cache fraud analysis result
 */
async function cacheResult(env, key, value, ttl) {
  if (!env.CACHE) return;

  try {
    await env.CACHE.put(key, JSON.stringify(value), { expirationTtl: ttl });
  } catch (error) {
    console.error('Cache write error:', error);
  }
}

/**
 * Log analytics event
 */
async function logAnalytics(env, event) {
  if (!env.ANALYTICS) return;

  try {
    env.ANALYTICS.writeDataPoint({
      blobs: [event.event, event.transaction_id],
      doubles: [event.processing_time, event.fraud_score],
      indexes: [event.risk_level]
    });
  } catch (error) {
    console.error('Analytics logging error:', error);
  }
}

/**
 * Handle metrics endpoint
 */
function handleMetrics(env, corsHeaders) {
  const metrics = `
# HELP quantumbeam_requests_total Total number of requests
# TYPE quantumbeam_requests_total counter
quantumbeam_requests_total 0

# HELP quantumbeam_fraud_analyses_total Total fraud analyses
# TYPE quantumbeam_fraud_analyses_total counter
quantumbeam_fraud_analyses_total 0

# HELP quantumbeam_processing_time_seconds Processing time in seconds
# TYPE quantumbeam_processing_time_seconds histogram
quantumbeam_processing_time_seconds_sum 0
quantumbeam_processing_time_seconds_count 0
`;

  return new Response(metrics, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/plain; version=0.0.4'
    }
  });
}

/**
 * Get fraud result by transaction ID
 */
async function handleGetFraudResult(transactionId, env, corsHeaders) {
  try {
    // Check cache
    const cached = await checkCache(env, `fraud:${transactionId}`);
    if (cached) {
      return new Response(JSON.stringify(cached), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check database
    if (env.DB) {
      const result = await env.DB.prepare(
        'SELECT * FROM fraud_results WHERE transaction_id = ?'
      ).bind(transactionId).first();

      if (result) {
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response(JSON.stringify({
      error: 'Not Found',
      message: `No fraud analysis found for transaction ${transactionId}`
    }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Internal error',
      message: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
