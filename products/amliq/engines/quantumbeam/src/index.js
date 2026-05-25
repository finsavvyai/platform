/**
 * QuantumBeam.io - Cloudflare Workers API Gateway
 *
 * Main entry point for Cloudflare Workers deployment
 * Acts as API Gateway and routing layer for all services
 */

import { Router } from 'itty-router';
import { corsHeaders, handleCORS } from './utils/cors';
import { authMiddleware } from './middleware/auth';
import { rateLimitMiddleware } from './middleware/rateLimit';
import { loggingMiddleware } from './middleware/logging';
import { errorHandler } from './middleware/errorHandler';
import { logResponse } from './middleware/logging';

// Export Durable Objects
export { WebSocketManager } from './durable-objects/websocket-manager';

// Import route handlers
import { authRoutes } from './routes/auth';
import { fraudRoutes } from './routes/fraud';
import { analyticsRoutes } from './routes/analytics';
import { systemRoutes } from './routes/system';
import { quantumRoutes } from './routes/quantum';
import { mlRoutes } from './routes/ml';

// Create router
const router = Router();

// Apply global middleware
router.all('*', loggingMiddleware);
router.all('*', (request) => handleCORS(request));

// Health check endpoint
router.get('/health', (request, env) => {
  return new Response(JSON.stringify({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: env?.ENVIRONMENT || 'development'
  }), {
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders()
    }
  });
});

// API Routes
router.all('/api/v1/auth/*', authRoutes);
router.all('/api/v1/fraud/*', fraudRoutes);
router.all('/api/v1/analytics/*', analyticsRoutes);
router.all('/api/v1/system/*', systemRoutes);
router.all('/api/v1/quantum/*', quantumRoutes);
router.all('/api/v1/ml/*', mlRoutes);

// WebSocket support
router.get('/ws', async (request, env) => {
  const upgradeHeader = request.headers.get('Upgrade');
  if (upgradeHeader !== 'websocket') {
    return new Response('Expected websocket', { status: 426 });
  }

  const webSocketPair = new WebSocketPair();
  const [client, server] = Object.values(webSocketPair);

  // Handle WebSocket connection
  await handleWebSocket(server, env);

  return new Response(null, {
    status: 101,
    webSocket: client,
  });
});

// Static file serving for frontend
router.get('*', async (request, env) => {
  const url = new URL(request.url);

  // Serve frontend assets from R2
  if (url.pathname.startsWith('/assets/') || url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
    try {
      const asset = await env.FILES.get(url.pathname);
      if (asset) {
        return new Response(asset.body, {
          headers: {
            'Content-Type': getContentType(url.pathname),
            'Cache-Control': 'public, max-age=31536000',
          }
        });
      }
    } catch (error) {
      console.error('Error serving asset:', error);
    }
  }

  // Serve index.html for SPA routes
  try {
    const indexHtml = await env.FILES.get('index.html');
    if (indexHtml) {
      return new Response(indexHtml.body, {
        headers: {
          'Content-Type': 'text/html',
          'Cache-Control': 'public, max-age=3600',
        }
      });
    }
  } catch (error) {
    console.error('Error serving index.html:', error);
  }

  return new Response('Not Found', { status: 404 });
});

// 404 handler
router.all('*', (request) => {
  return new Response(JSON.stringify({
    error: 'Not Found',
    message: 'The requested resource was not found',
    path: request.url
  }), {
    status: 404,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders()
    }
  });
});

// WebSocket handler
async function handleWebSocket(webSocket, env) {
  webSocket.accept();

  const clientId = crypto.randomUUID();
  console.log(`WebSocket connection established: ${clientId}`);

  // Add connection to WebSocket manager
  if (env.WEBSOCKET_MANAGER) {
    await env.WEBSOCKET_MANAGER.addConnection(clientId, webSocket);
  }

  // Handle messages
  webSocket.addEventListener('message', async (event) => {
    try {
      const data = JSON.parse(event.data);
      console.log(`WebSocket message from ${clientId}:`, data);

      // Route message to appropriate handler
      await handleWebSocketMessage(clientId, data, webSocket, env);
    } catch (error) {
      console.error(`WebSocket error for ${clientId}:`, error);
      webSocket.send(JSON.stringify({
        type: 'error',
        message: 'Invalid message format'
      }));
    }
  });

  // Handle close
  webSocket.addEventListener('close', () => {
    console.log(`WebSocket connection closed: ${clientId}`);
    if (env.WEBSOCKET_MANAGER) {
      env.WEBSOCKET_MANAGER.removeConnection(clientId);
    }
  });

  // Send welcome message
  webSocket.send(JSON.stringify({
    type: 'connected',
    clientId: clientId,
    timestamp: new Date().toISOString()
  }));
}

