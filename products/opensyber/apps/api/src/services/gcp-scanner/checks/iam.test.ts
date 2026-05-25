import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runGcpIamChecks } from './iam.js';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('GCP IAM Checks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  it('should return findings for service accounts with Owner role', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        bindings: [
          {
            role: 'roles/owner',
            members: ['serviceAccount:admin@project.iam.gserviceaccount.com'],
          },
        ],
      }),
    } as Response);

    const findings = await runGcpIamChecks('test-token', 'my-project');

    expect(findings).toHaveLength(1);
    expect(findings[0].checkId).toBe('gcp-iam-broad-role');
    expect(findings[0].severity).toBe('high');
    expect(findings[0].resourceId).toBe('admin@project.iam.gserviceaccount.com');
  });

  it('should return findings for service accounts with Editor role', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        bindings: [
          {
            role: 'roles/editor',
            members: [
              'serviceAccount:ci@project.iam.gserviceaccount.com',
              'serviceAccount:deploy@project.iam.gserviceaccount.com',
            ],
          },
        ],
      }),
    } as Response);

    const findings = await runGcpIamChecks('test-token', 'my-project');

    expect(findings).toHaveLength(2);
    expect(findings[0].title).toContain('roles/editor');
    expect(findings[1].resourceId).toBe('deploy@project.iam.gserviceaccount.com');
  });

  it('should ignore non-service-account members with broad roles', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        bindings: [
          {
            role: 'roles/owner',
            members: ['user:admin@example.com', 'group:admins@example.com'],
          },
        ],
      }),
    } as Response);

    const findings = await runGcpIamChecks('test-token', 'my-project');
    expect(findings).toHaveLength(0);
  });

  it('should return no findings for fine-grained roles', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        bindings: [
          {
            role: 'roles/storage.objectViewer',
            members: ['serviceAccount:reader@project.iam.gserviceaccount.com'],
          },
        ],
      }),
    } as Response);

    const findings = await runGcpIamChecks('test-token', 'my-project');
    expect(findings).toHaveLength(0);
  });

  it('should handle API errors gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: async () => '{"error":"permission_denied"}',
    } as Response);

    const findings = await runGcpIamChecks('test-token', 'my-project');

    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('low');
    expect(findings[0].title).toContain('Could not check');
  });

  it('should handle empty bindings', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ bindings: [] }),
    } as Response);

    const findings = await runGcpIamChecks('test-token', 'my-project');
    expect(findings).toHaveLength(0);
  });
});
