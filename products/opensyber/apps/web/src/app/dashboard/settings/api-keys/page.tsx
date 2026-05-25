import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';
import { ApiKeyList } from './ApiKeyList';
import type { ApiKeyInfo } from './api-key-types';

export const metadata = { title: 'API Keys' };

export default async function ApiKeysPage() {
  let keys: ApiKeyInfo[] = [];

  try {
    const token = await getApiToken();
    if (token) {
      const data = await apiClient<{ keys: ApiKeyInfo[] }>('/api/keys', { token });
      keys = data.keys;
    }
  } catch {
    // API not available
  }

  return (
    <div>
      <ApiKeyList initialKeys={keys} />

      <div className="mt-8 rounded border border-border bg-panel/30 p-6">
        <h3 className="text-lg font-semibold mb-3">Usage</h3>
        <p className="text-sm text-text-secondary mb-4">
          Use your API key to send events to the ingestion endpoint:
        </p>
        <pre className="rounded-lg bg-surface p-4 text-xs font-mono text-text-primary overflow-x-auto">
{`curl -X POST https://api.opensyber.cloud/api/ingest \\
  -H "X-API-Key: osk_live_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "source": "custom-scanner",
    "eventType": "vulnerability_found",
    "severity": "high",
    "summary": "CVE-2026-1234 in openssl",
    "metadata": { "cve": "CVE-2026-1234" }
  }'`}
        </pre>
      </div>
    </div>
  );
}
