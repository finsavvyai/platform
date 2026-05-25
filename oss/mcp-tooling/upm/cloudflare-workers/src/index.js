/**
 * UPM API Gateway - Cloudflare Worker
 *
 * This worker serves as the API gateway for the Universal Dependency Platform,
 * providing edge caching, rate limiting, authentication, and request routing.
 *
 * Features:
 * - Edge caching for dependency metadata
 * - Rate limiting per user/IP
 * - JWT authentication
 * - Request routing to backend services
 * - CORS handling
 * - Request/response transformation
 * - Error handling and logging
 */

import { Router } from "itty-router";
import { parse } from "cookie";

// Create router
const router = Router();

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Requested-With",
  "Access-Control-Max-Age": "86400",
};

// Health check endpoint
router.get("/health", () => {
  return new Response(
    JSON.stringify({
      status: "healthy",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
      environment: ENVIRONMENT,
    }),
    {
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    },
  );
});

// API versioning
router.all("/api/v1/*", handleAPIRequest);

// Static asset routing for web UI
router.get("*", serveStaticAssets);

// Main request handler
export default {
  async fetch(request, env, ctx) {
    try {
      // Add request ID for tracing
      const requestId = crypto.randomUUID();
      request.headers.set("X-Request-ID", requestId);

      // Log request start
      console.log(`[${requestId}] ${request.method} ${request.url}`);

      // Handle CORS preflight
      if (request.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
      }

      // Apply rate limiting
      const rateLimitResult = await applyRateLimit(request, env);
      if (!rateLimitResult.allowed) {
        return new Response(
          JSON.stringify({
            error: "Rate limit exceeded",
            retryAfter: rateLimitResult.retryAfter,
          }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "Retry-After": rateLimitResult.retryAfter.toString(),
              ...corsHeaders,
            },
          },
        );
      }

      // Route request
      const response = await router.handle(request, env, ctx);

      // Add security headers
      response.headers.set("X-Content-Type-Options", "nosniff");
      response.headers.set("X-Frame-Options", "DENY");
      response.headers.set("X-XSS-Protection", "1; mode=block");
      response.headers.set(
        "Referrer-Policy",
        "strict-origin-when-cross-origin",
      );
      response.headers.set("X-Request-ID", requestId);

      return response;
    } catch (error) {
      console.error("Request handling error:", error);
      return new Response(
        JSON.stringify({
          error: "Internal server error",
          requestId: request.headers.get("X-Request-ID"),
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        },
      );
    }
  },
};

/**
 * Handle API requests with authentication and caching
 */
async function handleAPIRequest(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname.replace("/api/v1", "");

  // Extract token from Authorization header or cookie
  const token = extractAuthToken(request);
  if (!token && requiresAuthentication(path)) {
    return new Response(
      JSON.stringify({
        error: "Authentication required",
      }),
      {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      },
    );
  }

  // Validate JWT token
  if (token && requiresAuthentication(path)) {
    const payload = await validateJWT(token, env);
    if (!payload) {
      return new Response(
        JSON.stringify({
          error: "Invalid or expired token",
        }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        },
      );
    }

    // Add user context to request
    request.user = payload;
  }

  // Check cache for GET requests
  if (request.method === "GET") {
    const cacheKey = new Request(request.url, request);
    const cached = await caches.default.match(cacheKey);
    if (cached) {
      console.log(`Cache hit: ${request.url}`);
      return new Response(cached.body, cached);
    }
  }

  // Route to backend service
  return await routeToBackend(request, env, path);
}

/**
 * Route request to appropriate backend service
 */
async function routeToBackend(request, env, path) {
  const backendUrl = env.UPM_BACKEND_URL || "https://api.upm.plus.internal";
  const targetUrl = `${backendUrl}/api/v1${path}${new URL(request.url).search}`;

  // Create new request with modified headers
  const headers = new Headers(request.headers);
  headers.delete("Host"); // Remove original host header

  // Add user context if authenticated
  if (request.user) {
    headers.set("X-User-ID", request.user.sub);
    headers.set("X-User-Email", request.user.email);
    headers.set("X-User-Role", request.user.role);
  }

  const backendRequest = new Request(targetUrl, {
    method: request.method,
    headers: headers,
    body: request.body,
    redirect: "manual",
  });

  try {
    const response = await fetch(backendRequest);

    // Transform response if needed
    const transformedResponse = await transformResponse(response, request, env);

    // Cache GET responses
    if (request.method === "GET" && response.ok) {
      const cacheKey = new Request(request.url, request);
      const cacheResponse = new Response(transformedResponse.body, {
        status: transformedResponse.status,
        statusText: transformedResponse.statusText,
        headers: transformedResponse.headers,
      });

      ctx.waitUntil(caches.default.put(cacheKey, cacheResponse.clone()));
    }

    return transformedResponse;
  } catch (error) {
    console.error("Backend request failed:", error);
    return new Response(
      JSON.stringify({
        error: "Backend service unavailable",
        message: "The UPM backend service is temporarily unavailable",
      }),
      {
        status: 503,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      },
    );
  }
}

