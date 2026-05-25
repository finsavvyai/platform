'use client';

import { useState, useCallback } from 'react';
import { Shield, Copy, Check } from 'lucide-react';
import { useApi } from '@/lib/use-api';
import { fetchTenantInfo } from '@/lib/tokenforge-api';

interface TenantInfo {
  id: string;
  plan: string;
  name: string;
  email: string;
  used: number;
  limit: number;
}

export function TrustBadgeSnippet(): React.ReactElement {
  const [copied, setCopied] = useState(false);
  const fetcher = useCallback(
    (token: string, signal: AbortSignal) => fetchTenantInfo(token, signal),
    [],
  );
  const { data: tenant } = useApi<TenantInfo>(fetcher);

  const tenantId = tenant?.id ?? '...';
  const snippet = `<script src="https://tokenforge-api.opensyber.cloud/badge.js" data-tenant-id="${tenantId}"></script>`;

  function handleCopy(): void {
    navigator.clipboard.writeText(snippet).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="rounded-xl border border-border bg-panel p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-500/10">
          <Shield className="h-5 w-5 text-green-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Trust Badge</h2>
          <p className="text-sm text-text-secondary">
            Show visitors your site is protected by TokenForge
          </p>
        </div>
      </div>

      <p className="mb-4 text-sm text-text-secondary">
        Add this to your site. It shows a &quot;Protected by TokenForge&quot; badge
        linking to your public trust page.
      </p>

      <div className="relative rounded-lg border border-border bg-void p-4">
        <code className="block overflow-x-auto whitespace-pre text-xs text-text-secondary">
          {snippet}
        </code>
        <button
          onClick={handleCopy}
          disabled={!tenant}
          className="absolute right-3 top-3 rounded-md border border-wire bg-surface p-1.5 text-text-secondary hover:text-white disabled:opacity-50 transition"
        >
          {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
