import type { DrizzleD1Database } from 'drizzle-orm/d1';

export type Db = DrizzleD1Database<Record<string, unknown>>;

/**
 * AWS credentials stored in cloud account (encrypted)
 */
export interface StoredCredentials {
  accessKeyId: string;
  secretAccessKey: string;
}

/**
 * GCP credentials stored in cloud account (encrypted service account JSON key)
 */
export interface GcpStoredCredentials {
  serviceAccountKey: string;
}

/**
 * Azure credentials stored in cloud account (encrypted)
 */
export interface AzureStoredCredentials {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  subscriptionId: string;
}

/**
 * Cloud account record from database
 */
export interface CloudAccountRecord {
  id: string;
  provider: string;
  roleArn: string | null;
  externalId: string | null;
  credentials: string | null;
}

export interface ScanResult {
  scanRun: {
    id: string;
    status: string;
    findingCount: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
  };
  error?: string;
}

/**
 * Create a failed scan result with an error message
 */
export function failedScanResult(error: string): ScanResult {
  return {
    scanRun: {
      id: '',
      status: 'failed',
      findingCount: 0,
      criticalCount: 0,
      highCount: 0,
      mediumCount: 0,
      lowCount: 0,
    },
    error,
  };
}

/**
 * Decrypt stored credentials using AES-GCM via the shared encryption utility.
 * Requires ENCRYPTION_KEY env var to be set.
 */
export async function decryptCredentials(encrypted: string, encryptionKey: string): Promise<string> {
  const { decrypt } = await import('../utils/encryption.js');
  return decrypt(encrypted, encryptionKey);
}
