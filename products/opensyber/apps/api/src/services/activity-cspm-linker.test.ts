import { describe, it, expect, vi, beforeEach } from 'vitest';
import { findRelatedFindings } from './activity-cspm-linker.js';
import { createMockDb } from '../test/helpers.js';

// Mock helper for creating agent activity
function createMockActivity(overrides: Partial<typeof mockActivity> = {}): typeof mockActivity {
  return { ...mockActivity, ...overrides };
}

const mockActivity = {
  id: 'activity-1',
  userId: 'user-123',
  orgId: 'org-123',
  sessionId: 'session-1',
  agent: 'cline',
  type: 'bash_exec' as const,
  risk: 'high' as const,
  path: '/home/user/.aws/credentials',
  summary: 'aws s3 ls',
  secretsCount: 0,
  createdAt: '2025-03-04T00:00:00.000Z',
};

describe('Activity-CSPM Linker', () => {
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
  });

  describe('Strategy 1: AWS credentials file access', () => {
    it('should return IAM findings when accessing .aws/credentials', async () => {
      const activity = createMockActivity({
        type: 'file_read',
        path: '/home/user/.aws/credentials',
      });

      // Strategy 1 returns IDs, Strategy 3 returns nothing
      const strategy1Ids = [{ id: 'finding-1' }, { id: 'finding-2' }];
      const finalFindings = [
        { id: 'finding-1', severity: 'high', resourceId: 'user-123', resourceType: 'iam-user', title: 'IAM User' },
        { id: 'finding-2', severity: 'medium', resourceId: 'role-456', resourceType: 'iam-role', title: 'IAM Role' },
      ];
      mockDb._setSelectResults([strategy1Ids, finalFindings]);

      const results = await findRelatedFindings(mockDb as any, activity as any, 'org-123');

      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('finding-1');
      expect(results[0].resourceType).toContain('iam');
    });

    it('should return empty for non-credentials files', async () => {
      const activity = createMockActivity({
        type: 'file_read',
        path: '/home/user/config.json',
      });

      mockDb._setSelectResults([[], []]);

      const results = await findRelatedFindings(mockDb as any, activity as any, 'org-123');

      expect(results).toHaveLength(0);
    });
  });

  describe('Strategy 2: AWS CLI commands', () => {
    it('should return S3 findings for aws s3 commands', async () => {
      const activity = createMockActivity({
        type: 'bash_exec',
        summary: 'aws s3 ls s3://my-bucket',
      });

      const strategy2Ids = [{ id: 'finding-s3-1' }];
      const finalFindings = [
        { id: 'finding-s3-1', severity: 'high', resourceId: 'my-bucket', resourceType: 's3-bucket', title: 'S3 Bucket' },
      ];
      mockDb._setSelectResults([strategy2Ids, [], finalFindings]);

      const results = await findRelatedFindings(mockDb as any, activity as any, 'org-123');

      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].resourceType).toContain('s3');
    });

    it('should return empty for non-AWS commands', async () => {
      const activity = createMockActivity({
        type: 'bash_exec',
        summary: 'git status',
      });

      mockDb._setSelectResults([[]]);

      const results = await findRelatedFindings(mockDb as any, activity as any, 'org-123');

      expect(results).toHaveLength(0);
    });
  });

  describe('Strategy 3: Resource ID extraction', () => {
    it('should match security group IDs (sg-xxx)', async () => {
      const activity = createMockActivity({
        type: 'bash_exec',
        summary: 'Authorize security group sg-123abc',
      });

      const strategy3Ids = [{ id: 'finding-sg-1' }];
      const finalFindings = [
        { id: 'finding-sg-1', severity: 'critical', resourceId: 'sg-123abc', resourceType: 'security-group', title: 'SG Open' },
      ];
      mockDb._setSelectResults([strategy3Ids, finalFindings]);

      const results = await findRelatedFindings(mockDb as any, activity as any, 'org-123');

      expect(results).toHaveLength(1);
      expect(results[0].resourceId).toBe('sg-123abc');
    });

    it('should match S3 bucket URIs (s3://xxx)', async () => {
      const activity = createMockActivity({
        type: 'bash_exec',
        summary: 'List objects in s3://my-data-bucket/',
      });

      const strategy3Ids = [{ id: 'finding-s3-1' }];
      const finalFindings = [
        { id: 'finding-s3-1', severity: 'medium', resourceId: 'my-data-bucket', resourceType: 's3-bucket', title: 'S3 Public' },
      ];
      mockDb._setSelectResults([strategy3Ids, finalFindings]);

      const results = await findRelatedFindings(mockDb as any, activity as any, 'org-123');

      expect(results).toHaveLength(1);
    });

    it('should return empty when no resource IDs found', async () => {
      const activity = createMockActivity({
        type: 'bash_exec',
        summary: 'Run some random command',
      });

      mockDb._setSelectResults([[]]);

      const results = await findRelatedFindings(mockDb as any, activity as any, 'org-123');

      expect(results).toHaveLength(0);
    });
  });

  describe('Strategy 4: Secrets detection', () => {
    it('should return IAM access key findings when secrets detected', async () => {
      const activity = createMockActivity({
        secretsCount: 3,
        summary: 'Bash command with secret',
      });

      const strategy4Ids = [{ id: 'finding-key-1' }];
      const finalFindings = [
        { id: 'finding-key-1', severity: 'critical', resourceId: 'AKIAIOSFODNN7EXAMPLE', resourceType: 'iam-access-key', title: 'Access Key Exposed' },
      ];
      mockDb._setSelectResults([strategy4Ids, finalFindings]);

      const results = await findRelatedFindings(mockDb as any, activity as any, 'org-123');

      expect(results).toHaveLength(1);
    });

    it('should return empty when no secrets detected', async () => {
      const activity = createMockActivity({
        secretsCount: 0,
      });

      mockDb._setSelectResults([[]]);

      const results = await findRelatedFindings(mockDb as any, activity as any, 'org-123');

      expect(results).toHaveLength(0);
    });
  });

  describe('Integration: Multiple strategies', () => {
    it('should combine results from multiple strategies', async () => {
      const activity = createMockActivity({
        type: 'bash_exec',
        summary: 'aws s3 ls s3://my-bucket',
        secretsCount: 2,
      });

      // Multiple strategies return IDs
      const strategy2Ids = [{ id: 'finding-1' }];
      const strategy3Ids = [{ id: 'finding-2' }];
      const strategy4Ids = [{ id: 'finding-3' }];
      const finalFindings = [
        { id: 'finding-1', severity: 'high', resourceId: 'my-bucket', resourceType: 's3-bucket', title: 'S3 Finding' },
        { id: 'finding-2', severity: 'medium', resourceId: 'my-bucket', resourceType: 's3-bucket', title: 'S3 Finding 2' },
        { id: 'finding-3', severity: 'critical', resourceId: 'AKIAIOSFODNN7', resourceType: 'iam-access-key', title: 'Key Exposed' },
      ];
      mockDb._setSelectResults([strategy2Ids, strategy3Ids, strategy4Ids, finalFindings]);

      const results = await findRelatedFindings(mockDb as any, activity as any, 'org-123');

      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it('should limit results to 5 findings max', async () => {
      const activity = createMockActivity({
        type: 'file_read',
        path: '/home/user/.aws/credentials',
      });

      // Strategy returns 7 IDs but final query should only return 5
      const strategy1Ids = Array.from({ length: 7 }, (_, i) => ({ id: `finding-${i}` }));
      const finalFindings = Array.from({ length: 5 }, (_, i) => ({
        id: `finding-${i}`,
        severity: 'high',
        resourceId: `resource-${i}`,
        resourceType: 'iam-user',
        title: `Finding ${i}`,
      }));
      mockDb._setSelectResults([strategy1Ids, finalFindings]);

      const results = await findRelatedFindings(mockDb as any, activity as any, 'org-123');

      expect(results.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Edge cases', () => {
    it('should handle null orgId', async () => {
      const activity = createMockActivity({
        type: 'bash_exec',
        summary: 'aws s3 ls',
      });

      mockDb._setSelectResults([[]]);

      const results = await findRelatedFindings(mockDb as any, activity as any, null);

      expect(Array.isArray(results)).toBe(true);
      expect(results).toHaveLength(0);
    });

    it('should handle empty summary', async () => {
      const activity = createMockActivity({
        type: 'bash_exec',
        summary: '',
      });

      mockDb._setSelectResults([[]]);

      const results = await findRelatedFindings(mockDb as any, activity as any, 'org-123');

      expect(results).toHaveLength(0);
    });

    it('should handle null path', async () => {
      const activity = createMockActivity({
        type: 'file_read',
        path: null,
      });

      mockDb._setSelectResults([[], []]);

      const results = await findRelatedFindings(mockDb as any, activity as any, 'org-123');

      expect(results).toHaveLength(0);
    });
  });
});
