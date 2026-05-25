'use client';

import { useState } from 'react';
import { Copy, Check, Award } from 'lucide-react';
import { API_BASE_URL } from '@/lib/api-config';

interface Props {
  instanceId: string;
}

export function BadgeEmbed({ instanceId }: Props) {
  const [copied, setCopied] = useState<'md' | 'html' | null>(null);

  // Absolute production URL — goes into README embeds on other sites.
  const badgeUrl = `${API_BASE_URL}/api/badges/${instanceId}/security-score`;
  // Same-origin proxy URL — works for the in-dashboard preview regardless
  // of CSP, regional deployment, or local dev API base.
  const previewUrl = `/api/proxy/badges/${instanceId}/security-score`;
  const markdownSnippet = `![Security Score](${badgeUrl})`;
  const htmlSnippet = `<img src="${badgeUrl}" alt="Security Score" />`;

  async function handleCopy(type: 'md' | 'html') {
    const text = type === 'md' ? markdownSnippet : htmlSnippet;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Clipboard API may not be available
    }
  }

  return (
    <div className="rounded border border-border bg-panel/30 p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface">
          <Award className="h-4 w-4 text-text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Security Badge</h3>
          <p className="text-sm text-text-secondary">
            Embed your security score in README files or websites
          </p>
        </div>
      </div>

      {/* Badge preview — uses same-origin proxy so CSP always allows it. */}
      <div className="mb-4 flex items-center justify-center rounded-lg bg-surface/50 p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={previewUrl} alt="Security Score Badge" />
      </div>

      {/* Markdown snippet */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs text-text-dim font-medium">Markdown</p>
          <button
            onClick={() => handleCopy('md')}
            className="flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary transition"
          >
            {copied === 'md' ? (
              <><Check className="h-3 w-3 text-green-400" /> Copied</>
            ) : (
              <><Copy className="h-3 w-3" /> Copy</>
            )}
          </button>
        </div>
        <div className="rounded-lg bg-surface/50 px-3 py-2">
          <code className="text-xs text-text-primary break-all">{markdownSnippet}</code>
        </div>
      </div>

      {/* HTML snippet */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs text-text-dim font-medium">HTML</p>
          <button
            onClick={() => handleCopy('html')}
            className="flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary transition"
          >
            {copied === 'html' ? (
              <><Check className="h-3 w-3 text-green-400" /> Copied</>
            ) : (
              <><Copy className="h-3 w-3" /> Copy</>
            )}
          </button>
        </div>
        <div className="rounded-lg bg-surface/50 px-3 py-2">
          <code className="text-xs text-text-primary break-all">{htmlSnippet}</code>
        </div>
      </div>
    </div>
  );
}
