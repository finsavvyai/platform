/**
 * Tests: Fastify + TokenForge plugin
 *
 * Validates:
 * - Plugin options are structured correctly
 * - getTfContext returns defaults when tf is undefined
 * - Profile response includes security level derived from trust score
 * - Sensitive op authorization logic
 * - shouldSkip function in the middleware
 */
import { describe, it, expect } from 'vitest';
import {
  createPluginOptions,
  getTfContext,
  buildProfileResponse,
  canPerformSensitiveOp,
} from './app.js';

describe('Fastify + TokenForge Plugin', () => {
  describe('createPluginOptions', () => {
    it('should set api key and skip paths', () => {
      const opts = createPluginOptions('tf_test_key', 'http://localhost:9999');
      expect(opts.apiKey).toBe('tf_test_key');
      expect(opts.apiBase).toBe('http://localhost:9999');
      expect(opts.skipPaths).toContain('/health');
      expect(opts.skipPaths).toContain('/docs/*');
    });

    it('should leave apiBase undefined when not provided', () => {
      const opts = createPluginOptions('tf_test_key');
      expect(opts.apiBase).toBeUndefined();
    });
  });

  describe('getTfContext', () => {
    it('should return tf context when present', () => {
      const req = { tf: { bound: true, trustScore: 95, deviceId: 'dev-1' } };
      const tf = getTfContext(req);
      expect(tf.bound).toBe(true);
      expect(tf.trustScore).toBe(95);
      expect(tf.deviceId).toBe('dev-1');
    });

    it('should return defaults when tf is undefined', () => {
      const req = {};
      const tf = getTfContext(req);
      expect(tf.bound).toBe(false);
      expect(tf.trustScore).toBe(0);
      expect(tf.deviceId).toBeNull();
    });
  });

  describe('buildProfileResponse', () => {
    it('should include high security level for score >= 90', () => {
      const res = buildProfileResponse({ bound: true, trustScore: 95, deviceId: 'dev-1' });
      expect(res.securityLevel).toBe('high');
      expect(res.deviceBound).toBe(true);
    });

    it('should include medium security level for score 60-89', () => {
      const res = buildProfileResponse({ bound: true, trustScore: 75, deviceId: 'dev-1' });
      expect(res.securityLevel).toBe('medium');
    });

    it('should include low security level for score < 60', () => {
      const res = buildProfileResponse({ bound: true, trustScore: 30, deviceId: 'dev-1' });
      expect(res.securityLevel).toBe('low');
    });

    it('should handle unbound device', () => {
      const res = buildProfileResponse({ bound: false, trustScore: 0, deviceId: null });
      expect(res.deviceBound).toBe(false);
      expect(res.securityLevel).toBe('low');
    });
  });

  describe('canPerformSensitiveOp', () => {
    it('should allow when bound and trust >= 90', () => {
      const result = canPerformSensitiveOp({ bound: true, trustScore: 95, deviceId: 'dev-1' });
      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should reject when not bound', () => {
      const result = canPerformSensitiveOp({ bound: false, trustScore: 100, deviceId: null });
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Device not bound');
    });

    it('should reject when trust < 90', () => {
      const result = canPerformSensitiveOp({ bound: true, trustScore: 75, deviceId: 'dev-1' });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('75');
      expect(result.reason).toContain('90');
    });

    it('should reject at exactly 89', () => {
      const result = canPerformSensitiveOp({ bound: true, trustScore: 89, deviceId: 'dev-1' });
      expect(result.allowed).toBe(false);
    });

    it('should allow at exactly 90', () => {
      const result = canPerformSensitiveOp({ bound: true, trustScore: 90, deviceId: 'dev-1' });
      expect(result.allowed).toBe(true);
    });
  });
});
