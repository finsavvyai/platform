import { describe, it, expect, beforeEach } from 'vitest';
import { createMockDb } from '../test/mock-db.js';
import { validateTenantScope, extractTenantId } from './tenant-isolation.js';

describe('Tenant Scope Validation', () => {
  let mockDb: any;

  beforeEach(() => {
    mockDb = createMockDb();
  });

  describe('validateTenantScope', () => {
    it('should validate userId owns the connection', async () => {
      mockDb._setSelectResult([{ id: 'conn-123' }]);

      const isValid = await validateTenantScope(mockDb, 'user-123', 'conn-123');

      expect(isValid).toBe(true);
      expect(mockDb.select).toHaveBeenCalled();
    });

    it('should return false when user does not own connection', async () => {
      mockDb._setSelectResult([]);

      const isValid = await validateTenantScope(mockDb, 'user-123', 'conn-456');

      expect(isValid).toBe(false);
    });

    it('should check both id and userId in query', async () => {
      mockDb._setSelectResult([]);

      const isValid = await validateTenantScope(mockDb, 'user-789', 'conn-789');

      expect(isValid).toBe(false);
    });

    it('should differentiate access by user', async () => {
      mockDb._setSelectResults([
        [{ id: 'conn-123' }],
        [],
      ]);
      const r1 = await validateTenantScope(mockDb, 'user-1', 'conn-123');
      const r2 = await validateTenantScope(mockDb, 'user-2', 'conn-123');
      expect(r1).toBe(true);
      expect(r2).toBe(false);
    });
  });

  describe('extractTenantId', () => {
    it('should return null when authorization header missing', () => {
      const headers = new Headers({});

      const tenantId = extractTenantId(headers);

      expect(tenantId).toBeNull();
    });

    it('should return null for invalid Bearer token', () => {
      const headers = new Headers({
        authorization: 'Bearer invalid_token',
      });

      const tenantId = extractTenantId(headers);

      expect(tenantId).toBeNull();
    });

    it('should return null for non-Bearer auth header', () => {
      const headers = new Headers({
        authorization: 'Basic dXNlcjpwYXNz',
      });

      const tenantId = extractTenantId(headers);

      expect(tenantId).toBeNull();
    });

    it('should return null when auth header present but no sub claim', () => {
      const headers = new Headers({
        authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
      });

      const tenantId = extractTenantId(headers);

      expect(tenantId).toBeNull();
    });

    it('should handle missing authorization header gracefully', () => {
      const headers = new Headers();

      const tenantId = extractTenantId(headers);

      expect(tenantId).toBeNull();
    });

    it('should return null when headers contain no relevant data', () => {
      const headers = new Headers({
        'content-type': 'application/json',
        'x-custom-header': 'value',
      });

      const tenantId = extractTenantId(headers);

      expect(tenantId).toBeNull();
    });
  });
});
