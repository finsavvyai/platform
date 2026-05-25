/** Google Vertex AI (Gemini) provider adapter — auto-refresh OAuth via SA key. */

import type { PromptRequest, PromptResponse, ProviderAdapter } from '../types';

// ---------------------------------------------------------------------------
// Module-level token cache (process lifetime; refreshed before expiry)
// ---------------------------------------------------------------------------
let tokenCache: { token: string; expiresAt: number } | null = null;

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
}

// ---------------------------------------------------------------------------
// Base64url helper (no external deps, runs on crypto.subtle)
// ---------------------------------------------------------------------------
function base64url(data: string | ArrayBuffer): string {
  let str: string;
  if (typeof data === 'string') {
    str = btoa(data);
  } else {
    str = btoa(String.fromCharCode(...new Uint8Array(data)));
  }
  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// ---------------------------------------------------------------------------
// Import PEM private key as CryptoKey (RS256 / PKCS8)
// ---------------------------------------------------------------------------
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const stripped = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');
  const keyBuffer = Uint8Array.from(atob(stripped), (c) => c.charCodeAt(0)).buffer;
  return crypto.subtle.importKey(
    'pkcs8',
    keyBuffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

// ---------------------------------------------------------------------------
// Build and sign a JWT for Google's token endpoint
// ---------------------------------------------------------------------------
async function signJwt(saKey: ServiceAccountKey, nowSec: number): Promise<string> {
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64url(
    JSON.stringify({
      iss: saKey.client_email,
      scope: 'https://www.googleapis.com/auth/cloud-platform',
      aud: 'https://oauth2.googleapis.com/token',
      exp: nowSec + 3600,
      iat: nowSec,
    }),
  );
  const signingInput = `${header}.${payload}`;
  const key = await importPrivateKey(saKey.private_key);
  const sigBuffer = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    key,
    new TextEncoder().encode(signingInput),
  );
  return `${signingInput}.${base64url(sigBuffer)}`;
}

// ---------------------------------------------------------------------------
// Exchange a signed JWT for a Google OAuth access token
// ---------------------------------------------------------------------------
async function exchangeJwt(jwt: string): Promise<{ access_token: string; expires_in: number }> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`Vertex token exchange ${res.status}: ${err.slice(0, 200)}`);
  }
  return res.json() as Promise<{ access_token: string; expires_in: number }>;
}

// ---------------------------------------------------------------------------
// Return a valid access token, refreshing if needed
// ---------------------------------------------------------------------------
async function getAccessToken(saKey: ServiceAccountKey): Promise<string> {
  const nowMs = Date.now();
  if (tokenCache && tokenCache.expiresAt > nowMs) {
    return tokenCache.token;
  }
  const nowSec = Math.floor(nowMs / 1000);
  const jwt = await signJwt(saKey, nowSec);
  const { access_token, expires_in } = await exchangeJwt(jwt);
  tokenCache = { token: access_token, expiresAt: nowMs + (expires_in - 60) * 1000 };
  return access_token;
}

// ---------------------------------------------------------------------------
// Provider adapter
// ---------------------------------------------------------------------------
export const vertexAdapter: ProviderAdapter = {
  name: 'vertex',

  async call(req: PromptRequest, apiKey: string): Promise<PromptResponse> {
    const start = Date.now();
    // apiKey format: "PROJECT_ID|LOCATION|BASE64_SERVICE_ACCOUNT_JSON"
    const parts = apiKey.split('|');
    if (parts.length !== 3) {
      throw new Error('Vertex: expected PROJECT_ID|LOCATION|BASE64_SERVICE_ACCOUNT_JSON');
    }
    const [project, location, base64SaJson] = parts;
    const saKey = JSON.parse(atob(base64SaJson)) as ServiceAccountKey;
    const token = await getAccessToken(saKey);

    const url =
      `https://${location}-aiplatform.googleapis.com/v1/projects/${project}` +
      `/locations/${location}/publishers/google/models/${req.model}:generateContent`;

    const body: Record<string, unknown> = {
      contents: [{ role: 'user', parts: [{ text: req.prompt }] }],
      generationConfig: {
        maxOutputTokens: req.maxTokens ?? 4096,
        temperature: req.temperature ?? 0.7,
      },
    };
    if (req.system) body.systemInstruction = { parts: [{ text: req.system }] };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`Vertex ${res.status}: ${errBody.slice(0, 200)}`);
    }

    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    };

    return {
      text: data.candidates?.[0]?.content?.parts?.[0]?.text ?? '',
      tokensIn: data.usageMetadata?.promptTokenCount ?? 0,
      tokensOut: data.usageMetadata?.candidatesTokenCount ?? 0,
      latencyMs: Date.now() - start,
    };
  },
};
