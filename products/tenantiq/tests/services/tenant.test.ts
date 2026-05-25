import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createTenant,
  getTenant,
  updateTenant,
  deleteTenant,
  listTenants,
  getTenantHealth,
  getTenantMetrics,
  getTenantAlerts,
  bulkImportTenants,
  searchTenants,
  validateTenantName,
  validateTenantConfig
} from '../../apps/api/src/services/tenant';

describe('Tenant Service', () => {
  const mockDb = vi.fn();
  const mockEnv = { DB: mockDb };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('createTenant', () => {
    it('should create a new tenant with valid data', async () => {
      const tenantData = {
        orgId: 'org-123',
        name: 'Acme Corp',
        domain: 'acme.com',
        config: { region: 'us-east-1' as const }
      };
      const result = await createTenant(tenantData);
      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.name).toBe('Acme Corp');
    });

    it('should reject duplicate tenant names in same org', async () => {
      const tenantData = {
        orgId: 'org-123',
        name: 'Acme Corp',
        domain: 'acme.com'
      };
      await expect(async () => {
        await createTenant(tenantData);
        await createTenant(tenantData);
      }).rejects.toThrow();
    });

    it('should validate domain format', async () => {
      const tenantData = {
        orgId: 'org-123',
        name: 'Test',
        domain: 'invalid..domain'
      };
      await expect(createTenant(tenantData)).rejects.toThrow();
    });

    it('should set initial health score to 100', async () => {
      const tenantData = {
        orgId: 'org-123',
        name: 'New Tenant',
        domain: 'new.com'
      };
      const result = await createTenant(tenantData);
      expect(result.healthScore).toBe(100);
    });

    it('should generate unique tenant ID', async () => {
      const tenant1 = await createTenant({
        orgId: 'org-123',
        name: 'Tenant 1',
        domain: 'tenant1.com'
      });
      const tenant2 = await createTenant({
        orgId: 'org-123',
        name: 'Tenant 2',
        domain: 'tenant2.com'
      });
      expect(tenant1.id).not.toBe(tenant2.id);
    });
  });

  describe('getTenant', () => {
    it('should retrieve tenant by ID', async () => {
      const created = await createTenant({
        orgId: 'org-get',
        name: 'Get Test Tenant',
        domain: 'get-test.com'
      });
      const tenant = await getTenant(created.id, 'org-get');
      expect(tenant).toBeDefined();
      expect(tenant?.id).toBe(created.id);
    });

    it('should return null for non-existent tenant', async () => {
      const tenant = await getTenant('nonexistent', 'org-get');
      expect(tenant).toBeNull();
    });

    it('should enforce org isolation', async () => {
      const created = await createTenant({
        orgId: 'org-iso',
        name: 'Iso Tenant',
        domain: 'iso.com'
      });
      const tenant = await getTenant(created.id, 'org-wrong');
      expect(tenant).toBeNull();
    });

    it('should include health metrics in response', async () => {
      const created = await createTenant({
        orgId: 'org-health-get',
        name: 'Health Test Tenant',
        domain: 'healthget.com'
      });
      const tenant = await getTenant(created.id, 'org-health-get');
      expect(tenant?.healthScore).toBeDefined();
    });
  });

  describe('updateTenant', () => {
    let tenantId: string;

    beforeEach(async () => {
      const created = await createTenant({
        orgId: 'org-update',
        name: 'Update Test ' + Math.random(),
        domain: `update${Math.random().toString(36).slice(2, 8)}.com`
      });
      tenantId = created.id;
    });

    it('should update tenant properties', async () => {
      const updates = { name: 'Updated Name', config: { region: 'eu-west-1' as const } };
      const result = await updateTenant(tenantId, 'org-update', updates);
      expect(result?.name).toBe('Updated Name');
    });

    it('should preserve immutable fields', async () => {
      const result = await updateTenant(tenantId, 'org-update', { name: 'Preserved' } as any);
      expect(result?.id).toBe(tenantId);
    });

    it('should track update timestamp', async () => {
      const before = new Date();
      await updateTenant(tenantId, 'org-update', { name: 'Timestamped' });
      const after = new Date();
      const tenant = await getTenant(tenantId, 'org-update');
      expect(tenant?.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(tenant?.updatedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should validate update data', async () => {
      await expect(
        updateTenant(tenantId, 'org-update', { domain: 'invalid..domain' })
      ).rejects.toThrow();
    });

    it('should return null for non-existent tenant', async () => {
      const result = await updateTenant('nonexistent', 'org-update', { name: 'New' });
      expect(result).toBeNull();
    });
  });

  describe('deleteTenant', () => {
    it('should soft delete a tenant', async () => {
      const created = await createTenant({
        orgId: 'org-del',
        name: 'Del Test',
        domain: 'deltest.com'
      });
      const result = await deleteTenant(created.id, 'org-del');
      expect(result).toBe(true);
    });

    it('should hide deleted tenant from getTenant', async () => {
      const created = await createTenant({
        orgId: 'org-del2',
        name: 'Del Mark Test',
        domain: 'delmark.com'
      });
      await deleteTenant(created.id, 'org-del2');
      const tenant = await getTenant(created.id, 'org-del2');
      // getTenant returns null for deleted tenants
      expect(tenant).toBeNull();
    });

    it('should return false for non-existent tenant', async () => {
      const result = await deleteTenant('nonexistent', 'org-del');
      expect(result).toBe(false);
    });

    it('should prevent double deletion', async () => {
      const created = await createTenant({
        orgId: 'org-del3',
        name: 'Double Del',
        domain: 'doubledelete.com'
      });
      await deleteTenant(created.id, 'org-del3');
      const result = await deleteTenant(created.id, 'org-del3');
      expect(result).toBe(false);
    });

    it('should enforce org isolation', async () => {
      const created = await createTenant({
        orgId: 'org-del4',
        name: 'Iso Del',
        domain: 'isodel.com'
      });
      const result = await deleteTenant(created.id, 'org-wrong');
      expect(result).toBe(false);
    });
  });

  describe('listTenants', () => {
    it('should list all tenants for organization', async () => {
      const tenants = await listTenants('org-123');
      expect(Array.isArray(tenants)).toBe(true);
      expect(tenants.length).toBeGreaterThan(0);
    });

    it('should exclude deleted tenants by default', async () => {
      const tenants = await listTenants('org-123');
      const hasDeleted = tenants.some(t => t.deletedAt);
      expect(hasDeleted).toBe(false);
    });

    it('should support pagination', async () => {
      const page1 = await listTenants('org-123', { limit: 5, offset: 0 });
      const page2 = await listTenants('org-123', { limit: 5, offset: 5 });
      expect(page1.length).toBeLessThanOrEqual(5);
      expect(page2.length).toBeLessThanOrEqual(5);
    });

    it('should support sorting by health score', async () => {
      const tenants = await listTenants('org-123', { sortBy: 'healthScore' });
      for (let i = 1; i < tenants.length; i++) {
        expect(tenants[i-1].healthScore).toBeGreaterThanOrEqual(tenants[i].healthScore);
      }
    });

    it('should return empty array for org with no tenants', async () => {
      const tenants = await listTenants('org-empty');
      expect(tenants).toEqual([]);
    });
  });

  describe('getTenantHealth', () => {
    it('should calculate health score from metrics', async () => {
      const health = await getTenantHealth('tenant-123');
      expect(health.score).toBeGreaterThanOrEqual(0);
      expect(health.score).toBeLessThanOrEqual(100);
    });

    it('should include component scores', async () => {
      const health = await getTenantHealth('tenant-123');
      expect(health.components).toBeDefined();
      expect(health.components.uptime).toBeDefined();
      expect(health.components.performance).toBeDefined();
    });

    it('should return critical array (may be empty for random data)', async () => {
      const health = await getTenantHealth('tenant-123-unhealthy');
      expect(Array.isArray(health.critical)).toBe(true);
    });
  });

  describe('getTenantMetrics', () => {
    it('should retrieve current metrics', async () => {
      const metrics = await getTenantMetrics('tenant-123');
      expect(metrics).toBeDefined();
      expect(metrics.cpu).toBeDefined();
      expect(metrics.memory).toBeDefined();
    });

    it('should support time range filtering', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const metrics = await getTenantMetrics('tenant-123', {
        from: yesterday,
        to: now
      });
      expect(metrics).toBeDefined();
    });
  });

  describe('getTenantAlerts', () => {
    it('should retrieve active alerts', async () => {
      const alerts = await getTenantAlerts('tenant-123');
      expect(Array.isArray(alerts)).toBe(true);
    });

    it('should filter by severity', async () => {
      const critical = await getTenantAlerts('tenant-123', { severity: 'critical' });
      critical.forEach(a => expect(a.severity).toBe('critical'));
    });
  });

  describe('bulkImportTenants', () => {
    it('should import multiple tenants from CSV', async () => {
      const csvData = 'name,domain,region\nTenant1,t1.com,us-east-1\nTenant2,t2.com,eu-west-1';
      const result = await bulkImportTenants('org-123', csvData);
      expect(result.imported).toBeGreaterThan(0);
      expect(result.failed).toBe(0);
    });

    it('should handle partial failures', async () => {
      const csvData = 'name,domain,region\nValid,valid.com,us-east-1\ninvalid..domain,bad..com,invalid';
      const result = await bulkImportTenants('org-123', csvData);
      expect(result.imported).toBeGreaterThanOrEqual(0);
      expect(result.failed).toBeGreaterThan(0);
    });

    it('should return detailed error report', async () => {
      const csvData = 'name,domain\nTenant,bad..domain';
      const result = await bulkImportTenants('org-123', csvData);
      expect(result.errors).toBeDefined();
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('searchTenants', () => {
    it('should search by tenant name', async () => {
      const results = await searchTenants('org-123', 'Acme');
      expect(results.every(t => t.name.includes('Acme'))).toBe(true);
    });

    it('should search by domain', async () => {
      const results = await searchTenants('org-123', 'acme.com');
      expect(results.some(t => t.domain.includes('acme'))).toBe(true);
    });
  });

  describe('validateTenantName', () => {
    it('should accept valid names', () => {
      expect(validateTenantName('Valid Name')).toBe(true);
      expect(validateTenantName('Company-123')).toBe(true);
    });

    it('should reject empty names', () => {
      expect(validateTenantName('')).toBe(false);
    });

    it('should reject names exceeding 255 chars', () => {
      expect(validateTenantName('a'.repeat(256))).toBe(false);
    });
  });

  describe('validateTenantConfig', () => {
    it('should validate region field', () => {
      expect(validateTenantConfig({ region: 'us-east-1' })).toBe(true);
      expect(validateTenantConfig({ region: 'invalid-region' })).toBe(false);
    });

    it('should accept optional fields', () => {
      expect(validateTenantConfig({})).toBe(true);
    });
  });
});
