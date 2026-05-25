/**
 * HashiCorp Vault Provider
 *
 * Integrates with the HashiCorp Vault HTTP API (KV v2 engine)
 * for secret listing, metadata retrieval, and rotation.
 */

export interface VaultSecretMetadata {
  createdTime: string;
  updatedTime: string;
  version: number;
  destroyed: boolean;
  customMetadata: Record<string, string> | null;
}

export interface VaultRotateResult {
  success: boolean;
  newVersion: number;
  error?: string;
}

/**
 * List all secret keys under a KV v2 mount path.
 * Uses LIST /v1/{mount}/metadata/
 */
export async function listSecrets(
  vaultAddr: string,
  token: string,
  mountPath = 'secret',
): Promise<string[]> {
  const url = `${vaultAddr}/v1/${mountPath}/metadata?list=true`;

  const response = await fetch(url, {
    method: 'GET',
    headers: buildHeaders(token),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new VaultApiError(`Failed to list secrets: ${response.status}`, body);
  }

  const json = (await response.json()) as {
    data?: { keys?: string[] };
  };

  return json.data?.keys ?? [];
}

/**
 * Retrieve metadata for a specific secret path.
 * Uses GET /v1/{mount}/metadata/{path}
 */
export async function getSecretMetadata(
  vaultAddr: string,
  token: string,
  path: string,
  mountPath = 'secret',
): Promise<VaultSecretMetadata> {
  const url = `${vaultAddr}/v1/${mountPath}/metadata/${path}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: buildHeaders(token),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new VaultApiError(`Failed to get metadata for ${path}: ${response.status}`, body);
  }

  const json = (await response.json()) as {
    data?: {
      created_time?: string;
      updated_time?: string;
      current_version?: number;
      versions?: Record<string, { destroyed?: boolean }>;
      custom_metadata?: Record<string, string> | null;
    };
  };

  const data = json.data;
  const currentVersion = data?.current_version ?? 1;
  const versionInfo = data?.versions?.[String(currentVersion)];

  return {
    createdTime: data?.created_time ?? '',
    updatedTime: data?.updated_time ?? '',
    version: currentVersion,
    destroyed: versionInfo?.destroyed ?? false,
    customMetadata: data?.custom_metadata ?? null,
  };
}

/**
 * Rotate a secret by writing a new version with a generated value.
 * Uses POST /v1/{mount}/data/{path}
 */
export async function rotateSecret(
  vaultAddr: string,
  token: string,
  path: string,
  newData: Record<string, string>,
  mountPath = 'secret',
): Promise<VaultRotateResult> {
  const url = `${vaultAddr}/v1/${mountPath}/data/${path}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: buildHeaders(token),
    body: JSON.stringify({ data: newData }),
  });

  if (!response.ok) {
    const body = await response.text();
    return { success: false, newVersion: 0, error: `Rotation failed: ${response.status} — ${body}` };
  }

  const json = (await response.json()) as {
    data?: { version?: number };
  };

  return {
    success: true,
    newVersion: json.data?.version ?? 0,
  };
}

function buildHeaders(token: string): Record<string, string> {
  return {
    'X-Vault-Token': token,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

export class VaultApiError extends Error {
  constructor(
    message: string,
    public readonly responseBody: string,
  ) {
    super(message);
    this.name = 'VaultApiError';
  }
}
