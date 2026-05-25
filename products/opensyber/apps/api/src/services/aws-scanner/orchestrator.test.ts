import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runAwsScan, validateAwsConfig, type AwsScanConfig } from './orchestrator.js';
import type { DrizzleD1Database } from 'drizzle-orm/d1';

// Mock all the check modules
const mockListS3Buckets = vi.fn(() => Promise.resolve([]));
const mockS3Checks = vi.fn(() => Promise.resolve([]));
const mockIAMChecks = vi.fn(() => Promise.resolve([]));
const mockEC2Checks = vi.fn(() => Promise.resolve([
  {
    checkId: 'ec2-security-group-ssh-open',
    severity: 'high',
    resourceId: 'sg-12345678',
    resourceType: 'security-group',
    region: 'us-east-1',
    title: 'SSH open to world',
    description: 'Security group allows SSH from 0.0.0.0/0',
    remediation: 'Restrict SSH access to specific IPs',
  },
]));
const mockRDSChecks = vi.fn(() => Promise.resolve([
  {
    checkId: 'rds-instance-unencrypted',
    severity: 'high',
    resourceId: 'db-prod',
    resourceType: 'rds-instance',
    region: 'us-east-1',
    title: 'RDS not encrypted',
    description: 'RDS instance has storage encryption disabled',
    remediation: 'Enable encryption at rest',
  },
]));
const mockCloudTrailChecks = vi.fn(() => Promise.resolve([
  {
    checkId: 'cloudtrail-not-multi-region',
    severity: 'medium',
    resourceId: '123456789012',
    resourceType: 'cloudtrail',
    region: 'us-east-1',
    title: 'CloudTrail not multi-region',
    description: 'No multi-region trail configured',
    remediation: 'Enable multi-region CloudTrail',
  },
]));
const mockGuardDutyChecks = vi.fn(() => Promise.resolve([
  {
    checkId: 'guardduty-not-enabled',
    severity: 'critical',
    resourceId: '123456789012',
    resourceType: 'account',
    region: 'us-east-1',
    title: 'GuardDuty not enabled',
    description: 'GuardDuty is not enabled in this account',
    remediation: 'Enable GuardDuty',
  },
]));

vi.mock('./checks/s3.js', () => ({
  listS3Buckets: () => mockListS3Buckets(),
  runS3Checks: () => mockS3Checks(),
}));

vi.mock('./checks/iam.js', () => ({
  runIAMChecks: () => mockIAMChecks(),
}));

vi.mock('./checks/ec2.js', () => ({
  runEC2Checks: () => mockEC2Checks(),
}));

vi.mock('./checks/rds.js', () => ({
  runRDSChecks: () => mockRDSChecks(),
}));

vi.mock('./checks/cloudtrail.js', () => ({
  runCloudTrailChecks: () => mockCloudTrailChecks(),
}));

vi.mock('./checks/guardduty.js', () => ({
  runGuardDutyChecks: () => mockGuardDutyChecks(),
}));

vi.mock('./checks/lambda.js', () => ({
  runLambdaChecks: () => Promise.resolve([]),
}));

vi.mock('./checks/kms.js', () => ({
  runKMSChecks: () => Promise.resolve([]),
}));

vi.mock('./checks/vpc.js', () => ({
  runVPCChecks: () => Promise.resolve([]),
}));

// Mock STS client
vi.mock('./sts-client.js', () => ({
  assumeRoleFromConfig: vi.fn(() => Promise.resolve({
    credentials: {
      accessKeyId: 'ASIATEST',
      secretAccessKey: 'test-secret',
      sessionToken: 'test-token',
      expiration: '2025-03-04T12:00:00Z',
    },
    assumedRoleId: 'AROATEST:test-session',
    account: '123456789012',
    arn: 'arn:aws:iam::123456789012:assumed-role/test-role/test-session',
  })),
}));

vi.mock('../asset-discovery/hooks.js', () => ({
  discoverAfterCspmScan: vi.fn(async () => undefined),
}));

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
    _mockSet: mockSet,
    _mockWhere: mockWhere,
    _mockValues: mockValues,
  } as unknown as DrizzleD1Database<Record<string, unknown>>;
}

