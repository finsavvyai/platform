/**
 * Multi-Cloud Account Manager
 *
 * Manages cloud provider configurations for AWS, GCP, and Azure.
 * Validates provider-specific config formats.
 */

export type CloudProvider = 'aws' | 'gcp' | 'azure';

export interface CloudConfig {
  provider: CloudProvider;
  displayName: string;
  region?: string;
}

export interface AwsConfig extends CloudConfig {
  provider: 'aws';
  roleArn: string;
  externalId?: string;
}

export interface GcpConfig extends CloudConfig {
  provider: 'gcp';
  projectId: string;
  serviceAccountKey: string;
}

export interface AzureConfig extends CloudConfig {
  provider: 'azure';
  tenantId: string;
  clientId: string;
  clientSecret: string;
  subscriptionId: string;
}

const PROVIDER_REGIONS: Record<CloudProvider, string[]> = {
  aws: ['us-east-1', 'us-west-2', 'eu-west-1', 'eu-central-1', 'ap-southeast-1'],
  gcp: ['us-central1', 'us-east1', 'europe-west1', 'asia-east1'],
  azure: ['eastus', 'westus2', 'westeurope', 'southeastasia'],
};

export function validateCloudConfig(
  config: Record<string, unknown>,
): { valid: boolean; error?: string } {
  const provider = config.provider as CloudProvider;
  if (!['aws', 'gcp', 'azure'].includes(provider)) {
    return { valid: false, error: `Invalid provider: ${provider}` };
  }
  if (!config.displayName) {
    return { valid: false, error: 'Display name is required' };
  }

  switch (provider) {
    case 'aws':
      if (!config.roleArn) return { valid: false, error: 'AWS roleArn is required' };
      break;
    case 'gcp':
      if (!config.projectId) return { valid: false, error: 'GCP projectId is required' };
      break;
    case 'azure':
      if (!config.tenantId) return { valid: false, error: 'Azure tenantId is required' };
      if (!config.subscriptionId) return { valid: false, error: 'Azure subscriptionId is required' };
      break;
  }
  return { valid: true };
}

export function getProviderRegions(provider: CloudProvider): string[] {
  return PROVIDER_REGIONS[provider] ?? [];
}
