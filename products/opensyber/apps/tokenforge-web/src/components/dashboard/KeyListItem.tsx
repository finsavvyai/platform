'use client';

import { Eye, EyeOff, Trash2 } from 'lucide-react';
import { DomainEditor } from './DomainEditor';
import type { ApiKey } from './types';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

interface KeyListItemProps {
  apiKey: ApiKey;
  visible: boolean;
  onToggleVisibility: () => void;
  isRevoking: boolean;
  onRevoke: () => void;
  onDomainsUpdate: (keyId: string, domains: string[]) => void;
}

/**
 * Single API key row with prefix toggle, metadata, revoke, and domain editor.
 */
export function KeyListItem({
  apiKey,
  visible,
  onToggleVisibility,
  isRevoking: _isRevoking,
  onRevoke,
  onDomainsUpdate,
}: KeyListItemProps): React.ReactElement {
  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div>
            <p className="text-sm font-medium">{apiKey.name}</p>
            <p className="font-mono text-xs text-text-muted">
              {visible ? apiKey.prefix : '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022'}
            </p>
          </div>
          <button
            onClick={onToggleVisibility}
            className="rounded p-1 text-text-muted hover:text-text-secondary transition"
            title={visible ? 'Hide key' : 'Show key'}
          >
            {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right text-xs text-text-muted">
            <p>Created {formatDate(apiKey.createdAt)}</p>
            <p>{apiKey.lastUsedAt ? `Last used ${formatDate(apiKey.lastUsedAt)}` : 'Never used'}</p>
          </div>
          <button
            onClick={onRevoke}
            className="rounded-lg bg-red-600/10 p-2 text-red-400 hover:bg-red-600/20 transition"
            title="Delete key"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      <DomainEditor
        keyId={apiKey.id}
        initialDomains={apiKey.allowedDomains ?? []}
        onSave={onDomainsUpdate}
      />
    </div>
  );
}
