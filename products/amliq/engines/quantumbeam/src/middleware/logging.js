/**
 * Logging middleware for Cloudflare Workers
 */

export async function loggingMiddleware(request, env) {
  const startTime = request._startTime || Date.now();
  const url = new URL(request.url);
  const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
  const userAgent = request.headers.get('User-Agent') || 'unknown';
  const requestId = request._requestId || crypto.randomUUID();

  // Log request
  console.log(JSON.stringify({
    type: 'request',
    method: request.method,
    url: url.pathname,
    query: url.search,
    clientIP,
    userAgent,
    timestamp: new Date().toISOString(),
    requestId
  }));

  // Store request metadata for later use
  request._startTime = startTime;
  request._requestId = requestId;

  return null;
}

export function logResponse(request, response, env) {
  const duration = Date.now() - request._startTime;
  const status = response.status;
  const url = new URL(request.url);

  console.log(JSON.stringify({
    type: 'response',
    method: request.method,
    url: url.pathname,
    status,
    duration,
    requestId: request._requestId,
    timestamp: new Date().toISOString()
  }));

  // Send analytics event
  if (env.ANALYTICS_QUEUE) {
    env.ANALYTICS_QUEUE.send({
      type: 'api_request',
      method: request.method,
      path: url.pathname,
      status,
      duration,
      timestamp: new Date().toISOString()
    });
  }
}

export async function logError(error, request, env) {
  console.error(JSON.stringify({
    type: 'error',
    message: error.message,
    stack: error.stack,
    url: request.url,
    method: request.method,
    requestId: request._requestId,
    timestamp: new Date().toISOString()
  }));

  // Send error analytics
  if (env.ANALYTICS_QUEUE) {
    env.ANALYTICS_QUEUE.send({
      type: 'error',
      message: error.message,
      url: request.url,
      method: request.method,
      timestamp: new Date().toISOString()
    });
  }
}
