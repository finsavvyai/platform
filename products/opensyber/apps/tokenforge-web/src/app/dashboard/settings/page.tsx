'use client';

import { useCallback } from 'react';
import { useApi } from '@/lib/use-api';
import { fetchApiKeys } from '@/lib/tokenforge-api';
import { ApiKeyManager } from '@/components/dashboard/ApiKeyManager';
import { WebhookConfig } from '@/components/dashboard/WebhookConfig';
import { TrustBadgeSnippet } from '@/components/dashboard/TrustBadgeSnippet';
import type { ApiKey } from '@/components/dashboard/types';

export default function SettingsPage(): React.ReactElement {
  const fetcher = useCallback(
    (token: string, signal: AbortSignal) => fetchApiKeys(token, signal),
    [],
  );
  const { data: apiKeys, loading, refetch } = useApi<ApiKey[]>(fetcher);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Manage API keys, webhooks, and trust badge
        </p>
      </div>

      {/* API Keys */}
      <div className="mb-8 rounded-2xl border border-border/50 bg-panel p-6">
        <h2 className="mb-4 text-lg font-semibold">API Keys</h2>
        <p className="mb-4 text-sm text-text-secondary">
          API keys authenticate your server-side SDK requests. Keep them
          secret and rotate regularly.
        </p>
        {loading ? (
          <div className="h-32 animate-pulse rounded-lg bg-surface/30" />
        ) : (
          <ApiKeyManager initialKeys={apiKeys ?? []} onMutate={refetch} />
        )}
      </div>

      {/* Webhooks */}
      <div className="mb-8 rounded-2xl border border-border/50 bg-panel p-6">
        <h2 className="mb-4 text-lg font-semibold">Webhooks</h2>
        <p className="mb-4 text-sm text-text-secondary">
          Receive real-time event notifications to your server endpoint.
        </p>
        <WebhookConfig />
      </div>

      {/* Trust Badge */}
      <TrustBadgeSnippet />
    </div>
  );
}
