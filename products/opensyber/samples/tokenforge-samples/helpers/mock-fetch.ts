/**
 * Mock fetch helper for testing TokenForge cloud API middleware.
 * Simulates the /v1/edge/verify endpoint responses.
 */

type MockResponse = {
  status: 'allow' | 'step_up' | 'block' | 'degraded';
  trustScore: number;
  deviceId: string | null;
  bound: boolean;
  reason?: string;
};

const DEFAULT_ALLOW: MockResponse = {
  status: 'allow',
  trustScore: 95,
  deviceId: 'device-001',
  bound: true,
};

/**
 * Install a mock global fetch that intercepts TokenForge API calls.
 * Returns a controller to change responses mid-test.
 */
export function installMockFetch(initial?: Partial<MockResponse>) {
  let currentResponse: MockResponse = { ...DEFAULT_ALLOW, ...initial };
  let callCount = 0;
  let lastBody: Record<string, unknown> | null = null;
  const original = globalThis.fetch;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

    if (url.includes('/v1/edge/verify')) {
      callCount++;
      if (init?.body) {
        lastBody = JSON.parse(init.body as string);
      }
      return new Response(JSON.stringify({ data: currentResponse }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return original(input, init);
  }) as typeof fetch;

  return {
    setResponse(response: Partial<MockResponse>) {
      currentResponse = { ...DEFAULT_ALLOW, ...response };
    },
    getCallCount: () => callCount,
    getLastBody: () => lastBody,
    restore() { globalThis.fetch = original; },
  };
}

/** Install a mock fetch that returns API errors. */
export function installFailingFetch() {
  const original = globalThis.fetch;

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.includes('/v1/edge/verify')) {
      return new Response('Internal Server Error', { status: 500 });
    }
    return original(input);
  }) as typeof fetch;

  return { restore() { globalThis.fetch = original; } };
}
