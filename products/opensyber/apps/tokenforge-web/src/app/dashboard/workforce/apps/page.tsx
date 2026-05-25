'use client';

import { useCallback, useState } from 'react';
import { Building2, Plus, Trash2 } from 'lucide-react';
import { useApi, useApiKey } from '@/lib/use-api';
import {
  fetchWorkforceApps,
  deleteWorkforceApp,
  type WorkforceApp,
} from '@/lib/tokenforge-api-workforce';
import { CreateWorkforceAppForm } from '@/components/dashboard/CreateWorkforceAppForm';

const IDP_LABELS: Record<string, string> = {
  oidc_okta: 'Okta',
  oidc_entra: 'Microsoft Entra',
  oidc_google: 'Google Workspace',
  oidc_auth0: 'Auth0',
  oidc_generic: 'Generic OIDC',
};

export default function WorkforceAppsPage(): React.ReactElement {
  const apiKey = useApiKey();
  const fetcher = useCallback(
    (token: string, signal: AbortSignal) => fetchWorkforceApps(token, signal),
    [],
  );
  const { data: apps, loading, refetch } = useApi<WorkforceApp[]>(fetcher);
  const [creating, setCreating] = useState(false);

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">IdP Apps</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Connect workforce OIDC identity providers for session binding
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 rounded-lg bg-info px-4 py-2 text-sm font-medium text-white hover:bg-info/90 transition"
        >
          <Plus className="h-4 w-4" />
          Connect IdP
        </button>
      </div>

      {creating && apiKey && (
        <CreateWorkforceAppForm
          apiKey={apiKey}
          onDone={() => { setCreating(false); refetch(); }}
          onCancel={() => setCreating(false)}
        />
      )}

      {loading ? (
        <div className="h-64 animate-pulse rounded-2xl border border-border/50 bg-panel" />
      ) : !apps || apps.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/50 bg-panel/20 p-16 text-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-info/10">
            <Building2 className="h-8 w-8 text-info" />
          </div>
          <h2 className="mb-2 text-xl font-semibold">No IdP apps connected</h2>
          <p className="max-w-md text-sm text-text-secondary">
            Connect your Okta, Entra, Google Workspace, or Auth0 tenant to
            start binding workforce sessions with DBSC.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {apps.map((app) => (
            <div
              key={app.id}
              className="flex items-center justify-between rounded-xl border border-border/50 bg-panel px-5 py-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{app.name}</span>
                  <span className="rounded bg-surface px-2 py-0.5 text-xs text-text-tertiary">
                    {IDP_LABELS[app.idpType] ?? app.idpType}
                  </span>
                  <span className={`rounded px-2 py-0.5 text-xs ${app.enabled ? 'bg-success/20 text-success' : 'bg-surface text-text-tertiary'}`}>
                    {app.enabled ? 'Active' : 'Disabled'}
                  </span>
                </div>
                <p className="mt-1 truncate text-xs text-text-secondary">{app.issuer}</p>
              </div>
              <button
                type="button"
                title="Delete app"
                onClick={async () => { await deleteWorkforceApp(apiKey!, app.id); refetch(); }}
                className="p-2 hover:bg-destructive/10 rounded-lg transition"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
