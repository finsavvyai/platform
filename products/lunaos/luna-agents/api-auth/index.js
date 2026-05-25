/**
 * Luna Agents API Key Authentication Service
 * Cloudflare Worker for validating API keys and managing subscriptions
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Route handlers
      if (path === '/validate' && request.method === 'POST') {
        return await handleValidate(request, env, corsHeaders);
      }
      
      if (path === '/usage' && request.method === 'GET') {
        return await handleUsage(request, env, corsHeaders);
      }
      
      if (path === '/generate' && request.method === 'POST') {
        return await handleGenerate(request, env, corsHeaders);
      }

      return new Response('Not Found', { status: 404, headers: corsHeaders });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
};

/**
 * Validate API key and check subscription status
 */
async function handleValidate(request, env, corsHeaders) {
  const { apiKey } = await request.json();

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API key required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Get key data from KV
  const keyData = await env.API_KEYS.get(apiKey, { type: 'json' });

  if (!keyData) {
    return new Response(JSON.stringify({ 
      valid: false, 
      error: 'Invalid API key' 
    }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Check if subscription is active
  const now = Date.now();
  const isActive = keyData.subscriptionStatus === 'active' && 
                   (!keyData.expiresAt || keyData.expiresAt > now);

  if (!isActive) {
    return new Response(JSON.stringify({ 
      valid: false, 
      error: 'Subscription expired or inactive',
      subscriptionStatus: keyData.subscriptionStatus
    }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Check rate limits
  const usage = await checkRateLimit(env, apiKey, keyData);

  return new Response(JSON.stringify({
    valid: true,
    tier: keyData.tier,
    customerId: keyData.customerId,
    usage: usage,
    features: {
      lunaVisionRAG: keyData.tier === 'pro' || keyData.tier === 'enterprise',
      unlimitedIndexing: keyData.tier === 'pro' || keyData.tier === 'enterprise',
      unlimitedQueries: keyData.tier === 'pro' || keyData.tier === 'enterprise',
      prioritySupport: keyData.tier === 'pro' || keyData.tier === 'enterprise',
    }
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Get usage statistics for an API key
 */
async function handleUsage(request, env, corsHeaders) {
  const apiKey = request.headers.get('Authorization')?.replace('Bearer ', '');

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API key required' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const keyData = await env.API_KEYS.get(apiKey, { type: 'json' });

  if (!keyData) {
    return new Response(JSON.stringify({ error: 'Invalid API key' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Get usage stats from KV
  const today = new Date().toISOString().split('T')[0];
  const usageKey = `usage:${apiKey}:${today}`;
  const usage = await env.API_KEYS.get(usageKey, { type: 'json' }) || {
    queries: 0,
    filesIndexed: 0,
    screenshotsAnalyzed: 0,
  };

  return new Response(JSON.stringify({
    tier: keyData.tier,
    usage: usage,
    limits: getLimitsForTier(keyData.tier),
    resetDate: new Date(new Date().setHours(24, 0, 0, 0)).toISOString(),
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Generate new API key (called by webhook after subscription)
 */
async function handleGenerate(request, env, corsHeaders) {
  const authHeader = request.headers.get('Authorization');
  
  // Verify webhook secret
  if (authHeader !== `Bearer ${env.WEBHOOK_SECRET}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { customerId, email, tier, subscriptionId } = await request.json();

  // Generate API key
  const apiKey = `luna_${generateRandomString(32)}`;

  // Store in KV
  await env.API_KEYS.put(apiKey, JSON.stringify({
    customerId,
    email,
    tier,
    subscriptionId,
    subscriptionStatus: 'active',
    createdAt: Date.now(),
    expiresAt: null, // null for active subscriptions
  }));

  return new Response(JSON.stringify({
    apiKey,
    tier,
    customerId,
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Check and update rate limits
 */
async function checkRateLimit(env, apiKey, keyData) {
  const today = new Date().toISOString().split('T')[0];
  const usageKey = `usage:${apiKey}:${today}`;
  
  const usage = await env.API_KEYS.get(usageKey, { type: 'json' }) || {
    queries: 0,
    filesIndexed: 0,
    screenshotsAnalyzed: 0,
  };

  const limits = getLimitsForTier(keyData.tier);

  return {
    queries: {
      used: usage.queries,
      limit: limits.queries,
      remaining: limits.queries === -1 ? -1 : Math.max(0, limits.queries - usage.queries),
    },
    filesIndexed: {
      used: usage.filesIndexed,
      limit: limits.filesIndexed,
      remaining: limits.filesIndexed === -1 ? -1 : Math.max(0, limits.filesIndexed - usage.filesIndexed),
    },
  };
}

/**
 * Get limits based on tier
 */
function getLimitsForTier(tier) {
  const limits = {
    free: {
      queries: 100,
      filesIndexed: 1000,
      screenshotsAnalyzed: 0,
    },
    pro: {
      queries: -1, // unlimited
      filesIndexed: -1, // unlimited
      screenshotsAnalyzed: -1, // unlimited
    },
    enterprise: {
      queries: -1,
      filesIndexed: -1,
      screenshotsAnalyzed: -1,
    },
  };

  return limits[tier] || limits.free;
}

/**
 * Generate random string for API keys
 */
function generateRandomString(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  
  for (let i = 0; i < length; i++) {
    result += chars[randomValues[i] % chars.length];
  }
  
  return result;
}
