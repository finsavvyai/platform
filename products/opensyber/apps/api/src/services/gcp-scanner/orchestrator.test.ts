import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runGcpScan, type GcpScanConfig } from './orchestrator.js';

vi.mock('./gcp-auth.js', () => ({
  getGcpAccessToken: vi.fn(() => Promise.resolve('ya29.mock-token')),
}));

const mockIamChecks = vi.fn(() => Promise.resolve([
  {
    checkId: 'gcp-iam-broad-role',
    severity: 'high' as const,
    resourceId: 'admin@project.iam.gserviceaccount.com',
    resourceType: 'gcp-iam-binding',
    region: 'global',
    title: 'Service account has overly broad role: roles/owner',
    description: 'Test finding',
    remediation: 'Use fine-grained roles',
  },
]));

const mockGcsChecks = vi.fn(() => Promise.resolve([
  {
    checkId: 'gcp-gcs-public-bucket',
    severity: 'critical' as const,
    resourceId: 'public-bucket',
    resourceType: 'gcs-bucket',
    region: 'global',
    title: 'GCS bucket public access prevention not enforced',
    description: 'Test finding',
    remediation: 'Enforce public access prevention',
  },
]));

vi.mock('./checks/iam.js', () => ({
  runGcpIamChecks: (...args: unknown[]) => mockIamChecks(...args),
}));

vi.mock('./checks/gcs.js', () => ({
  runGcpGcsChecks: (...args: unknown[]) => mockGcsChecks(...args),
}));

describe('GCP Scanner Orchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should complete scan with findings from all checks', async () => {
    const config: GcpScanConfig = {
      serviceAccountKey: '{"client_email":"test@proj.iam.gserviceaccount.com","private_key":"key"}',
      projectId: 'my-project',
    };

    const result = await runGcpScan(config);

    expect(result.status).toBe('completed');
    expect(result.findingCount).toBe(2);
    expect(result.criticalCount).toBe(1);
    expect(result.highCount).toBe(1);
    expect(result.findings).toHaveLength(2);
  });

  it('should fail with missing config', async () => {
    const result = await runGcpScan({ serviceAccountKey: '', projectId: '' });

    expect(result.status).toBe('failed');
    expect(result.error).toContain('Missing');
    expect(result.findingCount).toBe(0);
  });

  it('should fail when authentication fails', async () => {
    const { getGcpAccessToken } = await import('./gcp-auth.js');
    vi.mocked(getGcpAccessToken).mockRejectedValueOnce(new Error('Auth failed'));

    const config: GcpScanConfig = {
      serviceAccountKey: '{"client_email":"test@proj.iam.gserviceaccount.com","private_key":"key"}',
      projectId: 'my-project',
    };

    const result = await runGcpScan(config);

    expect(result.status).toBe('failed');
    expect(result.error).toContain('GCP authentication failed');
  });

  it('should handle partial check failures gracefully', async () => {
    mockIamChecks.mockRejectedValueOnce(new Error('IAM check crashed'));
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const config: GcpScanConfig = {
      serviceAccountKey: '{"client_email":"test@proj.iam.gserviceaccount.com","private_key":"key"}',
      projectId: 'my-project',
    };

    const result = await runGcpScan(config);

    expect(result.status).toBe('completed');
    expect(result.findingCount).toBe(1);
    expect(result.criticalCount).toBe(1);
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it('should return zero counts when no findings', async () => {
    mockIamChecks.mockResolvedValueOnce([]);
    mockGcsChecks.mockResolvedValueOnce([]);

    const config: GcpScanConfig = {
      serviceAccountKey: '{"client_email":"test@proj.iam.gserviceaccount.com","private_key":"key"}',
      projectId: 'my-project',
    };

    const result = await runGcpScan(config);

    expect(result.status).toBe('completed');
    expect(result.findingCount).toBe(0);
    expect(result.criticalCount).toBe(0);
    expect(result.highCount).toBe(0);
    expect(result.mediumCount).toBe(0);
    expect(result.lowCount).toBe(0);
  });
});
