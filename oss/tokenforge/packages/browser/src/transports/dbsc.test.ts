import { describe, it, expect, vi } from 'vitest';
import { detectNativeDbsc, primeNativeDbsc } from './dbsc.js';

describe('detectNativeDbsc', () => {
  it('returns supported=false when navigator lacks deviceBoundSession', () => {
    // happy-dom navigator does not expose the API by default
    const r = detectNativeDbsc();
    expect(r.supported).toBe(false);
    expect(r.reason).toBe('no_dbsc_api');
  });

  it('returns supported=true when the API is present and context is secure', () => {
    const nav = navigator as Navigator & { deviceBoundSession?: unknown };
    const original = nav.deviceBoundSession;
    nav.deviceBoundSession = {};
    try {
      const r = detectNativeDbsc();
      expect(r.supported).toBe(true);
    } finally {
      if (original === undefined) delete nav.deviceBoundSession;
      else nav.deviceBoundSession = original;
    }
  });

  it('returns supported=false on http-only origins', () => {
    const nav = navigator as Navigator & { deviceBoundSession?: unknown };
    nav.deviceBoundSession = {};
    const originalSecure = (self as { isSecureContext?: boolean }).isSecureContext;
    (self as { isSecureContext: boolean }).isSecureContext = false;
    try {
      const r = detectNativeDbsc();
      expect(r.supported).toBe(false);
      expect(r.reason).toBe('http_only_origin');
    } finally {
      delete (nav as { deviceBoundSession?: unknown }).deviceBoundSession;
      (self as { isSecureContext: boolean }).isSecureContext = originalSecure ?? true;
    }
  });
});

describe('primeNativeDbsc', () => {
  it('returns false when the API is absent', async () => {
    const r = await primeNativeDbsc({ registerUrl: '/r' });
    expect(r).toBe(false);
  });

  it('returns true when the response carries Sec-Session-Registration', async () => {
    const nav = navigator as Navigator & { deviceBoundSession?: unknown };
    nav.deviceBoundSession = {};
    const fetchImpl = vi.fn(async () =>
      new Response('', { headers: { 'Sec-Session-Registration': '(ES256);path="/r";challenge="abc"' } }),
    ) as unknown as typeof globalThis.fetch;
    try {
      const r = await primeNativeDbsc({ registerUrl: '/r', fetchImpl });
      expect(r).toBe(true);
    } finally {
      delete (nav as { deviceBoundSession?: unknown }).deviceBoundSession;
    }
  });

  it('returns false when the customer endpoint omits the header', async () => {
    const nav = navigator as Navigator & { deviceBoundSession?: unknown };
    nav.deviceBoundSession = {};
    const fetchImpl = vi.fn(async () => new Response('', { status: 200 })) as unknown as typeof globalThis.fetch;
    try {
      const r = await primeNativeDbsc({ registerUrl: '/r', fetchImpl });
      expect(r).toBe(false);
    } finally {
      delete (nav as { deviceBoundSession?: unknown }).deviceBoundSession;
    }
  });

  it('returns false on fetch error', async () => {
    const nav = navigator as Navigator & { deviceBoundSession?: unknown };
    nav.deviceBoundSession = {};
    const fetchImpl = vi.fn(async () => { throw new Error('network down'); }) as unknown as typeof globalThis.fetch;
    try {
      const r = await primeNativeDbsc({ registerUrl: '/r', fetchImpl });
      expect(r).toBe(false);
    } finally {
      delete (nav as { deviceBoundSession?: unknown }).deviceBoundSession;
    }
  });
});
