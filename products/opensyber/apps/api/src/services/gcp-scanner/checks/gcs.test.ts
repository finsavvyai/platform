import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runGcpGcsChecks } from './gcs.js';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('GCP GCS Checks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  it('should return critical finding for bucket without public access prevention', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [
          {
            name: 'my-public-bucket',
            iamConfiguration: {
              publicAccessPrevention: 'inherited',
              uniformBucketLevelAccess: { enabled: true },
            },
          },
        ],
      }),
    } as Response);

    const findings = await runGcpGcsChecks('test-token', 'my-project');

    const publicFindings = findings.filter((f) => f.checkId === 'gcp-gcs-public-bucket');
    expect(publicFindings).toHaveLength(1);
    expect(publicFindings[0].severity).toBe('critical');
    expect(publicFindings[0].resourceId).toBe('my-public-bucket');
  });

  it('should return no public-access finding for enforced bucket', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [
          {
            name: 'secure-bucket',
            iamConfiguration: {
              publicAccessPrevention: 'enforced',
              uniformBucketLevelAccess: { enabled: true },
            },
          },
        ],
      }),
    } as Response);

    const findings = await runGcpGcsChecks('test-token', 'my-project');
    expect(findings).toHaveLength(0);
  });

  it('should return medium finding for bucket without uniform access', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [
          {
            name: 'acl-bucket',
            iamConfiguration: {
              publicAccessPrevention: 'enforced',
              uniformBucketLevelAccess: { enabled: false },
            },
          },
        ],
      }),
    } as Response);

    const findings = await runGcpGcsChecks('test-token', 'my-project');

    const uniformFindings = findings.filter((f) => f.checkId === 'gcp-gcs-uniform-access');
    expect(uniformFindings).toHaveLength(1);
    expect(uniformFindings[0].severity).toBe('medium');
  });

  it('should handle multiple buckets with mixed configurations', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [
          {
            name: 'secure-bucket',
            iamConfiguration: {
              publicAccessPrevention: 'enforced',
              uniformBucketLevelAccess: { enabled: true },
            },
          },
          {
            name: 'insecure-bucket',
            iamConfiguration: {
              publicAccessPrevention: 'inherited',
              uniformBucketLevelAccess: { enabled: false },
            },
          },
        ],
      }),
    } as Response);

    const findings = await runGcpGcsChecks('test-token', 'my-project');

    // insecure bucket: 1 public + 1 uniform = 2 findings
    expect(findings).toHaveLength(2);
  });

  it('should handle API errors gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: async () => '{"error":"access_denied"}',
    } as Response);

    const findings = await runGcpGcsChecks('test-token', 'my-project');

    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('low');
    expect(findings[0].title).toContain('Could not check');
  });

  it('should handle empty bucket list', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [] }),
    } as Response);

    const findings = await runGcpGcsChecks('test-token', 'my-project');
    expect(findings).toHaveLength(0);
  });
});
