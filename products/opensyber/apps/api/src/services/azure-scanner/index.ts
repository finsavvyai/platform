/**
 * Azure Security Scanner
 *
 * Runs 5 security checks against Azure subscriptions:
 * 1. Blob storage public access
 * 2. NSG rules (open inbound)
 * 3. RBAC role assignments (broad contributor/owner)
 * 4. Key Vault configuration
 * 5. Activity log alerts
 */
import type { SecurityFinding } from '../aws-scanner/types.js';

export interface AzureScanConfig {
  subscriptionId: string;
  credentials: AzureCredentials;
}

export interface AzureCredentials {
  tenantId: string;
  clientId: string;
  clientSecret: string;
}

const AZURE_API = 'https://management.azure.com';

/** Obtain access token from Azure AD using client credentials */
async function getAccessToken(creds: AzureCredentials): Promise<string> {
  const url = `https://login.microsoftonline.com/${creds.tenantId}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    scope: 'https://management.azure.com/.default',
  });

  const res = await fetch(url, { method: 'POST', body, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  const data = await res.json() as { access_token?: string };
  if (!data.access_token) throw new Error('Failed to obtain Azure access token');
  return data.access_token;
}

async function azureGet(path: string, token: string, apiVersion: string): Promise<unknown> {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`${AZURE_API}${path}${sep}api-version=${apiVersion}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

async function checkBlobPublicAccess(subId: string, token: string): Promise<SecurityFinding[]> {
  const data = await azureGet(`/subscriptions/${subId}/providers/Microsoft.Storage/storageAccounts`, token, '2023-01-01') as any;
  const findings: SecurityFinding[] = [];
  for (const acct of data?.value ?? []) {
    if (acct.properties?.allowBlobPublicAccess === true) {
      findings.push({
        checkId: 'azure-blob-public', severity: 'high',
        resourceId: acct.id, resourceType: 'Microsoft.Storage/storageAccounts',
        region: acct.location ?? 'unknown',
        title: 'Storage account allows public blob access',
        description: `Storage account ${acct.name} has allowBlobPublicAccess enabled`,
        remediation: 'Disable allowBlobPublicAccess on the storage account',
      });
    }
  }
  return findings;
}

async function checkNsgRules(subId: string, token: string): Promise<SecurityFinding[]> {
  const data = await azureGet(`/subscriptions/${subId}/providers/Microsoft.Network/networkSecurityGroups`, token, '2023-09-01') as any;
  const findings: SecurityFinding[] = [];
  for (const nsg of data?.value ?? []) {
    for (const rule of nsg.properties?.securityRules ?? []) {
      const props = rule.properties ?? {};
      const isOpenInbound = props.direction === 'Inbound' && props.access === 'Allow'
        && (props.sourceAddressPrefix === '*' || props.sourceAddressPrefix === '0.0.0.0/0')
        && (props.destinationPortRange === '*' || props.destinationPortRange === '0-65535');
      if (isOpenInbound) {
        findings.push({
          checkId: 'azure-nsg-open', severity: 'critical',
          resourceId: rule.id ?? nsg.id, resourceType: 'Microsoft.Network/networkSecurityGroups',
          region: nsg.location ?? 'unknown',
          title: 'NSG allows all inbound traffic',
          description: `NSG ${nsg.name} rule ${rule.name} allows all inbound from any source`,
          remediation: 'Restrict source address prefix and destination ports',
        });
      }
    }
  }
  return findings;
}

async function checkRbacAssignments(subId: string, token: string): Promise<SecurityFinding[]> {
  const data = await azureGet(`/subscriptions/${subId}/providers/Microsoft.Authorization/roleAssignments`, token, '2022-04-01') as any;
  const findings: SecurityFinding[] = [];
  const broadRoles = ['/providers/Microsoft.Authorization/roleDefinitions/8e3af657-a8ff-443c-a75c-2fe8c4bcb635', '/providers/Microsoft.Authorization/roleDefinitions/b24988ac-6180-42a0-ab88-20f7382dd24c'];
  for (const assignment of data?.value ?? []) {
    const roleDefId = assignment.properties?.roleDefinitionId ?? '';
    if (broadRoles.some((r) => roleDefId.endsWith(r))) {
      findings.push({
        checkId: 'azure-rbac-broad', severity: 'medium',
        resourceId: assignment.id, resourceType: 'Microsoft.Authorization/roleAssignments',
        region: 'global', title: 'Broad Owner/Contributor role assigned at subscription level',
        description: `Principal ${assignment.properties?.principalId} has Owner or Contributor at subscription scope`,
        remediation: 'Use least-privilege custom roles scoped to resource groups',
      });
    }
  }
  return findings;
}

async function checkKeyVaults(subId: string, token: string): Promise<SecurityFinding[]> {
  const data = await azureGet(`/subscriptions/${subId}/providers/Microsoft.KeyVault/vaults`, token, '2023-07-01') as any;
  const findings: SecurityFinding[] = [];
  for (const vault of data?.value ?? []) {
    const props = vault.properties ?? {};
    if (props.enableSoftDelete !== true) {
      findings.push({
        checkId: 'azure-keyvault-no-softdelete', severity: 'medium',
        resourceId: vault.id, resourceType: 'Microsoft.KeyVault/vaults',
        region: vault.location ?? 'unknown',
        title: 'Key Vault soft delete not enabled',
        description: `Key Vault ${vault.name} does not have soft delete enabled`,
        remediation: 'Enable soft delete on the Key Vault to prevent accidental deletion',
      });
    }
    if (props.enablePurgeProtection !== true) {
      findings.push({
        checkId: 'azure-keyvault-no-purge-protection', severity: 'low',
        resourceId: vault.id, resourceType: 'Microsoft.KeyVault/vaults',
        region: vault.location ?? 'unknown',
        title: 'Key Vault purge protection not enabled',
        description: `Key Vault ${vault.name} does not have purge protection`,
        remediation: 'Enable purge protection to prevent permanent key deletion',
      });
    }
  }
  return findings;
}

async function checkActivityLogAlerts(subId: string, token: string): Promise<SecurityFinding[]> {
  const data = await azureGet(`/subscriptions/${subId}/providers/Microsoft.Insights/activityLogAlerts`, token, '2020-10-01') as any;
  const alerts = data?.value ?? [];
  if (alerts.length === 0) {
    return [{
      checkId: 'azure-no-activity-alerts', severity: 'medium',
      resourceId: subId, resourceType: 'Microsoft.Insights/activityLogAlerts',
      region: 'global', title: 'No activity log alerts configured',
      description: 'Subscription has no activity log alerts for security events',
      remediation: 'Configure activity log alerts for critical security operations',
    }];
  }
  return [];
}

/** Run all Azure security checks and return aggregated findings */
export async function runAzureScan(config: AzureScanConfig): Promise<SecurityFinding[]> {
  const token = await getAccessToken(config.credentials);
  const subId = config.subscriptionId;

  const results = await Promise.allSettled([
    checkBlobPublicAccess(subId, token), checkNsgRules(subId, token),
    checkRbacAssignments(subId, token), checkKeyVaults(subId, token),
    checkActivityLogAlerts(subId, token),
  ]);

  const findings: SecurityFinding[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') findings.push(...r.value);
    else console.error('Azure check failed:', r.reason);
  }
  return findings;
}
