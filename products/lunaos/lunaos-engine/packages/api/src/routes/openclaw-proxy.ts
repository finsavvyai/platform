/**
 * OpenClaw Proxy Helper — forwards requests to the OpenClaw service
 */

import type { Env } from '../worker';

/**
 * Proxy a request to the OpenClaw service using service binding or fetch.
 */
export async function proxyToOpenClaw(
    env: Env & { OPENCLAW_SERVICE?: Fetcher; OPENCLAW_URL?: string; OPENCLAW_SERVICE_KEY?: string },
    path: string,
    init: RequestInit & { method?: string },
    userId?: string,
): Promise<Response> {
    const baseUrl = env.OPENCLAW_URL || 'http://localhost:8790';
    const serviceKey = env.OPENCLAW_SERVICE_KEY || '';

    const serviceBinding = (env as any).OPENCLAW_SERVICE;

    const url = `${baseUrl}${path}`;
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(serviceKey ? { 'X-Service-Key': serviceKey } : {}),
        ...(userId ? { 'X-User-Id': userId } : {}),
    };

    const authHeader = (init as any)._authHeader;
    if (authHeader) {
        headers['Authorization'] = authHeader;
    }

    const request = new Request(url, {
        method: init.method || 'GET',
        headers,
        body: init.body,
    });

    if (serviceBinding) {
        return serviceBinding.fetch(request);
    }
    return globalThis.fetch(request);
}
