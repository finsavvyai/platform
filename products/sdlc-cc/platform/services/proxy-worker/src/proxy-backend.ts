/**
 * Backend proxy and API key validation logic.
 */

import { isApiKeyRecord, type ApiKeyRecord } from './api-keys';
import type { Env } from './env';

export function extractApiKey(request: Request): string | null {
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  const apiKeyHeader = request.headers.get('X-API-Key');
  return apiKeyHeader ?? null;
}

export async function validateApiKey(
  apiKey: string,
  env: Env
): Promise<ApiKeyRecord | null> {
  const keyData = await env.API_KEYS.get(apiKey, 'json');
  if (!isApiKeyRecord(keyData)) {
    return null;
  }

  if (keyData.status !== 'active') {
    return null;
  }

  if (keyData.expires_at && new Date(keyData.expires_at) < new Date()) {
    return null;
  }

  return keyData;
}

export async function proxyToBackend(
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const backendUrl = env.BACKEND_URL?.replace(/\/$/, '');
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);

  try {
    if (backendUrl) {
      const targetUrl = `${backendUrl}${url.pathname}${url.search}`;
      const headers = new Headers(request.headers);
      const body =
        request.method !== 'GET' && request.method !== 'HEAD'
          ? await request.clone().arrayBuffer()
          : null;

      return await fetch(targetUrl, {
        method: request.method,
        headers,
        body: body ?? undefined,
        signal: controller.signal,
      });
    }

    // OpenAI-compat: pass /v1/* through to api.openai.com.
    // Anthropic-compat: rewrite /anthropic/v1/* → api.anthropic.com/v1/*
    // and swap Bearer for x-api-key per Anthropic's auth scheme.
    const isAnthropic = url.pathname.startsWith('/anthropic/v1/');
    let upstreamUrl: string;
    const headers = new Headers(request.headers);
    headers.delete('X-API-Key');

    if (isAnthropic) {
      const anthropicPath = url.pathname.replace('/anthropic', '');
      upstreamUrl = `https://api.anthropic.com${anthropicPath}${url.search}`;
      headers.delete('Authorization');
      headers.set('x-api-key', env.ANTHROPIC_API_KEY || 'sk-missing');
      if (!headers.has('anthropic-version')) {
        headers.set('anthropic-version', '2023-06-01');
      }
    } else {
      upstreamUrl = `https://api.openai.com${url.pathname}${url.search}`;
      headers.set(
        'Authorization',
        `Bearer ${env.OPENAI_API_KEY || 'sk-missing'}`
      );
    }

    const body =
      request.method !== 'GET' && request.method !== 'HEAD'
        ? await request.clone().arrayBuffer()
        : null;

    return await fetch(upstreamUrl, {
      method: request.method,
      headers,
      body: body ?? undefined,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export function getOrCreateRequestId(request: Request): string {
  return request.headers.get('X-Request-ID') ?? crypto.randomUUID();
}

export function withRequestId(
  request: Request,
  requestId: string
): Request {
  const headers = new Headers(request.headers);
  headers.set('X-Request-ID', requestId);
  return new Request(request, { headers });
}