// Handle WebSocket messages
async function handleWebSocketMessage(clientId, data, webSocket, env) {
  switch (data.type) {
    case 'subscribe':
      // Subscribe to specific events
      await subscribeToEvents(clientId, data.events, env);
      break;

    case 'unsubscribe':
      // Unsubscribe from events
      await unsubscribeFromEvents(clientId, data.events, env);
      break;

    case 'ping':
      // Respond to ping
      webSocket.send(JSON.stringify({
        type: 'pong',
        timestamp: new Date().toISOString()
      }));
      break;

    default:
      webSocket.send(JSON.stringify({
        type: 'error',
        message: `Unknown message type: ${data.type}`
      }));
  }
}

// Helper functions
function getContentType(pathname) {
  if (pathname.endsWith('.js')) return 'application/javascript';
  if (pathname.endsWith('.css')) return 'text/css';
  if (pathname.endsWith('.json')) return 'application/json';
  if (pathname.endsWith('.png')) return 'image/png';
  if (pathname.endsWith('.jpg') || pathname.endsWith('.jpeg')) return 'image/jpeg';
  if (pathname.endsWith('.svg')) return 'image/svg+xml';
  return 'text/plain';
}

async function subscribeToEvents(clientId, events, env) {
  // Implementation for event subscription
  console.log(`Client ${clientId} subscribed to events:`, events);
}

async function unsubscribeFromEvents(clientId, events, env) {
  // Implementation for event unsubscription
  console.log(`Client ${clientId} unsubscribed from events:`, events);
}

// Main fetch handler
export default {
  async fetch(request, env, ctx) {
    try {
      if (!request._requestId) {
        request._requestId = crypto.randomUUID();
      }
      if (!request._startTime) {
        request._startTime = Date.now();
      }

      // Apply rate limiting
      const rateLimitResponse = await rateLimitMiddleware(request, env);
      if (rateLimitResponse) {
        rateLimitResponse.headers.set('X-Request-Id', request._requestId);
        return rateLimitResponse;
      }

      // Apply authentication for protected routes
      const authResponse = await authMiddleware(request, env);
      if (authResponse && authResponse.status === 401) {
        return authResponse;
      }

      // Route the request
      const response = await router.handle(request, env, ctx);
      if (response) {
        applyResponseHeaders(request, response);
        logResponse(request, response, env);
        return response;
      }

      const notFound = new Response(JSON.stringify({
        error: 'Not Found',
        message: 'The requested resource was not found',
        path: request.url
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders()
        }
      });
      applyResponseHeaders(request, notFound);
      logResponse(request, notFound, env);
      return notFound;
    } catch (error) {
      console.error('Unhandled error:', error);
      const errorResponse = errorHandler(error, request, env);
      applyResponseHeaders(request, errorResponse);
      return errorResponse;
    }
  },

  // Handle scheduled events
  async scheduled(controller, env, ctx) {
    console.log('Running scheduled tasks');

    // Example: cleanup old data
    try {
      await cleanupOldData(env);
      console.log('Scheduled cleanup completed');
    } catch (error) {
      console.error('Scheduled cleanup failed:', error);
    }
  },

  // Handle queue messages
  async queue(batch, env) {
    console.log(`Processing queue batch with ${batch.messages.length} messages`);

    for (const message of batch.messages) {
      try {
        await processQueueMessage(message, env);
        message.ack();
      } catch (error) {
        console.error('Queue message processing failed:', error);
        message.retry();
      }
    }
  }
};

// Helper functions for scheduled and queue processing
async function cleanupOldData(env) {
  // Implementation for data cleanup
  // This could involve cleaning up old entries in KV, D1, etc.
}

async function processQueueMessage(message, env) {
  const data = JSON.parse(message.body);
  console.log('Processing queue message:', data);

  // Route message to appropriate handler
  switch (message.queue) {
    case 'analytics-events':
      await processAnalyticsEvent(data, env);
      break;
    default:
      console.warn(`Unknown queue: ${message.queue}`);
  }
}

async function processAnalyticsEvent(data, env) {
  // Implementation for processing analytics events
  // This could involve storing data in D1, sending to analytics engine, etc.
}

function applyResponseHeaders(request, response) {
  if (request?._requestId && !response.headers.get('X-Request-Id')) {
    response.headers.set('X-Request-Id', request._requestId);
  }

  if (request?._rateLimit) {
    response.headers.set('X-RateLimit-Limit', request._rateLimit.limit.toString());
    response.headers.set('X-RateLimit-Remaining', request._rateLimit.remaining.toString());
    response.headers.set('X-RateLimit-Reset', request._rateLimit.reset.toString());
  }
}
