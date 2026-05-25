/**
 * Rate limiting middleware for Cloudflare Workers
 */

export async function rateLimitMiddleware(request, env) {
  if (!env?.CACHE?.get || !env?.CACHE?.put) {
    console.warn('Rate limit skipped: CACHE binding not configured');
    return null;
  }

  const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
  const url = new URL(request.url);

  // Rate limit by IP and endpoint
  const key = `rate_limit:${clientIP}:${url.pathname}`;
  const currentCount = await env.CACHE.get(key);
  const limit = getRateLimitForEndpoint(url.pathname);

  if (currentCount && parseInt(currentCount) >= limit) {
    return new Response(JSON.stringify({
      error: 'Rate limit exceeded',
      message: 'Too many requests',
      retryAfter: 60
    }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': '60',
        'X-RateLimit-Limit': limit.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': (Math.floor(Date.now() / 1000) + 60).toString(),
        ...corsHeaders()
      }
    });
  }

  // Increment counter
  const newCount = currentCount ? parseInt(currentCount) + 1 : 1;
  await env.CACHE.put(key, newCount.toString(), { expirationTtl: 60 });

  // Track rate limit metadata for response headers
  request._rateLimit = {
    limit,
    remaining: Math.max(limit - newCount, 0),
    reset: Math.floor(Date.now() / 1000) + 60
  };

  return null;
}

function getRateLimitForEndpoint(pathname) {
  // Different rate limits for different endpoints
  if (pathname.includes('/auth/')) return 10;  // Lower limit for auth
  if (pathname.includes('/api/')) return 1000;  // Higher limit for API
  if (pathname.includes('/analytics/')) return 500;  // Medium limit for analytics
  return 100;  // Default limit
}

export { corsHeaders } from '../utils/cors.js';
