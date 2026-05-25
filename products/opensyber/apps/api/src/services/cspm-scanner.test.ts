import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runCspmScan } from './cspm-scanner.js';
import type { CloudAccountRecord } from './cspm-scanner.js';

// Mock scanners
vi.mock('./aws-scanner/orchestrator.js', () => ({
  runAwsScan: vi.fn(),
}));

vi.mock('./gcp-scanner/orchestrator.js', () => ({
  runGcpScan: vi.fn(),
}));

vi.mock('./azure-scanner/orchestrator.js', () => ({
  runAzureScan: vi.fn(),
}));

// Mock decryptCredentials to return input as-is (tests provide plaintext JSON)
vi.mock('./cspm-scanner-types.js', async (importOriginal) => {
  const mod = await importOriginal<typeof import('./cspm-scanner-types.js')>();
  return { ...mod, decryptCredentials: vi.fn(async (val: string) => val) };
});

const { runAwsScan } = await import('./aws-scanner/orchestrator.js');
const { runGcpScan } = await import('./gcp-scanner/orchestrator.js');
const { runAzureScan } = await import('./azure-scanner/orchestrator.js');
const TEST_ENCRYPTION_KEY = 'test-encryption-key-for-cspm';

// Helper to create mock DB
function createMockDb() {
  const mockValues = vi.fn().mockResolvedValue(undefined);
  const mockWhere = vi.fn().mockReturnValue({ values: mockValues });
  const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
  const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });
  const mockInsert = vi.fn().mockReturnValue({ values: mockValues });

  return {
    insert: mockInsert,
    update: mockUpdate,
  } as unknown as ReturnType<typeof createMockDb>;
}

