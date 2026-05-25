import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runAzureScan, type AzureScanConfig } from './orchestrator.js';

vi.mock('./azure-auth.js', () => ({
  getAzureAccessToken: vi.fn(() => Promise.resolve('eyJ0eXAiOiJKV1QiLmock')),
}));

const mockRbacChecks = vi.fn(() => Promise.resolve([
  {
    checkId: 'azure-rbac-broad-role',
    severity: 'high' as const,
    resourceId: 'principal-123',
    resourceType: 'azure-role-assignment',
    region: 'global',
    title: 'Owner role assigned at subscription scope',
    description: 'Test finding',
    remediation: 'Use least privilege',
  },
]));

const mockStorageChecks = vi.fn(() => Promise.resolve([
  {
    checkId: 'azure-storage-public-access',
    severity: 'critical' as const,
    resourceId: 'publicstore',
    resourceType: 'azure-storage-account',
    region: 'eastus',
    title: 'Azure Storage account allows blob public access',
    description: 'Test finding',
    remediation: 'Disable public access',
  },
]));

vi.mock('./checks/rbac.js', () => ({
  runAzureRbacChecks: (...args: unknown[]) => mockRbacChecks(...args),
}));

vi.mock('./checks/storage.js', () => ({
  runAzureStorageChecks: (...args: unknown[]) => mockStorageChecks(...args),
}));

describe('Azure Scanner Orchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should complete scan with findings from all checks', async () => {
    const config: AzureScanConfig = {
      tenantId: 'tenant-123',
      clientId: 'client-456',
      clientSecret: 'secret-789',
      subscriptionId: 'sub-abc',
    };

    const result = await runAzureScan(config);

    expect(result.status).toBe('completed');
    expect(result.findingCount).toBe(2);
    expect(result.criticalCount).toBe(1);
    expect(result.highCount).toBe(1);
    expect(result.findings).toHaveLength(2);
  });

  it('should fail with missing config', async () => {
    const result = await runAzureScan({
      tenantId: '',
      clientId: '',
      clientSecret: '',
      subscriptionId: '',
    });

    expect(result.status).toBe('failed');
    expect(result.error).toContain('Missing');
    expect(result.findingCount).toBe(0);
  });

  it('should fail when authentication fails', async () => {
    const { getAzureAccessToken } = await import('./azure-auth.js');
    vi.mocked(getAzureAccessToken).mockRejectedValueOnce(new Error('Auth failed'));

    const config: AzureScanConfig = {
      tenantId: 'tenant-123',
      clientId: 'client-456',
      clientSecret: 'secret-789',
      subscriptionId: 'sub-abc',
    };

    const result = await runAzureScan(config);

    expect(result.status).toBe('failed');
    expect(result.error).toContain('Azure authentication failed');
  });

  it('should handle partial check failures gracefully', async () => {
    mockRbacChecks.mockRejectedValueOnce(new Error('RBAC check crashed'));
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const config: AzureScanConfig = {
      tenantId: 'tenant-123',
      clientId: 'client-456',
      clientSecret: 'secret-789',
      subscriptionId: 'sub-abc',
    };

    const result = await runAzureScan(config);

    expect(result.status).toBe('completed');
    expect(result.findingCount).toBe(1);
    expect(result.criticalCount).toBe(1);
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it('should return zero counts when no findings', async () => {
    mockRbacChecks.mockResolvedValueOnce([]);
    mockStorageChecks.mockResolvedValueOnce([]);

    const config: AzureScanConfig = {
      tenantId: 'tenant-123',
      clientId: 'client-456',
      clientSecret: 'secret-789',
      subscriptionId: 'sub-abc',
    };

    const result = await runAzureScan(config);

    expect(result.status).toBe('completed');
    expect(result.findingCount).toBe(0);
    expect(result.criticalCount).toBe(0);
    expect(result.highCount).toBe(0);
    expect(result.mediumCount).toBe(0);
    expect(result.lowCount).toBe(0);
  });
});
