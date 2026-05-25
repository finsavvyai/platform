/**
 * Authentication middleware for Cloudflare Workers
 */

import { corsHeaders } from '../utils/cors.js';
import { verifyJWT } from '../utils/jwt.js';

export async function authMiddleware(request, env) {
  const url = new URL(request.url);

  // Skip auth for public routes
  const publicRoutes = ['/health', '/api/v1/auth/login', '/api/v1/auth/register'];
  if (publicRoutes.some(route => url.pathname.startsWith(route))) {
    return null;
  }

  // Skip auth for WebSocket connections
  if (url.pathname === '/ws') {
    return null;
  }

  // Check for Authorization header
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({
      error: 'Unauthorized',
      message: 'Missing Authorization header'
    }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders()
      }
    });
  }

  try {
    // Validate JWT token
    const token = authHeader.replace('Bearer ', '');
    const payload = await verifyJWT(token, env?.JWT_SECRET);

    if (!payload) {
      return new Response(JSON.stringify({
        error: 'Unauthorized',
        message: 'Invalid token'
      }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders()
        }
      });
    }

    // Attach user info to request
    request.user = payload;
    return null;
  } catch (error) {
    console.error('Auth middleware error:', error);
    return new Response(JSON.stringify({
      error: 'Unauthorized',
      message: 'Token validation failed'
    }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders()
      }
    });
  }
}