describe('CSPM Scanner', () => {
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
  });

  const baseAccount: CloudAccountRecord = {
    id: 'ca-test',
    provider: 'aws',
    roleArn: 'arn:aws:iam::123456789012:role/OpenSyberScanRole',
    externalId: 'external-123',
    credentials: JSON.stringify({
      accessKeyId: 'AKIATEST',
      secretAccessKey: 'test-secret',
    }),
  };

  describe('runCspmScan', () => {
    it('should delegate to AWS scanner for AWS provider', async () => {
      vi.mocked(runAwsScan).mockResolvedValue({
        scanRunId: 'scan-123',
        status: 'completed',
        findingCount: 5,
        criticalCount: 1,
        highCount: 2,
        mediumCount: 1,
        lowCount: 1,
      });

      const result = await runCspmScan(mockDb as any, 'ca-test', 'org-123', baseAccount, TEST_ENCRYPTION_KEY);

      expect(result.error).toBeUndefined();
      expect(result.scanRun.id).toBe('scan-123');
      expect(result.scanRun.status).toBe('completed');
      expect(result.scanRun.findingCount).toBe(5);
      expect(result.scanRun.criticalCount).toBe(1);
      expect(result.scanRun.highCount).toBe(2);
      expect(runAwsScan).toHaveBeenCalledWith(
        expect.objectContaining({
          cloudAccountId: 'ca-test',
          orgId: 'org-123',
          roleArn: baseAccount.roleArn,
          externalId: baseAccount.externalId,
          credentials: expect.objectContaining({
            accessKeyId: 'AKIATEST',
          }),
        }),
      );
    });

    it('should delegate to GCP scanner for GCP provider', async () => {
      vi.mocked(runGcpScan).mockResolvedValue({
        status: 'completed',
        findings: [],
        findingCount: 3,
        criticalCount: 1,
        highCount: 1,
        mediumCount: 1,
        lowCount: 0,
      });

      const gcpAccount: CloudAccountRecord = {
        ...baseAccount,
        provider: 'gcp',
        externalId: 'my-gcp-project',
        credentials: JSON.stringify({ serviceAccountKey: '{"client_email":"test@proj.iam.gserviceaccount.com","private_key":"key"}' }),
      };

      const result = await runCspmScan(mockDb as any, 'ca-test', 'org-123', gcpAccount, TEST_ENCRYPTION_KEY);

      expect(result.scanRun.status).toBe('completed');
      expect(result.scanRun.findingCount).toBe(3);
      expect(runGcpScan).toHaveBeenCalled();
    });

    it('should return error for GCP without credentials', async () => {
      const gcpAccount: CloudAccountRecord = {
        ...baseAccount,
        provider: 'gcp',
        credentials: null,
      };

      const result = await runCspmScan(mockDb as any, 'ca-test', 'org-123', gcpAccount, TEST_ENCRYPTION_KEY);

      expect(result.scanRun.status).toBe('failed');
      expect(result.error).toContain('GCP account missing credentials');
    });

    it('should delegate to Azure scanner for Azure provider', async () => {
      vi.mocked(runAzureScan).mockResolvedValue({
        status: 'completed',
        findings: [],
        findingCount: 2,
        criticalCount: 1,
        highCount: 1,
        mediumCount: 0,
        lowCount: 0,
      });

      const azureAccount: CloudAccountRecord = {
        ...baseAccount,
        provider: 'azure',
        credentials: JSON.stringify({
          tenantId: 'tenant-123',
          clientId: 'client-456',
          clientSecret: 'secret-789',
          subscriptionId: 'sub-abc',
        }),
      };

      const result = await runCspmScan(mockDb as any, 'ca-test', 'org-123', azureAccount, TEST_ENCRYPTION_KEY);

      expect(result.scanRun.status).toBe('completed');
      expect(result.scanRun.findingCount).toBe(2);
      expect(runAzureScan).toHaveBeenCalled();
    });

    it('should return error for Azure without credentials', async () => {
      const azureAccount: CloudAccountRecord = {
        ...baseAccount,
        provider: 'azure',
        credentials: null,
      };

      const result = await runCspmScan(mockDb as any, 'ca-test', 'org-123', azureAccount, TEST_ENCRYPTION_KEY);

      expect(result.scanRun.status).toBe('failed');
      expect(result.error).toContain('Azure account missing credentials');
    });

    it('should return error when roleArn is missing', async () => {
      const noRoleAccount: CloudAccountRecord = {
        ...baseAccount,
        roleArn: null,
      };

      const result = await runCspmScan(mockDb as any, 'ca-test', 'org-123', noRoleAccount, TEST_ENCRYPTION_KEY);

      expect(result.scanRun.id).toBe('');
      expect(result.scanRun.status).toBe('failed');
      expect(result.error).toContain('missing roleArn');
      expect(runAwsScan).not.toHaveBeenCalled();
    });

    it('should return error when credentials are missing', async () => {
      const noCredsAccount: CloudAccountRecord = {
        ...baseAccount,
        credentials: null,
      };

      const result = await runCspmScan(mockDb as any, 'ca-test', 'org-123', noCredsAccount, TEST_ENCRYPTION_KEY);

      expect(result.scanRun.id).toBe('');
      expect(result.scanRun.status).toBe('failed');
      expect(result.error).toContain('missing credentials');
      expect(runAwsScan).not.toHaveBeenCalled();
    });

    it('should return error when credentials are invalid JSON', async () => {
      const invalidCredsAccount: CloudAccountRecord = {
        ...baseAccount,
        credentials: 'not-valid-json',
      };

      const result = await runCspmScan(mockDb as any, 'ca-test', 'org-123', invalidCredsAccount, TEST_ENCRYPTION_KEY);

      expect(result.scanRun.id).toBe('');
      expect(result.scanRun.status).toBe('failed');
      expect(result.error).toContain('Failed to decrypt');
      expect(runAwsScan).not.toHaveBeenCalled();
    });

    it('should return error when credentials lack access key ID', async () => {
      const incompleteCredsAccount: CloudAccountRecord = {
        ...baseAccount,
        credentials: JSON.stringify({ secretAccessKey: 'test' }),
      };

      const result = await runCspmScan(mockDb as any, 'ca-test', 'org-123', incompleteCredsAccount, TEST_ENCRYPTION_KEY);

      expect(result.scanRun.id).toBe('');
      expect(result.scanRun.status).toBe('failed');
      expect(result.error).toContain('missing credentials');
      expect(runAwsScan).not.toHaveBeenCalled();
    });

    it('should propagate AWS scanner errors', async () => {
      vi.mocked(runAwsScan).mockResolvedValue({
        scanRunId: '',
        status: 'failed',
        findingCount: 0,
        criticalCount: 0,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0,
        error: 'STS AssumeRole failed: Invalid credentials',
      });

      const result = await runCspmScan(mockDb as any, 'ca-test', 'org-123', baseAccount, TEST_ENCRYPTION_KEY);

      expect(result.scanRun.id).toBe('');
      expect(result.scanRun.status).toBe('failed');
      expect(result.error).toBe('STS AssumeRole failed: Invalid credentials');
    });

    it('should work with solo user accounts (no orgId)', async () => {
      vi.mocked(runAwsScan).mockResolvedValue({
        scanRunId: 'scan-456',
        status: 'completed',
        findingCount: 2,
        criticalCount: 0,
        highCount: 1,
        mediumCount: 1,
        lowCount: 0,
      });

      const result = await runCspmScan(mockDb as any, 'ca-test', null, baseAccount, TEST_ENCRYPTION_KEY);

      expect(result.error).toBeUndefined();
      expect(result.scanRun.id).toBe('scan-456');
      expect(runAwsScan).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: null,
        }),
      );
    });

    it('should handle null externalId', async () => {
      vi.mocked(runAwsScan).mockResolvedValue({
        scanRunId: 'scan-789',
        status: 'completed',
        findingCount: 0,
        criticalCount: 0,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0,
      });

      const noExternalIdAccount: CloudAccountRecord = {
        ...baseAccount,
        externalId: null,
      };

      const result = await runCspmScan(mockDb as any, 'ca-test', 'org-123', noExternalIdAccount, TEST_ENCRYPTION_KEY);

      expect(result.error).toBeUndefined();
      expect(result.scanRun.status).toBe('completed');
      expect(runAwsScan).toHaveBeenCalledWith(
        expect.objectContaining({
          externalId: undefined,
        }),
      );
    });

    it('should handle empty string roleArn', async () => {
      const emptyRoleArnAccount: CloudAccountRecord = {
        ...baseAccount,
        roleArn: '',
      };

      const result = await runCspmScan(mockDb as any, 'ca-test', 'org-123', emptyRoleArnAccount, TEST_ENCRYPTION_KEY);

      expect(result.scanRun.id).toBe('');
      expect(result.scanRun.status).toBe('failed');
      expect(result.error).toContain('missing roleArn');
      expect(runAwsScan).not.toHaveBeenCalled();
    });

    it('should handle empty string credentials', async () => {
      const emptyCredsAccount: CloudAccountRecord = {
        ...baseAccount,
        credentials: '',
      };

      const result = await runCspmScan(mockDb as any, 'ca-test', 'org-123', emptyCredsAccount, TEST_ENCRYPTION_KEY);

      expect(result.scanRun.id).toBe('');
      expect(result.scanRun.status).toBe('failed');
      // Empty string parses to {}, which fails the access key check
      expect(result.error).toContain('missing credentials');
      expect(runAwsScan).not.toHaveBeenCalled();
    });
  });
});
