import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the shared constants
vi.mock('@opensyber/shared', async () => {
  const actual = await vi.importActual('@opensyber/shared');
  return {
    ...actual,
    HETZNER_REGION_MAP: {
      'eu-central': 'fsn1',
      'us-east': 'ash',
    },
    PLAN_SERVER_TYPES: {
      'personal': 'cpx11',
      'pro': 'cpx31',
    },
  };
});

import { hetznerService } from './hetzner.js';

describe('Hetzner Service', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('createServer', () => {
    it('calls Hetzner API and returns server details', async () => {
      globalThis.fetch = vi.fn(async () =>
        new Response(
          JSON.stringify({
            server: {
              id: 42345678,
              public_net: {
                ipv4: { ip: '95.216.1.1' },
                ipv6: { ip: '2a01:4f8:c012:1234::1' },
              },
            },
          }),
          { status: 201 },
        ),
      );

      const result = await hetznerService.createServer({
        instanceId: 'inst_test',
        region: 'eu-central',
        plan: 'personal',
        apiToken: 'hetzner-test-token',
      });

      expect(result.hetznerServerId).toBe(42345678);
      expect(result.ipv4).toBe('95.216.1.1');
      expect(result.ipv6).toBe('2a01:4f8:c012:1234::1');

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://api.hetzner.cloud/v1/servers',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer hetzner-test-token',
          }),
        }),
      );

      // Verify request body
      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.name).toBe('opensyber-inst_test');
      expect(body.image).toBe('ubuntu-22.04');
      expect(body.start_after_create).toBe(true);
    });

    it('throws on Hetzner API error', async () => {
      globalThis.fetch = vi.fn(async () =>
        new Response(
          JSON.stringify({ error: { message: 'invalid token', code: 'unauthorized' } }),
          { status: 401 },
        ),
      );

      await expect(
        hetznerService.createServer({
          instanceId: 'inst_fail',
          region: 'us-east',
          plan: 'pro',
          apiToken: 'bad-token',
        }),
      ).rejects.toThrow('Hetzner createServer failed (401)');
    });
  });

  describe('deleteServer', () => {
    it('succeeds on 200 response', async () => {
      globalThis.fetch = vi.fn(async () => new Response(null, { status: 200 }));

      await expect(
        hetznerService.deleteServer({ hetznerServerId: 12345, apiToken: 'token' }),
      ).resolves.toBeUndefined();

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://api.hetzner.cloud/v1/servers/12345',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });

    it('treats 404 as success (idempotent)', async () => {
      globalThis.fetch = vi.fn(async () => new Response(null, { status: 404 }));

      await expect(
        hetznerService.deleteServer({ hetznerServerId: 99999, apiToken: 'token' }),
      ).resolves.toBeUndefined();
    });

    it('throws on 500 error', async () => {
      globalThis.fetch = vi.fn(async () => new Response(null, { status: 500 }));

      await expect(
        hetznerService.deleteServer({ hetznerServerId: 12345, apiToken: 'token' }),
      ).rejects.toThrow('Hetzner deleteServer failed (500)');
    });
  });

  describe('restartServer', () => {
    it('succeeds on 200 response', async () => {
      globalThis.fetch = vi.fn(async () =>
        new Response(JSON.stringify({ action: { id: 1 } }), { status: 200 }),
      );

      await expect(
        hetznerService.restartServer({ hetznerServerId: 12345, apiToken: 'token' }),
      ).resolves.toBeUndefined();

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://api.hetzner.cloud/v1/servers/12345/actions/reboot',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('throws on error', async () => {
      globalThis.fetch = vi.fn(async () => new Response(null, { status: 503 }));

      await expect(
        hetznerService.restartServer({ hetznerServerId: 12345, apiToken: 'token' }),
      ).rejects.toThrow('Hetzner restartServer failed (503)');
    });
  });

  describe('getServerStatus', () => {
    it('returns running for running status', async () => {
      globalThis.fetch = vi.fn(async () =>
        new Response(JSON.stringify({ server: { status: 'running' } }), { status: 200 }),
      );

      const status = await hetznerService.getServerStatus({
        hetznerServerId: 12345,
        apiToken: 'token',
      });
      expect(status).toBe('running');
    });

    it('returns stopped for off status', async () => {
      globalThis.fetch = vi.fn(async () =>
        new Response(JSON.stringify({ server: { status: 'off' } }), { status: 200 }),
      );

      const status = await hetznerService.getServerStatus({
        hetznerServerId: 12345,
        apiToken: 'token',
      });
      expect(status).toBe('stopped');
    });

    it('returns error on fetch failure', async () => {
      globalThis.fetch = vi.fn(async () => new Response(null, { status: 500 }));

      const status = await hetznerService.getServerStatus({
        hetznerServerId: 12345,
        apiToken: 'token',
      });
      expect(status).toBe('error');
    });

    it('returns error for unknown status', async () => {
      globalThis.fetch = vi.fn(async () =>
        new Response(JSON.stringify({ server: { status: 'rebuilding' } }), { status: 200 }),
      );

      const status = await hetznerService.getServerStatus({
        hetznerServerId: 12345,
        apiToken: 'token',
      });
      expect(status).toBe('error');
    });
  });
});
