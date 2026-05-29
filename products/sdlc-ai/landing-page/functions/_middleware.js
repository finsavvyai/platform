import { NextResponse } from 'next/server';

export async function middleware(request) {
  const url = request.nextUrl;

  // Add security headers
  const response = NextResponse.next();

  // Security headers
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  // Analytics tracking
  if (process.env.NODE_ENV === 'production') {
    // Track page views in Cloudflare Analytics Engine
    const analyticsData = {
      path: url.pathname,
      referrer: request.headers.get('referer') || '',
      userAgent: request.headers.get('user-agent') || '',
      timestamp: new Date().toISOString(),
      method: request.method,
      ip: request.ip || request.headers.get('x-forwarded-for') || '',
    };

    // Store in KV for analytics processing
    try {
      if (typeof env !== 'undefined' && env.ANALYTICS_KV) {
        await env.ANALYTICS_KV.put(
          `analytics:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`,
          JSON.stringify(analyticsData),
          { expirationTtl: 86400 * 30 } // 30 days
        );
      }
    } catch (error) {
      console.error('Analytics tracking failed:', error);
    }
  }

  // Handle API routes with rate limiting
  if (url.pathname.startsWith('/api/')) {
    const clientId = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
    const rateLimitKey = `rate_limit:${clientId}:${url.pathname}`;

    try {
      if (typeof env !== 'undefined' && env.CACHE_KV) {
        const current = await env.CACHE_KV.get(rateLimitKey);
        const count = current ? parseInt(current) : 0;

        if (count > 100) { // 100 requests per minute per IP
          return new Response('Too Many Requests', {
            status: 429,
            headers: {
              'Retry-After': '60',
              'X-RateLimit-Limit': '100',
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': new Date(Date.now() + 60000).toISOString(),
            },
          });
        }

        // Increment counter
        await env.CACHE_KV.put(rateLimitKey, (count + 1).toString(), {
          expirationTtl: 60, // 1 minute
        });

        // Add rate limit headers
        response.headers.set('X-RateLimit-Limit', '100');
        response.headers.set('X-RateLimit-Remaining', Math.max(0, 99 - count).toString());
        response.headers.set('X-RateLimit-Reset', new Date(Date.now() + 60000).toISOString());
      }
    } catch (error) {
      console.error('Rate limiting failed:', error);
    }
  }

  // CORS handling for API routes
  if (url.pathname.startsWith('/api/')) {
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    response.headers.set('Access-Control-Max-Age', '86400');
  }

  // Cache static assets
  if (url.pathname.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
    response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  }

  // Cache pages for short time
  if (url.pathname === '/' || url.pathname === '/pricing') {
    response.headers.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api (API routes handled separately)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};