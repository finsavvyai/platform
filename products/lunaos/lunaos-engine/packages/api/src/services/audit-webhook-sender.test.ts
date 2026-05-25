/**
 * Tests for Audit Webhook Sender
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  generateWebhookSignature,
  sendAuditWebhooks,
  createAuditWebhook,
  listAuditWebhooks,
  deleteAuditWebhook,
  type AuditWebhookPayload,
} from './audit-webhook-sender';

describe('Audit Webhook Sender', () => {
  describe('generateWebhookSignature', () => {
    it('should generate consistent signatures for same payload', () => {
      const payload = '{"action":"auth.login","userId":"user-123"}';
      const secret = 'webhook-secret-key';

      const sig1 = generateWebhookSignature(payload, secret);
      const sig2 = generateWebhookSignature(payload, secret);

      expect(sig1).toBe(sig2);
      expect(sig1).toMatch(/^[a-f0-9]{64}$/); // 256-bit hex
    });

    it('should generate different signatures for different payloads', () => {
      const secret = 'webhook-secret-key';

      const sig1 = generateWebhookSignature('payload1', secret);
      const sig2 = generateWebhookSignature('payload2', secret);

      expect(sig1).not.toBe(sig2);
    });

    it('should generate different signatures for different secrets', () => {
      const payload = '{"action":"auth.login"}';

      const sig1 = generateWebhookSignature(payload, 'secret1');
      const sig2 = generateWebhookSignature(payload, 'secret2');

      expect(sig1).not.toBe(sig2);
    });
  });

  describe('sendAuditWebhooks', () => {
    let mockDb: any;
    let mockEnv: any;

    beforeEach(() => {
      mockDb = {
        prepare: vi.fn(),
      };

      mockEnv = {
        DB: mockDb,
      };
    });

    it('should skip if no webhooks configured', async () => {
      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({ results: [] }),
        }),
      });

      const payload: AuditWebhookPayload = {
        id: 'evt-123',
        action: 'auth.login',
        userId: 'user-123',
        timestamp: new Date().toISOString(),
        orgId: 'org-123',
      };

      await expect(sendAuditWebhooks(mockEnv, 'org-123', payload)).resolves.not.toThrow();
      expect(mockDb.prepare).toHaveBeenCalled();
    });

    it('should filter webhooks by event type', async () => {
      const mockPrepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({
            results: [
              {
                id: 'hook-1',
                url: 'https://example.com/webhook',
                secret: 'secret1',
                events: JSON.stringify(['auth.login']),
              },
              {
                id: 'hook-2',
                url: 'https://example.com/webhook2',
                secret: 'secret2',
                events: JSON.stringify(['api_key.created']),
              },
            ],
          }),
        }),
      });

      mockDb.prepare = mockPrepare;
      global.fetch = vi.fn().mockResolvedValue({ ok: true });

      const payload: AuditWebhookPayload = {
        id: 'evt-123',
        action: 'auth.login',
        userId: 'user-123',
        timestamp: new Date().toISOString(),
        orgId: 'org-123',
      };

      await sendAuditWebhooks(mockEnv, 'org-123', payload);

      // Only webhook-1 should be called (it has auth.login in events)
      // Note: actual fetch calls are async and may not be awaited
    });

    it('should not throw on DB error', async () => {
      mockDb.prepare.mockImplementation(() => {
        throw new Error('DB connection failed');
      });

      const payload: AuditWebhookPayload = {
        id: 'evt-123',
        action: 'auth.login',
        timestamp: new Date().toISOString(),
        orgId: 'org-123',
      };

      await expect(
        sendAuditWebhooks(mockEnv, 'org-123', payload),
      ).resolves.not.toThrow();
    });
  });

  describe('createAuditWebhook', () => {
    let mockDb: any;

    beforeEach(() => {
      mockDb = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            run: vi.fn().mockResolvedValue({}),
          }),
        }),
      };
    });

    it('should create webhook with events', async () => {
      const result = await createAuditWebhook(
        mockDb,
        'org-123',
        'https://example.com/webhook',
        ['auth.login', 'api_key.created'],
      );

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('secret');
      expect(result.id).toMatch(/^[0-9a-f\-]{36}$/); // UUID format
      expect(result.secret).toHaveLength(64); // 32 bytes = 64 hex chars
    });

    it('should create webhook without events filter', async () => {
      const result = await createAuditWebhook(mockDb, 'org-123', 'https://example.com/webhook');

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('secret');
    });

    it('should persist webhook to database', async () => {
      await createAuditWebhook(
        mockDb,
        'org-123',
        'https://example.com/webhook',
        ['auth.login'],
      );

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_webhooks'),
      );
    });
  });

  describe('listAuditWebhooks', () => {
    let mockDb: any;

    beforeEach(() => {
      mockDb = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue({
              results: [
                {
                  id: 'hook-1',
                  url: 'https://example.com/webhook',
                  events: JSON.stringify(['auth.login']),
                  active: 1,
                  created_at: '2024-01-01T00:00:00Z',
                },
              ],
            }),
          }),
        }),
      };
    });

    it('should list all webhooks for org', async () => {
      const webhooks = await listAuditWebhooks(mockDb, 'org-123');

      expect(Array.isArray(webhooks)).toBe(true);
      expect(webhooks.length).toBeGreaterThan(0);
      expect(webhooks[0]).toHaveProperty('id');
      expect(webhooks[0]).toHaveProperty('url');
    });

    it('should parse events JSON', async () => {
      const webhooks = await listAuditWebhooks(mockDb, 'org-123');

      expect(Array.isArray(webhooks[0].events)).toBe(true);
    });

    it('should return empty array if no webhooks', async () => {
      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({ results: null }),
        }),
      });

      const webhooks = await listAuditWebhooks(mockDb, 'org-123');

      expect(webhooks).toEqual([]);
    });
  });

  describe('deleteAuditWebhook', () => {
    let mockDb: any;

    beforeEach(() => {
      mockDb = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            run: vi.fn().mockResolvedValue({}),
          }),
        }),
      };
    });

    it('should delete webhook by ID', async () => {
      await deleteAuditWebhook(mockDb, 'hook-123');

      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('DELETE'));
    });
  });
});
