/**
 * TokenForge Proxy — zero-code session security.
 *
 * Sits between the browser and the customer's origin.
 * Automatically injects the script tag into HTML and
 * verifies device-bound signatures on API requests.
 *
 * Customer setup: point DNS to this worker. No code changes.
 */
import { shouldSkip, shouldMatch } from './path-utils.js';

interface Env {
  PROXY_CONFIG: KVNamespace;
  VERIFY_API: string;
  SDK_SCRIPT_URL: string;
  SERVICE_API_KEY: string;
}

interface ProxyConfig {
  origin: string;
  tenantId: string;
  injectPaths?: string[];
  verifyPaths?: string[];
  skipPaths?: string[];
  blockOnFail?: boolean;
}

/** Escape HTML special characters to prevent XSS in injected script tags */
function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c),
  );
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const hostname = url.hostname;

    // Look up proxy config (shared KV with tokenforge-api)
    const configJson = await env.PROXY_CONFIG.get(`proxy:${hostname}`);
    if (!configJson) {
      return new Response(
        JSON.stringify({
          error: 'not_configured',
          message: `No TokenForge proxy config for ${hostname}. Configure at tokenforge.opensyber.cloud/dashboard`,
        }),
        { status: 502, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const config: ProxyConfig = JSON.parse(configJson);

    // Skip paths (static assets, health checks)
    if (shouldSkip(url.pathname, config.skipPaths)) {
      return forwardToOrigin(request, url, config.origin);
    }

    // API requests with TF headers → verify before forwarding
    const hasTfHeaders = request.headers.get('X-TF-Signature');
    const isVerifyPath = shouldMatch(url.pathname, config.verifyPaths ?? ['/api/*']);

    if (hasTfHeaders && isVerifyPath) {
      return handleVerifiedRequest(request, url, config, env);
    }

    // HTML requests → inject script tag
    const response = await forwardToOrigin(request, url, config.origin);
    const contentType = response.headers.get('Content-Type') ?? '';

    if (contentType.includes('text/html')) {
      return injectScript(response, config.tenantId, env.SDK_SCRIPT_URL);
    }

    return response;
  },
};

async function forwardToOrigin(
  request: Request,
  url: URL,
  origin: string,
): Promise<Response> {
  const originUrl = new URL(url.pathname + url.search, origin);
  const headers = new Headers(request.headers);
  headers.set('X-Forwarded-Host', url.hostname);
  headers.set('X-Forwarded-Proto', 'https');

  return fetch(originUrl.toString(), {
    method: request.method,
    headers,
    body: request.method !== 'GET' && request.method !== 'HEAD'
      ? request.body
      : undefined,
    redirect: 'manual',
  });
}

async function handleVerifiedRequest(
  request: Request,
  url: URL,
  config: ProxyConfig,
  env: Env,
): Promise<Response> {
  // Call TokenForge API to verify the request
  const verifyRes = await fetch(`${env.VERIFY_API}/v1/edge/verify`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.SERVICE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      path: url.pathname,
      method: request.method,
      headers: {
        signature: request.headers.get('X-TF-Signature'),
        nonce: request.headers.get('X-TF-Nonce'),
        timestamp: request.headers.get('X-TF-Timestamp'),
        deviceId: request.headers.get('X-TF-Device-ID'),
      },
      ipAddress: request.headers.get('CF-Connecting-IP') ?? '',
      countryCode: request.headers.get('CF-IPCountry') ?? '',
      userAgent: request.headers.get('User-Agent') ?? '',
    }),
  });

  if (!verifyRes.ok) {
    // API unreachable — forward anyway (graceful degradation)
    const response = await forwardToOrigin(request, url, config.origin);
    return addTfHeaders(response, { bound: false, trustScore: 0, status: 'degraded' });
  }

  const { data } = (await verifyRes.json()) as {
    data: { status: string; trustScore: number; deviceId: string | null; bound: boolean; reason?: string };
  };

  if (data.status === 'block') {
    if (config.blockOnFail !== false) {
      return new Response(
        JSON.stringify({ error: 'session_blocked', reason: data.reason, trustScore: data.trustScore }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      );
    }
  }

  // Forward to origin with trust context in headers
  const response = await forwardToOrigin(request, url, config.origin);
  return addTfHeaders(response, {
    bound: data.bound,
    trustScore: data.trustScore,
    status: data.status,
    deviceId: data.deviceId,
  });
}

function addTfHeaders(
  response: Response,
  tf: { bound: boolean; trustScore: number; status: string; deviceId?: string | null },
): Response {
  const newResponse = new Response(response.body, response);
  newResponse.headers.set('X-TF-Bound', String(tf.bound));
  newResponse.headers.set('X-TF-Score', String(tf.trustScore));
  newResponse.headers.set('Vary', 'Origin');
  newResponse.headers.set('X-TF-Status', tf.status);
  if (tf.deviceId) newResponse.headers.set('X-TF-Device', tf.deviceId);
  return newResponse;
}

async function injectScript(
  response: Response,
  tenantId: string,
  sdkUrl: string,
): Promise<Response> {
  const html = await response.text();
  const safeTenantId = escapeHtml(tenantId);
  const safeSdkUrl = escapeHtml(sdkUrl);
  const scriptTag = `<script src="${safeSdkUrl}" data-tenant-id="${safeTenantId}" defer></script>`;

  // Inject before </head> or before </body> as fallback
  let injected: string;
  if (html.includes('</head>')) {
    injected = html.replace('</head>', `${scriptTag}\n</head>`);
  } else if (html.includes('</body>')) {
    injected = html.replace('</body>', `${scriptTag}\n</body>`);
  } else {
    injected = html + scriptTag;
  }

  const headers = new Headers(response.headers);
  headers.delete('Content-Length');
  headers.set('X-TF-Injected', 'true');

  return new Response(injected, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

