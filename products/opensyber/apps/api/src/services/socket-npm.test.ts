import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockDb } from '../test/helpers.js';
import { processNpmInstallEvent } from './socket-npm.js';

let mockFetch: any;

beforeEach(() => {
  mockFetch = vi.fn();
  global.fetch = mockFetch;
});

describe('socket-npm: event processing', () => {
  let db: any;

  beforeEach(() => {
    db = createMockDb();
  });

  describe('processNpmInstallEvent', () => {
    it('creates integration event for critical threat', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ threat: { level: 'critical' } }),
      });

      await processNpmInstallEvent(db, 'conn-1', 'malicious-pkg', '1.0.0', 'test-key');

      expect(db.insert).toHaveBeenCalled();
      expect(db._insertChain.values).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionId: 'conn-1',
          eventType: 'npm-threat-detected',
          severity: 'critical',
        }),
      );
    });

    it('creates integration event for high threat', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ threat: { level: 'high' } }),
      });

      await processNpmInstallEvent(db, 'conn-2', 'suspicious-pkg', '2.0.0', 'test-key');

      expect(db.insert).toHaveBeenCalled();
      expect(db._insertChain.values).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionId: 'conn-2',
          eventType: 'npm-threat-detected',
          severity: 'high',
        }),
      );
    });

    it('does not create event for medium threat', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ threat: { level: 'medium' } }),
      });

      await processNpmInstallEvent(db, 'conn-1', 'medium-pkg', '1.0.0', 'test-key');

      expect(db.insert).not.toHaveBeenCalled();
    });

    it('does not create event for low threat', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ threat: { level: 'low' } }),
      });

      await processNpmInstallEvent(db, 'conn-1', 'safe-pkg', '1.0.0', 'test-key');

      expect(db.insert).not.toHaveBeenCalled();
    });

    it('does not create event when no threat detected', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await processNpmInstallEvent(db, 'conn-1', 'clean-pkg', '1.0.0', 'test-key');

      expect(db.insert).not.toHaveBeenCalled();
    });

    it('stores package info in rawPayload', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ threat: { level: 'critical' } }),
      });

      await processNpmInstallEvent(db, 'conn-1', 'bad-pkg', '3.5.0', 'test-key');

      const insertedValue = vi.mocked(db._insertChain.values).mock.calls[0][0];
      const payload = JSON.parse(insertedValue.rawPayload);

      expect(payload.package).toBe('bad-pkg');
      expect(payload.version).toBe('3.5.0');
      expect(payload.source).toBe('socket-dev');
    });

    it('includes threat level in summary', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ threat: { level: 'critical' } }),
      });

      await processNpmInstallEvent(db, 'conn-1', 'dangerous-pkg', '1.0.0', 'test-key');

      const insertedValue = vi.mocked(db._insertChain.values).mock.calls[0][0];

      expect(insertedValue.summary).toContain('dangerous-pkg');
      expect(insertedValue.summary).toContain('critical');
      expect(insertedValue.summary).toContain('1.0.0');
    });

    it('sets latencyMs to 0', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ threat: { level: 'high' } }),
      });

      await processNpmInstallEvent(db, 'conn-1', 'pkg', '1.0.0', 'test-key');

      const insertedValue = vi.mocked(db._insertChain.values).mock.calls[0][0];
      expect(insertedValue.latencyMs).toBe(0);
    });

    it('sets timestamps to current time', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ threat: { level: 'critical' } }),
      });

      const beforeTime = new Date();
      await processNpmInstallEvent(db, 'conn-1', 'pkg', '1.0.0', 'test-key');
      const afterTime = new Date();

      const insertedValue = vi.mocked(db._insertChain.values).mock.calls[0][0];
      const processedAtTime = new Date(insertedValue.processedAt);
      const createdAtTime = new Date(insertedValue.createdAt);

      expect(processedAtTime.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(processedAtTime.getTime()).toBeLessThanOrEqual(afterTime.getTime());
      expect(createdAtTime.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(createdAtTime.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });
  });
});
