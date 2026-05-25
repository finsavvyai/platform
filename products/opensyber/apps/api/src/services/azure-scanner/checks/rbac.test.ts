import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runAzureRbacChecks } from './rbac.js';

const mockFetch = vi.fn();
global.fetch = mockFetch;

const SUB_ID = 'sub-12345678-abcd-1234-efgh-123456789abc';

describe('Azure RBAC Checks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  it('should return findings for Owner role at subscription scope', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        value: [
          {
            id: '/subscriptions/sub-id/providers/Microsoft.Authorization/roleAssignments/ra-1',
            properties: {
              roleDefinitionId: `/subscriptions/${SUB_ID}/providers/Microsoft.Authorization/roleDefinitions/8e3af657-a8ff-443c-a75c-2fe8c4bcb635`,
              principalId: 'user-principal-1',
              principalType: 'User',
              scope: `/subscriptions/${SUB_ID}`,
            },
          },
        ],
      }),
    } as Response);

    const findings = await runAzureRbacChecks('test-token', SUB_ID);

    expect(findings).toHaveLength(1);
    expect(findings[0].checkId).toBe('azure-rbac-broad-role');
    expect(findings[0].severity).toBe('high');
    expect(findings[0].title).toContain('Owner');
  });

  it('should return findings for Contributor role at subscription scope', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        value: [
          {
            id: '/subscriptions/sub-id/providers/Microsoft.Authorization/roleAssignments/ra-2',
            properties: {
              roleDefinitionId: `/subscriptions/${SUB_ID}/providers/Microsoft.Authorization/roleDefinitions/b24988ac-6180-42a0-ab88-20f7382dd24c`,
              principalId: 'sp-principal-1',
              principalType: 'ServicePrincipal',
              scope: `/subscriptions/${SUB_ID}`,
            },
          },
        ],
      }),
    } as Response);

    const findings = await runAzureRbacChecks('test-token', SUB_ID);

    expect(findings).toHaveLength(1);
    expect(findings[0].title).toContain('Contributor');
    expect(findings[0].description).toContain('ServicePrincipal');
  });

  it('should ignore broad roles at resource group scope', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        value: [
          {
            id: '/subscriptions/sub-id/resourceGroups/rg-1/providers/Microsoft.Authorization/roleAssignments/ra-3',
            properties: {
              roleDefinitionId: `/subscriptions/${SUB_ID}/providers/Microsoft.Authorization/roleDefinitions/8e3af657-a8ff-443c-a75c-2fe8c4bcb635`,
              principalId: 'user-principal-2',
              scope: `/subscriptions/${SUB_ID}/resourceGroups/rg-1`,
            },
          },
        ],
      }),
    } as Response);

    const findings = await runAzureRbacChecks('test-token', SUB_ID);
    expect(findings).toHaveLength(0);
  });

  it('should ignore non-broad roles at subscription scope', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        value: [
          {
            id: '/subscriptions/sub-id/providers/Microsoft.Authorization/roleAssignments/ra-4',
            properties: {
              roleDefinitionId: `/subscriptions/${SUB_ID}/providers/Microsoft.Authorization/roleDefinitions/acdd72a7-3385-48ef-bd42-f606fba81ae7`,
              principalId: 'reader-principal',
              scope: `/subscriptions/${SUB_ID}`,
            },
          },
        ],
      }),
    } as Response);

    const findings = await runAzureRbacChecks('test-token', SUB_ID);
    expect(findings).toHaveLength(0);
  });

  it('should handle API errors gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: async () => '{"error":"AuthorizationFailed"}',
    } as Response);

    const findings = await runAzureRbacChecks('test-token', SUB_ID);

    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('low');
    expect(findings[0].title).toContain('Could not check');
  });

  it('should handle empty role assignments', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ value: [] }),
    } as Response);

    const findings = await runAzureRbacChecks('test-token', SUB_ID);
    expect(findings).toHaveLength(0);
  });
});
