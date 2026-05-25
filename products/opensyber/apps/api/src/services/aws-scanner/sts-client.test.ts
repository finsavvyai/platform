import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { assumeRole, assumeRoleFromConfig } from './sts-client.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

let digestSpy: ReturnType<typeof vi.spyOn>;
let importKeySpy: ReturnType<typeof vi.spyOn>;
let signSpy: ReturnType<typeof vi.spyOn>;
const originalDOMParser = globalThis.DOMParser;

function createXmlNode(xml: string) {
  return {
    textContent: xml.replace(/<[^>]+>/g, '').trim(),
    getElementsByTagName(tag: string) {
      return findXmlNodes(xml, tag);
    },
  };
}

function findXmlNodes(xml: string, tag: string) {
  const pattern = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'g');
  return Array.from(xml.matchAll(pattern), (match) => createXmlNode(match[1]));
}

describe('sts-client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    digestSpy = vi.spyOn(crypto.subtle, 'digest');
    importKeySpy = vi.spyOn(crypto.subtle, 'importKey');
    signSpy = vi.spyOn(crypto.subtle, 'sign');
    vi.stubGlobal(
      'DOMParser',
      class {
        parseFromString(xml: string) {
          return {
            getElementsByTagName(tag: string) {
              return findXmlNodes(xml, tag);
            },
          };
        }
      } as typeof DOMParser,
    );
  });

  afterEach(() => {
    digestSpy.mockRestore();
    importKeySpy.mockRestore();
    signSpy.mockRestore();
    if (originalDOMParser) {
      vi.stubGlobal('DOMParser', originalDOMParser);
    } else {
      vi.unstubAllGlobals();
      global.fetch = mockFetch;
    }
  });

  describe('assumeRole', () => {
    it('should successfully assume role with valid credentials', async () => {
      // Mock successful STS response
      const mockResponse = {
        ok: true,
        text: async () => `
          <AssumeRoleResponse xmlns="https://sts.amazonaws.com/doc/2011-06-15/">
            <AssumeRoleResult>
              <Credentials>
                <AccessKeyId>ASIATESTACCESSKEY</AccessKeyId>
                <SecretAccessKey>test-secret-key</SecretAccessKey>
                <SessionToken>test-session-token</SessionToken>
                <Expiration>2025-03-04T12:00:00Z</Expiration>
              </Credentials>
              <AssumedRoleUser>
                <AssumedRoleId>AROATEST:opensyber-scan</AssumedRoleId>
                <Arn>arn:aws:sts::123456789012:assumed-role/test-role/opensyber-scan</Arn>
              </AssumedRoleUser>
            </AssumeRoleResult>
          </AssumeRoleResponse>
        `,
      } as Response;

      mockFetch.mockResolvedValueOnce(mockResponse);
      digestSpy.mockResolvedValueOnce(new ArrayBuffer(32));
      digestSpy.mockResolvedValueOnce(new ArrayBuffer(32));

      // Mock HMAC key import and signing
      const mockKey = { type: 'secret' };
      importKeySpy.mockResolvedValueOnce(mockKey as CryptoKey);
      signSpy.mockResolvedValueOnce(new ArrayBuffer(32));
      importKeySpy.mockResolvedValueOnce(mockKey as CryptoKey);
      signSpy.mockResolvedValueOnce(new ArrayBuffer(32));
      importKeySpy.mockResolvedValueOnce(mockKey as CryptoKey);
      signSpy.mockResolvedValueOnce(new ArrayBuffer(32));

      const result = await assumeRole(
        'arn:aws:iam::123456789012:role/test-role',
        'AKIAIOSFODNN7EXAMPLE',
        'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      );

      expect(result.credentials).toEqual({
        accessKeyId: 'ASIATESTACCESSKEY',
        secretAccessKey: 'test-secret-key',
        sessionToken: 'test-session-token',
        expiration: '2025-03-04T12:00:00Z',
      });
      expect(result.assumedRoleId).toBe('AROATEST:opensyber-scan');
      expect(result.account).toBe('123456789012');
    });

    it('should include external ID when provided', async () => {
      const mockResponse = {
        ok: true,
        text: async () => `
          <AssumeRoleResponse xmlns="https://sts.amazonaws.com/doc/2011-06-15/">
            <AssumeRoleResult>
              <Credentials>
                <AccessKeyId>ASIATESTACCESSKEY</AccessKeyId>
                <SecretAccessKey>test-secret-key</SecretAccessKey>
                <SessionToken>test-session-token</SessionToken>
                <Expiration>2025-03-04T12:00:00Z</Expiration>
              </Credentials>
              <AssumedRoleUser>
                <AssumedRoleId>AROATEST:opensyber-scan</AssumedRoleId>
              </AssumedRoleUser>
            </AssumeRoleResult>
          </AssumeRoleResponse>
        `,
      } as Response;

      mockFetch.mockResolvedValueOnce(mockResponse);
      digestSpy.mockResolvedValue(new ArrayBuffer(32));
      importKeySpy.mockResolvedValue({ type: 'secret' } as CryptoKey);
      signSpy.mockResolvedValue(new ArrayBuffer(32));

      await assumeRole(
        'arn:aws:iam::123456789012:role/test-role',
        'AKIAIOSFODNN7EXAMPLE',
        'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        'my-external-id-12345',
      );

      const fetchCall = mockFetch.mock.calls[0] as [string, RequestInit];
      const url = fetchCall[0];
      expect(url).toContain('ExternalId=my-external-id-12345');
    });

    it('should throw error for invalid role ARN', async () => {
      await expect(
        assumeRole(
          'invalid-arn',
          'AKIAIOSFODNN7EXAMPLE',
          'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        ),
      ).rejects.toThrow('Invalid role ARN format');
    });

    it('should throw error for invalid duration', async () => {
      await expect(
        assumeRole(
          'arn:aws:iam::123456789012:role/test-role',
          'AKIAIOSFODNN7EXAMPLE',
          'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
          undefined,
          undefined,
          500, // Too long
        ),
      ).rejects.toThrow('Duration must be between 900 and 43200 seconds');

      await expect(
        assumeRole(
          'arn:aws:iam::123456789012:role/test-role',
          'AKIAIOSFODNN7EXAMPLE',
          'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
          undefined,
          undefined,
          100, // Too short
        ),
      ).rejects.toThrow('Duration must be between 900 and 43200 seconds');
    });

    it('should throw error on STS API failure', async () => {
      const mockResponse = {
        ok: false,
        text: async () => `
          <ErrorResponse xmlns="https://sts.amazonaws.com/doc/2011-06-15/">
            <Error>
              <Type>Sender</Type>
              <Code>InvalidClientTokenId</Code>
              <Message>The security token included in the request is invalid.</Message>
            </Error>
            <RequestId>example-request-id</RequestId>
          </ErrorResponse>
        `,
      } as Response;

      mockFetch.mockResolvedValueOnce(mockResponse);

      await expect(
        assumeRole(
          'arn:aws:iam::123456789012:role/test-role',
          'AKIAIOSFODNN7EXAMPLE',
          'invalid-key',
        ),
      ).rejects.toThrow('STS AssumeRole failed: InvalidClientTokenId');
    });
  });

  describe('assumeRoleFromConfig', () => {
    it('should call assumeRole with config values', async () => {
      const mockResponse = {
        ok: true,
        text: async () => `
          <AssumeRoleResponse xmlns="https://sts.amazonaws.com/doc/2011-06-15/">
            <AssumeRoleResult>
              <Credentials>
                <AccessKeyId>ASIATESTACCESSKEY</AccessKeyId>
                <SecretAccessKey>test-secret-key</SecretAccessKey>
                <SessionToken>test-session-token</SessionToken>
                <Expiration>2025-03-04T12:00:00Z</Expiration>
              </Credentials>
              <AssumedRoleUser>
                <AssumedRoleId>AROATEST:opensyber-scan</AssumedRoleId>
              </AssumedRoleUser>
            </AssumeRoleResult>
          </AssumeRoleResponse>
        `,
      } as Response;

      mockFetch.mockResolvedValueOnce(mockResponse);
      digestSpy.mockResolvedValue(new ArrayBuffer(32));
      importKeySpy.mockResolvedValue({ type: 'secret' } as CryptoKey);
      signSpy.mockResolvedValue(new ArrayBuffer(32));

      const config = {
        roleArn: 'arn:aws:iam::123456789012:role/test-role',
        externalId: 'test-external-id',
      };

      const result = await assumeRoleFromConfig(
        config,
        'AKIAIOSFODNN7EXAMPLE',
        'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      );

      expect(result.credentials).toBeDefined();
      expect(mockFetch).toHaveBeenCalled();
    });
  });
});
