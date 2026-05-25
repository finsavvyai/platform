import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runAzureStorageChecks } from './storage.js';

const mockFetch = vi.fn();
global.fetch = mockFetch;

const SUB_ID = 'sub-12345678-abcd-1234-efgh-123456789abc';

describe('Azure Storage Checks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  it('should return critical finding for public blob access enabled', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        value: [
          {
            id: `/subscriptions/${SUB_ID}/resourceGroups/rg-1/providers/Microsoft.Storage/storageAccounts/publicstore`,
            name: 'publicstore',
            location: 'eastus',
            properties: {
              allowBlobPublicAccess: true,
              supportsHttpsTrafficOnly: true,
            },
          },
        ],
      }),
    } as Response);

    const findings = await runAzureStorageChecks('test-token', SUB_ID);

    const publicFindings = findings.filter((f) => f.checkId === 'azure-storage-public-access');
    expect(publicFindings).toHaveLength(1);
    expect(publicFindings[0].severity).toBe('critical');
    expect(publicFindings[0].resourceId).toBe('publicstore');
    expect(publicFindings[0].region).toBe('eastus');
  });

  it('should return no finding for storage account with public access disabled', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        value: [
          {
            id: `/subscriptions/${SUB_ID}/resourceGroups/rg-1/providers/Microsoft.Storage/storageAccounts/securestore`,
            name: 'securestore',
            location: 'westus2',
            properties: {
              allowBlobPublicAccess: false,
              supportsHttpsTrafficOnly: true,
            },
          },
        ],
      }),
    } as Response);

    const findings = await runAzureStorageChecks('test-token', SUB_ID);
    expect(findings).toHaveLength(0);
  });

  it('should return high finding for storage allowing non-HTTPS traffic', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        value: [
          {
            id: `/subscriptions/${SUB_ID}/resourceGroups/rg-1/providers/Microsoft.Storage/storageAccounts/httpstore`,
            name: 'httpstore',
            location: 'northeurope',
            properties: {
              allowBlobPublicAccess: false,
              supportsHttpsTrafficOnly: false,
            },
          },
        ],
      }),
    } as Response);

    const findings = await runAzureStorageChecks('test-token', SUB_ID);

    const httpsFindings = findings.filter((f) => f.checkId === 'azure-storage-https-only');
    expect(httpsFindings).toHaveLength(1);
    expect(httpsFindings[0].severity).toBe('high');
    expect(httpsFindings[0].resourceId).toBe('httpstore');
  });

  it('should flag multiple issues on a single storage account', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        value: [
          {
            id: `/subscriptions/${SUB_ID}/resourceGroups/rg-1/providers/Microsoft.Storage/storageAccounts/badstore`,
            name: 'badstore',
            location: 'eastus2',
            properties: {
              allowBlobPublicAccess: true,
              supportsHttpsTrafficOnly: false,
            },
          },
        ],
      }),
    } as Response);

    const findings = await runAzureStorageChecks('test-token', SUB_ID);
    expect(findings).toHaveLength(2);
  });

  it('should handle API errors gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: async () => '{"error":"AuthorizationFailed"}',
    } as Response);

    const findings = await runAzureStorageChecks('test-token', SUB_ID);

    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('low');
    expect(findings[0].title).toContain('Could not check');
  });

  it('should handle empty storage account list', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ value: [] }),
    } as Response);

    const findings = await runAzureStorageChecks('test-token', SUB_ID);
    expect(findings).toHaveLength(0);
  });
});
