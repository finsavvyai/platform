/**
 * Azure Authentication
 *
 * Authenticates with Azure AD using OAuth2 client_credentials flow
 * to obtain an access token for Azure Management API calls.
 */

const AZURE_MANAGEMENT_SCOPE = 'https://management.azure.com/.default';

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

/**
 * Get an Azure access token using client credentials flow
 */
export async function getAzureAccessToken(
  tenantId: string,
  clientId: string,
  clientSecret: string,
): Promise<string> {
  if (!tenantId || !clientId || !clientSecret) {
    throw new Error('Missing Azure credentials: tenantId, clientId, and clientSecret are required');
  }

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope: AZURE_MANAGEMENT_SCOPE,
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Azure token request failed (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as TokenResponse;
  return data.access_token;
}
