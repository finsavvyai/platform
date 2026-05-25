/**
 * HTTP response helpers for the SDLC proxy worker.
 * Provides CORS, JSON responses, and standard error responses.
 */

import { getRateLimitHeaders, type RateLimitResult } from './rate-limiter';

export function getCorsHeaders(): HeadersInit {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type, Authorization, X-API-Key, X-Request-ID',
    'Access-Control-Expose-Headers':
      'X-Request-ID, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset',
    'Access-Control-Max-Age': '86400',
  };
}

export function finalizeResponse(
  response: Response,
  requestId: string,
  rateLimitResult?: RateLimitResult | null
): Response {
  let next = addCorsHeaders(response);
  next = addRequestIdHeader(next, requestId);

  if (rateLimitResult) {
    next = addRateLimitHeadersToResponse(next, rateLimitResult);
  }

  return next;
}

function addCorsHeaders(response: Response): Response {
  const next = new Response(response.body, response);
  const corsHeaders = getCorsHeaders();

  Object.entries(corsHeaders).forEach(([key, value]) => {
    next.headers.set(key, value);
  });

  return next;
}

function addRequestIdHeader(
  response: Response,
  requestId: string
): Response {
  const next = new Response(response.body, response);
  next.headers.set('X-Request-ID', requestId);
  return next;
}

function addRateLimitHeadersToResponse(
  response: Response,
  rateLimitResult: RateLimitResult
): Response {
  const next = new Response(response.body, response);
  const rateLimitHeaders = getRateLimitHeaders(rateLimitResult);

  Object.entries(rateLimitHeaders).forEach(([key, value]) => {
    next.headers.set(key, value);
  });

  return next;
}

export function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export function unauthorizedResponse(message: string): Response {
  return jsonResponse(
    { error: { code: 'unauthorized', message } },
    401
  );
}

export function badRequestResponse(message: string): Response {
  return jsonResponse(
    { error: { code: 'bad_request', message } },
    400
  );
}

export function notFoundResponse(message: string): Response {
  return jsonResponse(
    { error: { code: 'not_found', message } },
    404
  );
}

export function methodNotAllowedResponse(methods: string[]): Response {
  return new Response(
    JSON.stringify({
      error: {
        code: 'method_not_allowed',
        message: `Allowed methods: ${methods.join(', ')}`,
      },
    }),
    {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        Allow: methods.join(', '),
      },
    }
  );
}

export function errorResponse(message: string): Response {
  return jsonResponse(
    { error: { code: 'internal_error', message } },
    500
  );
}

export async function readJsonBody<T>(request: Request): Promise<T> {
  try {
    const body = (await request.clone().json()) as unknown;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new Error('Request body must be a JSON object');
    }

    return body as T;
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : 'Request body must be valid JSON'
    );
  }
}