describe('AWS Scanner Orchestrator', () => {
  let mockDb: DrizzleD1Database<Record<string, unknown>>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();

    // Reset check module mocks
    mockListS3Buckets.mockResolvedValue([]);
    mockS3Checks.mockResolvedValue([]);
    mockIAMChecks.mockResolvedValue([]);
    mockEC2Checks.mockResolvedValue([
      {
        checkId: 'ec2-security-group-ssh-open',
        severity: 'high',
        resourceId: 'sg-12345678',
        resourceType: 'security-group',
        region: 'us-east-1',
        title: 'SSH open to world',
        description: 'Security group allows SSH from 0.0.0.0/0',
        remediation: 'Restrict SSH access to specific IPs',
      },
    ]);
    mockRDSChecks.mockResolvedValue([
      {
        checkId: 'rds-instance-unencrypted',
        severity: 'high',
        resourceId: 'db-prod',
        resourceType: 'rds-instance',
        region: 'us-east-1',
        title: 'RDS not encrypted',
        description: 'RDS instance has storage encryption disabled',
        remediation: 'Enable encryption at rest',
      },
    ]);
    mockCloudTrailChecks.mockResolvedValue([
      {
        checkId: 'cloudtrail-not-multi-region',
        severity: 'medium',
        resourceId: '123456789012',
        resourceType: 'cloudtrail',
        region: 'us-east-1',
        title: 'CloudTrail not multi-region',
        description: 'No multi-region trail configured',
        remediation: 'Enable multi-region CloudTrail',
      },
    ]);
    mockGuardDutyChecks.mockResolvedValue([
      {
        checkId: 'guardduty-not-enabled',
        severity: 'critical',
        resourceId: '123456789012',
        resourceType: 'account',
        region: 'us-east-1',
        title: 'GuardDuty not enabled',
        description: 'GuardDuty is not enabled in this account',
        remediation: 'Enable GuardDuty',
      },
    ]);
  });

  describe('validateAwsConfig', () => {
    it('should validate correct role ARN', () => {
      const result = validateAwsConfig({
        roleArn: 'arn:aws:iam::123456789012:role/OpenSyberScanRole',
      });
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject missing role ARN', () => {
      const result = validateAwsConfig({ roleArn: '' });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Missing roleArn');
    });

    it('should reject invalid role ARN format', () => {
      const result = validateAwsConfig({
        roleArn: 'not-an-arn',
      });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid roleArn format');
    });

    it('should reject role ARN with wrong format', () => {
      const result = validateAwsConfig({
        roleArn: 'arn:aws:iam::123456789012:user/test',
      });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid roleArn format');
    });
  });

  describe('runAwsScan', () => {
    it('should fail with missing credentials', async () => {
      const config: AwsScanConfig = {
        db: mockDb,
        cloudAccountId: 'ca-test',
        orgId: 'org-test',
        roleArn: 'arn:aws:iam::123456789012:role/OpenSyberScanRole',
      };

      const result = await runAwsScan(config);

      expect(result.status).toBe('failed');
      expect(result.error).toBe('Missing AWS credentials for STS AssumeRole');
      expect(result.scanRunId).toBe('');
    });

    it('should fail with invalid role ARN', async () => {
      const config: AwsScanConfig = {
        db: mockDb,
        cloudAccountId: 'ca-test',
        orgId: 'org-test',
        roleArn: 'invalid-arn',
        credentials: {
          accessKeyId: 'AKIATEST',
          secretAccessKey: 'test-secret',
        },
      };

      const result = await runAwsScan(config);

      expect(result.status).toBe('failed');
      expect(result.error).toBe('Invalid role ARN format');
    });

    it('should complete scan with findings', async () => {
      const config: AwsScanConfig = {
        db: mockDb,
        cloudAccountId: 'ca-test',
        orgId: 'org-test',
        roleArn: 'arn:aws:iam::123456789012:role/OpenSyberScanRole',
        credentials: {
          accessKeyId: 'AKIATEST',
          secretAccessKey: 'test-secret',
        },
      };

      const result = await runAwsScan(config);

      expect(result.status).toBe('completed');
      expect(result.scanRunId).toBeTruthy();
      expect(result.findingCount).toBe(4); // 1 EC2 + 1 RDS + 1 CloudTrail + 1 GuardDuty
      expect(result.criticalCount).toBe(1);
      expect(result.highCount).toBe(2);
      expect(result.mediumCount).toBe(1);
      expect(result.lowCount).toBe(0);
    });

    it('should handle partial check failures gracefully', async () => {
      // Make IAM check fail
      mockIAMChecks.mockRejectedValueOnce(new Error('IAM check failed'));
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const config: AwsScanConfig = {
        db: mockDb,
        cloudAccountId: 'ca-test',
        orgId: 'org-test',
        roleArn: 'arn:aws:iam::123456789012:role/OpenSyberScanRole',
        credentials: {
          accessKeyId: 'AKIATEST',
          secretAccessKey: 'test-secret',
        },
      };

      const result = await runAwsScan(config);

      // Scan should still complete with findings from successful checks
      expect(result.status).toBe('completed');
      expect(result.findingCount).toBeGreaterThan(0);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Check module failed:',
        expect.any(Error),
      );
    });
  });
});
