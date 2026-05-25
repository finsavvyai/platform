/**
 * Azure Key Vault Provider
 *
 * Integrates with the Azure Key Vault REST API (api-version 7.4)
 * for secret listing and attribute retrieval.
 */

const API_VERSION = '7.4';

export interface KeyVaultSecretAttributes {
  name: string;
  created: string;
  updated: string;
  expires: string | null;
  enabled: boolean;
  contentType: string | null;
}

export interface KeyVaultListItem {
  id: string;
  name: string;
  enabled: boolean;
}

/**
 * List all secrets in an Azure Key Vault.
 * Uses GET {vaultUrl}/secrets?api-version=7.4
 */
export async function listSecrets(
  vaultUrl: string,
  accessToken: string,
): Promise<KeyVaultListItem[]> {
  const url = `${normalizeUrl(vaultUrl)}/secrets?api-version=${API_VERSION}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: buildHeaders(accessToken),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new KeyVaultApiError(`Failed to list secrets: ${response.status}`, body);
  }

  const json = (await response.json()) as {
    value?: Array<{
      id?: string;
      attributes?: { enabled?: boolean };
    }>;
  };

  return (json.value ?? []).map((item) => {
    const id = item.id ?? '';
    const name = extractSecretName(id);
    return {
      id,
      name,
      enabled: item.attributes?.enabled ?? true,
    };
  });
}

/**
 * Get attributes for a specific secret by name.
 * Uses GET {vaultUrl}/secrets/{name}?api-version=7.4
 */
export async function getSecretAttributes(
  vaultUrl: string,
  accessToken: string,
  name: string,
): Promise<KeyVaultSecretAttributes> {
  const url = `${normalizeUrl(vaultUrl)}/secrets/${name}?api-version=${API_VERSION}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: buildHeaders(accessToken),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new KeyVaultApiError(`Failed to get secret ${name}: ${response.status}`, body);
  }

  const json = (await response.json()) as {
    attributes?: {
      created?: number;
      updated?: number;
      exp?: number;
      enabled?: boolean;
    };
    contentType?: string;
  };

  const attrs = json.attributes;

  return {
    name,
    created: attrs?.created ? new Date(attrs.created * 1000).toISOString() : '',
    updated: attrs?.updated ? new Date(attrs.updated * 1000).toISOString() : '',
    expires: attrs?.exp ? new Date(attrs.exp * 1000).toISOString() : null,
    enabled: attrs?.enabled ?? true,
    contentType: json.contentType ?? null,
  };
}

/**
 * Extract secret name from Azure Key Vault secret ID URL.
 * Format: https://{vault}.vault.azure.net/secrets/{name}/{version}
 */
function extractSecretName(secretId: string): string {
  const parts = secretId.split('/secrets/');
  if (parts.length < 2) return secretId;
  const nameAndVersion = parts[1]!;
  return nameAndVersion.split('/')[0] ?? nameAndVersion;
}

function normalizeUrl(vaultUrl: string): string {
  return vaultUrl.replace(/\/+$/, '');
}

function buildHeaders(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

export class KeyVaultApiError extends Error {
  constructor(
    message: string,
    public readonly responseBody: string,
  ) {
    super(message);
    this.name = 'KeyVaultApiError';
  }
}
