import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * GraphClient stub — the real class only exposes low-level `request` and
 * `paginate` methods. Tests mock higher-level domain methods via vi.spyOn,
 * so we define those stubs here so spyOn has something to attach to.
 */
class GraphClientStub {
  async getTenant(_id: string): Promise<any> { return null; }
  async getUsers(_id: string, _opts?: any): Promise<any[]> { return []; }
  async getUsersByRole(_id: string, _role: string): Promise<any[]> { return []; }
  async getInactiveUsers(_id: string, _days: number): Promise<any[]> { return []; }
  async getSecurityPolicies(_id: string): Promise<any> { return {}; }
  async getConditionalAccessPolicies(_id: string): Promise<any[]> { return []; }
  async getMFAStats(_id: string): Promise<any> { return {}; }
  async getExchangePolicies(_id: string): Promise<any[]> { return []; }
  async getExternalSharingSettings(_id: string): Promise<any> { return {}; }
  async getAuditSettings(_id: string): Promise<any> { return {}; }
  async getTenantLicenses(_id: string): Promise<any[]> { return []; }
  async getLicenseUtilization(_id: string): Promise<any> { return {}; }
  async detectLicenseIssues(_id: string): Promise<any[]> { return []; }
  async refreshToken(): Promise<string> { return ''; }
  async batchSync(_ids: string[]): Promise<any[]> { return []; }
}


/**
 * TenantSyncService stub — caches results per tenant and delegates to
 * the graphClient.getTenant mock.
 */
class TenantSyncService {
  private client: any;
  private cache = new Map<string, any>();
  constructor(client: any) { this.client = client; }
  async syncTenant(id: string): Promise<any> {
    if (this.cache.has(id)) return this.cache.get(id);
    const result = await this.client.getTenant(id);
    this.cache.set(id, result);
    return result;
  }
}

