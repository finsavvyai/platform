/**
 * Azure Storage Security Checks
 *
 * Checks for publicly accessible Azure Storage accounts by inspecting
 * the allowBlobPublicAccess property on each storage account.
 */

import type { SecurityFinding } from '../../aws-scanner/types.js';

const STORAGE_API = 'https://management.azure.com/subscriptions';
const API_VERSION = '2023-01-01';

interface StorageAccountProperties {
  allowBlobPublicAccess?: boolean;
  minimumTlsVersion?: string;
  supportsHttpsTrafficOnly?: boolean;
}

interface StorageAccount {
  id: string;
  name: string;
  location: string;
  properties: StorageAccountProperties;
}

interface StorageAccountsResponse {
  value?: StorageAccount[];
}

/**
 * Run Azure Storage security checks for a subscription
 */
export async function runAzureStorageChecks(
  accessToken: string,
  subscriptionId: string,
): Promise<SecurityFinding[]> {
  const findings: SecurityFinding[] = [];

  try {
    const url = `${STORAGE_API}/${subscriptionId}/providers/Microsoft.Storage/storageAccounts?api-version=${API_VERSION}`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Azure Storage API error (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as StorageAccountsResponse;
    const accounts = data.value ?? [];

    for (const account of accounts) {
      if (account.properties.allowBlobPublicAccess === true) {
        findings.push({
          checkId: 'azure-storage-public-access',
          severity: 'critical',
          resourceId: account.name,
          resourceType: 'azure-storage-account',
          region: account.location,
          title: 'Azure Storage account allows blob public access',
          description: `Storage account "${account.name}" in "${account.location}" has allowBlobPublicAccess enabled. Containers may be publicly accessible.`,
          remediation: 'Set allowBlobPublicAccess to false on the storage account to prevent public container access.',
          complianceFrameworks: ['CIS Azure 3.7', 'SOC2 CC6.6'],
        });
      }

      if (account.properties.supportsHttpsTrafficOnly === false) {
        findings.push({
          checkId: 'azure-storage-https-only',
          severity: 'high',
          resourceId: account.name,
          resourceType: 'azure-storage-account',
          region: account.location,
          title: 'Azure Storage account allows non-HTTPS traffic',
          description: `Storage account "${account.name}" allows unencrypted HTTP traffic, exposing data in transit.`,
          remediation: 'Enable "Secure transfer required" on the storage account to enforce HTTPS-only access.',
          complianceFrameworks: ['CIS Azure 3.1', 'SOC2 CC6.1'],
        });
      }
    }
  } catch (error) {
    findings.push({
      checkId: 'azure-storage-public-access',
      severity: 'low',
      resourceId: subscriptionId,
      resourceType: 'azure-subscription',
      region: 'global',
      title: 'Could not check Azure Storage accounts',
      description: `Failed to list storage accounts: ${error instanceof Error ? error.message : 'Unknown error'}`,
      remediation: 'Verify the service principal has Microsoft.Storage/storageAccounts/read permission.',
    });
  }

  return findings;
}