/**
 * Transform backend response
 */
async function transformResponse(response, request, env) {
  const headers = new Headers(response.headers);

  // Add CORS headers
  Object.entries(corsHeaders).forEach(([key, value]) => {
    headers.set(key, value);
  });

  // Handle different content types
  const contentType = headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    let data = await response.json();

    // Transform data if needed
    data = await transformJSONData(data, request, env);

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: headers,
    });
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: headers,
  });
}

/**
 * Transform JSON response data
 */
async function transformJSONData(data, request, env) {
  // Add caching metadata for dependency data
  if (
    request.url.includes("/dependencies") ||
    request.url.includes("/vulnerabilities")
  ) {
    data.cachedAt = new Date().toISOString();
    data.cacheTTL = parseInt(env.CACHE_TTL || "3600");
  }

  // Add rate limit information
  data.rateLimit = {
    limit: parseInt(env.RATE_LIMIT || "1000"),
    remaining: 999, // This would come from actual rate limiting logic
    reset: new Date(Date.now() + 60000).toISOString(),
  };

  return data;
}

/**
 * Serve static assets for web UI
 */
async function serveStaticAssets(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;

  // Serve static files from R2 storage
  if (path.startsWith("/static/") || path.startsWith("/assets/")) {
    try {
      const objectKey = path.substring(1); // Remove leading slash
      const object = await env.UPM_STORAGE.get(objectKey);

      if (object) {
        const headers = new Headers();
        headers.set("Content-Type", getContentType(objectKey));
        headers.set("Cache-Control", "public, max-age=31536000"); // 1 year

        return new Response(object.body, { headers });
      }
    } catch (error) {
      console.error("Error serving static asset:", error);
    }
  }

  // Serve index.html for SPA routes
  if (
    path === "/" ||
    path.startsWith("/dashboard") ||
    path.startsWith("/projects")
  ) {
    try {
      const indexHtml = await env.UPM_STORAGE.get("index.html");
      if (indexHtml) {
        return new Response(indexHtml.body, {
          headers: {
            "Content-Type": "text/html",
            "Cache-Control": "no-cache",
            ...corsHeaders,
          },
        });
      }
    } catch (error) {
      console.error("Error serving index.html:", error);
    }
  }

  return new Response("Not found", { status: 404 });
}

/**
 * Extract authentication token from request
 */
function extractAuthToken(request) {
  // Try Authorization header first
  const authHeader = request.headers.get("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }

  // Try cookie
  const cookieHeader = request.headers.get("Cookie");
  if (cookieHeader) {
    const cookies = parse(cookieHeader);
    return cookies.upm_token;
  }

  return null;
}

/**
 * Check if path requires authentication
 */
function requiresAuthentication(path) {
  const publicPaths = [
    "/health",
    "/auth/login",
    "/auth/register",
    "/auth/refresh",
    "/docs",
    "/public",
  ];

  return !publicPaths.some((publicPath) => path.startsWith(publicPath));
}

/**
 * Validate JWT token
 */
async function validateJWT(token, env) {
  try {
    // Import JWT validation library
    const { jwtVerify } = await import("jose");

    const secret = new TextEncoder().encode(env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);

    return payload;
  } catch (error) {
    console.error("JWT validation error:", error);
    return null;
  }
}

/**
 * Apply rate limiting
 */
async function applyRateLimit(request, env) {
  const clientId = getClientId(request);
  const key = `rate_limit:${clientId}`;

  // Use KV for rate limiting
  const { value: current, metadata } = await env.UPM_CACHE.getWithMetadata(key);
  const limit = parseInt(env.RATE_LIMIT || "1000");

  if (!current) {
    // First request
    await env.UPM_CACHE.put(key, "1", {
      expirationTtl: 60, // 1 minute
    });

    return { allowed: true, remaining: limit - 1 };
  }

  const count = parseInt(current);

  if (count >= limit) {
    return {
      allowed: false,
      retryAfter: Math.ceil((metadata.expiration * 1000 - Date.now()) / 1000),
    };
  }

  // Increment counter
  await env.UPM_CACHE.put(key, (count + 1).toString(), {
    expirationTtl: 60,
  });

  return { allowed: true, remaining: limit - count - 1 };
}

/**
 * Get client ID for rate limiting
 */
function getClientId(request) {
  // Try user ID first (if authenticated)
  if (request.user && request.user.sub) {
    return `user:${request.user.sub}`;
  }

  // Fall back to IP address
  return `ip:${request.headers.get("CF-Connecting-IP") || "unknown"}`;
}

/**
 * Get content type based on file extension
 */
function getContentType(filename) {
  const extension = filename.split(".").pop().toLowerCase();

  const contentTypes = {
    html: "text/html",
    css: "text/css",
    js: "application/javascript",
    json: "application/json",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    svg: "image/svg+xml",
    ico: "image/x-icon",
    woff: "font/woff",
    woff2: "font/woff2",
    ttf: "font/ttf",
    eot: "application/vnd.ms-fontobject",
  };

  return contentTypes[extension] || "application/octet-stream";
}