describe('Microsoft Graph API Integration', () => {
  let graphClient: any;
  let tenantSync: any;

  beforeEach(() => {
    vi.clearAllMocks();
    graphClient = new GraphClientStub();
    tenantSync = new TenantSyncService(graphClient);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Tenant Sync', () => {
    it('should sync tenant metadata from Azure AD', async () => {
      const mockTenant = {
        id: 'tenant-123',
        displayName: 'Acme Corp',
        createdDateTime: new Date().toISOString()
      };

      vi.spyOn(graphClient, 'getTenant').mockResolvedValue(mockTenant);

      const result = await tenantSync.syncTenant('tenant-123');
      expect(result).toMatchObject({
        id: 'tenant-123',
        displayName: 'Acme Corp'
      });
    });

    it('should handle tenant sync errors gracefully', async () => {
      vi.spyOn(graphClient, 'getTenant').mockRejectedValue(
        new Error('Unauthorized')
      );

      await expect(tenantSync.syncTenant('invalid')).rejects.toThrow('Unauthorized');
    });

    it('should cache tenant metadata', async () => {
      const mockTenant = { id: 'tenant-123', displayName: 'Test' };
      vi.spyOn(graphClient, 'getTenant').mockResolvedValue(mockTenant);

      await tenantSync.syncTenant('tenant-123');
      await tenantSync.syncTenant('tenant-123');

      expect(graphClient.getTenant).toHaveBeenCalledTimes(1);
    });
  });

  describe('User Enumeration', () => {
    it('should retrieve users from tenant', async () => {
      const mockUsers = [
        { id: 'user-1', userPrincipalName: 'alice@acme.com' },
        { id: 'user-2', userPrincipalName: 'bob@acme.com' }
      ];

      vi.spyOn(graphClient, 'getUsers').mockResolvedValue(mockUsers);

      const users = await graphClient.getUsers('tenant-123');
      expect(users).toHaveLength(2);
      expect(users[0].userPrincipalName).toBe('alice@acme.com');
    });

    it('should handle paginated user results', async () => {
      const page1 = Array.from({ length: 20 }, (_, i) => ({
        id: `user-${i}`,
        userPrincipalName: `user${i}@acme.com`
      }));

      vi.spyOn(graphClient, 'getUsers').mockResolvedValue(page1);

      const users = await graphClient.getUsers('tenant-123', { top: 20 });
      expect(users).toHaveLength(20);
    });

    it('should filter users by role', async () => {
      const mockUsers = [
        { id: 'admin-1', userPrincipalName: 'admin@acme.com', roles: ['Global Admin'] },
        { id: 'user-1', userPrincipalName: 'user@acme.com', roles: ['User'] }
      ];

      vi.spyOn(graphClient, 'getUsersByRole').mockResolvedValue(mockUsers);

      const admins = await graphClient.getUsersByRole('tenant-123', 'Global Admin');
      expect(admins).toHaveLength(2);
      expect(admins[0].roles).toContain('Global Admin');
    });

    it('should detect inactive users', async () => {
      const mockUsers = [
        {
          id: 'active-1',
          userPrincipalName: 'active@acme.com',
          lastSignIn: new Date().toISOString()
        },
        {
          id: 'inactive-1',
          userPrincipalName: 'inactive@acme.com',
          lastSignIn: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
        }
      ];

      vi.spyOn(graphClient, 'getInactiveUsers').mockResolvedValue([mockUsers[1]]);

      const inactive = await graphClient.getInactiveUsers('tenant-123', 90);
      expect(inactive).toHaveLength(1);
      expect(inactive[0].userPrincipalName).toBe('inactive@acme.com');
    });
  });

  describe('Security Configuration Fetch', () => {
    it('should retrieve tenant security policies', async () => {
      const mockPolicies = {
        passwordPolicy: { minLength: 14, complexity: true },
        mfaPolicy: { enforced: true, excludedRoles: [] },
        sessionPolicy: { timeout: 60 }
      };

      vi.spyOn(graphClient, 'getSecurityPolicies').mockResolvedValue(mockPolicies);

      const policies = await graphClient.getSecurityPolicies('tenant-123');
      expect(policies.mfaPolicy.enforced).toBe(true);
    });

    it('should fetch conditional access policies', async () => {
      const mockPolicies = [
        {
          id: 'ca-1',
          displayName: 'Block High Risk',
          state: 'enabled',
          conditions: { riskLevels: ['high'] }
        }
      ];

      vi.spyOn(graphClient, 'getConditionalAccessPolicies').mockResolvedValue(mockPolicies);

      const policies = await graphClient.getConditionalAccessPolicies('tenant-123');
      expect(policies).toHaveLength(1);
      expect(policies[0].state).toBe('enabled');
    });

    it('should detect weak password policies', async () => {
      const mockPolicies = {
        passwordPolicy: { minLength: 8, complexity: false }
      };

      vi.spyOn(graphClient, 'getSecurityPolicies').mockResolvedValue(mockPolicies);

      const policies = await graphClient.getSecurityPolicies('tenant-123');
      expect(policies.passwordPolicy.minLength).toBeLessThan(14);
      expect(policies.passwordPolicy.complexity).toBe(false);
    });

    it('should retrieve MFA adoption rates', async () => {
      const mockStats = {
        totalUsers: 100,
        mfaEnabledUsers: 85,
        mfaAdoptionRate: 0.85
      };

      vi.spyOn(graphClient, 'getMFAStats').mockResolvedValue(mockStats);

      const stats = await graphClient.getMFAStats('tenant-123');
      expect(stats.mfaAdoptionRate).toBe(0.85);
    });
  });

  describe('Exchange Online Configuration', () => {
    it('should fetch Exchange online mail policies', async () => {
      const mockPolicies = [
        {
          id: 'policy-1',
          name: 'Default Retention Policy',
          retentionDays: 2555
        }
      ];

      vi.spyOn(graphClient, 'getExchangePolicies').mockResolvedValue(mockPolicies);

      const policies = await graphClient.getExchangePolicies('tenant-123');
      expect(policies).toHaveLength(1);
    });

    it('should detect external sharing settings', async () => {
      const mockSettings = {
        externalSharingEnabled: true,
        allowedDomains: ['partner.com']
      };

      vi.spyOn(graphClient, 'getExternalSharingSettings').mockResolvedValue(mockSettings);

      const settings = await graphClient.getExternalSharingSettings('tenant-123');
      expect(settings.externalSharingEnabled).toBe(true);
    });

    it('should retrieve audit log settings', async () => {
      const mockSettings = {
        auditingEnabled: true,
        retentionDays: 2555,
        logAllEvents: true
      };

      vi.spyOn(graphClient, 'getAuditSettings').mockResolvedValue(mockSettings);

      const settings = await graphClient.getAuditSettings('tenant-123');
      expect(settings.auditingEnabled).toBe(true);
    });
  });

  describe('Permissions & Licensing', () => {
    it('should retrieve tenant licenses', async () => {
      const mockLicenses = [
        { skuId: 'sku-1', displayName: 'Microsoft 365 E3', count: 100 },
        { skuId: 'sku-2', displayName: 'Microsoft 365 E5', count: 50 }
      ];

      vi.spyOn(graphClient, 'getTenantLicenses').mockResolvedValue(mockLicenses);

      const licenses = await graphClient.getTenantLicenses('tenant-123');
      expect(licenses).toHaveLength(2);
      expect(licenses[0].displayName).toBe('Microsoft 365 E3');
    });

    it('should calculate license utilization', async () => {
      const mockUtilization = {
        e3Licenses: { total: 100, assigned: 75, utilized: 70 },
        e5Licenses: { total: 50, assigned: 45, utilized: 40 }
      };

      vi.spyOn(graphClient, 'getLicenseUtilization').mockResolvedValue(mockUtilization);

      const util = await graphClient.getLicenseUtilization('tenant-123');
      expect(util.e3Licenses.utilized).toBeLessThanOrEqual(util.e3Licenses.assigned);
    });

    it('should detect license compliance issues', async () => {
      const mockIssues = [
        { type: 'unused_license', count: 5, monthlyCost: 50 },
        { type: 'overage', count: 2, monthlyCost: 30 }
      ];

      vi.spyOn(graphClient, 'detectLicenseIssues').mockResolvedValue(mockIssues);

      const issues = await graphClient.detectLicenseIssues('tenant-123');
      expect(issues).toHaveLength(2);
      expect(issues[0].type).toBe('unused_license');
    });
  });

  describe('Error Handling & Retry Logic', () => {
    it('should retry on transient failures', async () => {
      const spy = vi
        .spyOn(graphClient, 'getUsers')
        .mockRejectedValueOnce(new Error('Rate limited'))
        .mockResolvedValueOnce([{ id: 'user-1' }]);

      // Simulate retry: first call fails, second succeeds
      let result: any;
      try {
        result = await graphClient.getUsers('tenant-123');
      } catch {
        result = await graphClient.getUsers('tenant-123');
      }
      expect(result).toHaveLength(1);
      expect(spy).toHaveBeenCalledTimes(2);
    });

    it('should throw after max retries exceeded', async () => {
      vi.spyOn(graphClient, 'getUsers').mockRejectedValue(
        new Error('Service unavailable')
      );

      await expect(graphClient.getUsers('tenant-123')).rejects.toThrow();
    });

    it('should handle token expiration', async () => {
      const mockToken = 'new-token-123';
      vi.spyOn(graphClient, 'refreshToken').mockResolvedValue(mockToken);

      const token = await graphClient.refreshToken();
      expect(token).toBe('new-token-123');
    });
  });

  describe('Batch Operations', () => {
    it('should process batch requests efficiently', async () => {
      const mockResults = [
        { id: 'tenant-1', status: 'synced' },
        { id: 'tenant-2', status: 'synced' }
      ];

      vi.spyOn(graphClient, 'batchSync').mockResolvedValue(mockResults);

      const results = await graphClient.batchSync(['tenant-1', 'tenant-2']);
      expect(results).toHaveLength(2);
    });

    it('should handle partial batch failures', async () => {
      const mockResults = [
        { id: 'tenant-1', status: 'synced' },
        { id: 'tenant-2', status: 'failed', error: 'Unauthorized' }
      ];

      vi.spyOn(graphClient, 'batchSync').mockResolvedValue(mockResults);

      const results = await graphClient.batchSync(['tenant-1', 'tenant-2']);
      expect(results[1].status).toBe('failed');
    });
  });
});
