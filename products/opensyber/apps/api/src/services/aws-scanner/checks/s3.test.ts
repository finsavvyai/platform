import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runS3Checks, checkS3PublicAcl, checkS3Encryption, checkS3Versioning } from './s3.js';
import type { ScanContext } from '../types.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('s3 checks', () => {
  let mockContext: ScanContext;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();

    mockContext = {
      accountId: '123456789012',
      region: 'us-east-1',
      credentials: {
        accessKeyId: 'ASIATEST',
        secretAccessKey: 'test-secret',
        sessionToken: 'test-token',
        expiration: '2025-03-04T12:00:00Z',
      },
    };
  });

  describe('checkS3PublicAcl', () => {
    it('should return critical finding for public read ACL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => `
          <AccessControlPolicy xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
            <Owner>
              <ID>canonicalUserId</ID>
              <DisplayName>owner</DisplayName>
            </Owner>
            <AccessControlList>
              <Grant>
                <Grantee xmlns="http://www.w3.org/2001/XMLSchema-instance" xsi:type="Group">
                  <URI>http://acs.amazonaws.com/groups/global/AllUsers</URI>
                </Grantee>
                <Permission>READ</Permission>
              </Grant>
            </AccessControlList>
          </AccessControlPolicy>
        `,
      } as Response);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => '',
      });

      const findings = await checkS3PublicAcl(mockContext, 'test-bucket');

      expect(findings).toHaveLength(1);
      expect(findings[0].checkId).toBe('s3-public-acl');
      expect(findings[0].severity).toBe('critical');
      expect(findings[0].resourceId).toBe('test-bucket');
    });

    it('should return no findings for private bucket', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => `
          <AccessControlPolicy xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
            <Owner>
              <ID>canonicalUserId</ID>
            </Owner>
            <AccessControlList>
              <Grant>
                <Grantee xmlns="http://www.w3.org/2001/XMLSchema-instance" xsi:type="CanonicalUser">
                  <ID>specificUserId</ID>
                </Grantee>
                <Permission>FULL_CONTROL</Permission>
              </Grant>
            </AccessControlList>
          </AccessControlPolicy>
        `,
      } as Response);

      const findings = await checkS3PublicAcl(mockContext, 'private-bucket');

      expect(findings).toHaveLength(0);
    });
  });

  describe('checkS3Encryption', () => {
    it('should return high finding for missing encryption', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => `
          <ServerSideEncryptionConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
          </ServerSideEncryptionConfiguration>
        `,
      } as Response);

      const findings = await checkS3Encryption(mockContext, 'unencrypted-bucket');

      expect(findings).toHaveLength(1);
      expect(findings[0].checkId).toBe('s3-encryption-disabled');
      expect(findings[0].severity).toBe('high');
    });

    it('should return no findings when encryption enabled', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => `
          <ServerSideEncryptionConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
            <ServerSideEncryptionConfiguration>
              <Rule>
                <ApplyServerSideEncryptionByDefault>true</ApplyServerSideEncryptionByDefault>
              </Rule>
            </Rule>
          </ServerSideEncryptionConfiguration>
        `,
      } as Response);

      const findings = await checkS3Encryption(mockContext, 'encrypted-bucket');

      expect(findings).toHaveLength(0);
    });
  });

  describe('checkS3Versioning', () => {
    it('should return medium finding for disabled versioning', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => `
          <VersioningConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
            <Status>Suspended</Status>
          </VersioningConfiguration>
        `,
      } as Response);

      const findings = await checkS3Versioning(mockContext, 'unversioned-bucket');

      expect(findings).toHaveLength(1);
      expect(findings[0].checkId).toBe('s3-versioning-disabled');
      expect(findings[0].severity).toBe('medium');
    });

    it('should return no findings when versioning enabled', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => `
          <VersioningConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
            <Status>Enabled</Status>
          </VersioningConfiguration>
        `,
      } as Response);

      const findings = await checkS3Versioning(mockContext, 'versioned-bucket');

      expect(findings).toHaveLength(0);
    });
  });

  describe('runS3Checks', () => {
    it('should run all S3 checks and aggregate findings', async () => {
      // Setup mock responses for each check
      mockFetch.mockImplementation(async (url) => {
        const urlString = typeof url === 'string' ? url : url.toString();

        if (urlString.includes('acl')) {
          return {
            ok: true,
            text: async () => `<AccessControlPolicy xmlns="http://s3.amazonaws.com/doc/2006-03-01/"></AccessControlPolicy>`,
          } as Response;
        }
        if (urlString.includes('encryption')) {
          return {
            ok: true,
            text: async () => `<ServerSideEncryptionConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/"></ServerSideEncryptionConfiguration>`,
          } as Response;
        }
        if (urlString.includes('versioning')) {
          return {
            ok: true,
            text: async () => `<VersioningConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Status>Suspended</Status></VersioningConfiguration>`,
          } as Response;
        }
        return {
          ok: false,
          text: async () => 'Not found',
        } as Response;
      });

      const findings = await runS3Checks(mockContext, 'test-bucket');

      expect(findings.length).toBeGreaterThan(0);
      // Should have at least versioning finding
      expect(findings.some((f) => f.checkId === 's3-versioning-disabled')).toBe(true);
    });
  });
});
