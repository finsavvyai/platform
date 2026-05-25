import { describe, it, expect, vi } from 'vitest';
import { KasmClient, KasmApiError, KasmTimeoutError } from './kasm-client.js';

const baseCreds = {
  apiUrl: 'https://kasm.test.local',
  apiKey: 'devkey',
  apiKeySecret: 'devsecret',
};

function jsonResponse(body: unknown, init: { status?: number } = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'content-type': 'application/json' },
  });
}

describe('KasmClient', () => {
  it('rejects construction without credentials', () => {
    expect(() => new KasmClient({ apiUrl: '', apiKey: 'x', apiKeySecret: 'y' })).toThrow();
    expect(() => new KasmClient({ apiUrl: 'x', apiKey: '', apiKeySecret: 'y' })).toThrow();
    expect(() => new KasmClient({ apiUrl: 'x', apiKey: 'y', apiKeySecret: '' })).toThrow();
  });

  it('requestKasm sends auth body shape and parses response', async () => {
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      expect(body.api_key).toBe('devkey');
      expect(body.api_key_secret).toBe('devsecret');
      expect(body.user_id).toBe('user-1');
      expect(body.image_id).toBe('kasmweb/chrome:1.16.0');
      expect(body.kasm_url).toBe('https://target.example/');
      expect(_url).toBe('https://kasm.test.local/api/public/request_kasm');
      return jsonResponse({ kasm_id: 'k-123', status: 'starting', kasm_url: 'https://k/' });
    });
    const c = new KasmClient(baseCreds, { fetchImpl });
    const r = await c.requestKasm({
      userId: 'user-1',
      imageId: 'kasmweb/chrome:1.16.0',
      goUrl: 'https://target.example/',
    });
    expect(r.kasm_id).toBe('k-123');
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('getKasmStatus parses Kasm wrapped record', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        kasm: {
          kasm_id: 'k-1',
          user_id: 'u-1',
          image_id: 'img',
          operational_status: 'running',
        },
        operational_status: 'running',
      }),
    );
    const c = new KasmClient(baseCreds, { fetchImpl });
    const r = await c.getKasmStatus('k-1', 'u-1');
    expect(r.kasm?.kasm_id).toBe('k-1');
    expect(r.operational_status).toBe('running');
  });

  it('destroyKasm parses empty success body', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}));
    const c = new KasmClient(baseCreds, { fetchImpl });
    const r = await c.destroyKasm('k-1', 'u-1');
    expect(r.error_message).toBeUndefined();
  });

  it('listKasms returns parsed array (empty default)', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ kasms: [] }));
    const c = new KasmClient(baseCreds, { fetchImpl });
    const r = await c.listKasms();
    expect(r.kasms).toEqual([]);
  });

  it('propagates 4xx as KasmApiError', async () => {
    const fetchImpl = vi.fn(async () => new Response('forbidden', { status: 403 }));
    const c = new KasmClient(baseCreds, { fetchImpl });
    await expect(c.listKasms()).rejects.toBeInstanceOf(KasmApiError);
  });

  it('propagates 500 with body included', async () => {
    const fetchImpl = vi.fn(async () => new Response('boom', { status: 500 }));
    const c = new KasmClient(baseCreds, { fetchImpl });
    await expect(c.listKasms()).rejects.toThrow(/500/);
  });

  it('aborts on timeout', async () => {
    const fetchImpl = vi.fn(
      (_u: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            const err = new Error('aborted');
            err.name = 'AbortError';
            reject(err);
          });
        }),
    );
    const c = new KasmClient(baseCreds, { fetchImpl, timeoutMs: 5 });
    await expect(c.listKasms()).rejects.toBeInstanceOf(KasmTimeoutError);
  });

  it('rejects unparseable response shapes', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ not_kasm_id: true }));
    const c = new KasmClient(baseCreds, { fetchImpl });
    await expect(
      c.requestKasm({ userId: 'u', imageId: 'i' }),
    ).rejects.toThrow();
  });
});
