'use client';

import { signIn } from 'next-auth/react';
import { Check, Plus } from 'lucide-react';

const PROVIDERS = [
  { id: 'google', name: 'Google', color: '#4285F4' },
  { id: 'github', name: 'GitHub', color: '#ffffff' },
  { id: 'microsoft-entra-id', name: 'Microsoft', color: '#0078D4' },
  { id: 'linkedin', name: 'LinkedIn', color: '#0A66C2' },
];

interface Props {
  currentProvider: string | null;
  email: string;
}

export function ConnectedAccounts({ currentProvider, email }: Props) {
  return (
    <div className="mb-8 rounded border border-border bg-panel/30 p-6">
      <h3 className="text-lg font-semibold mb-2">Connected Accounts</h3>
      <p className="text-sm text-text-secondary mb-4">
        Sign in with any connected provider. Same email ({email}) = same account.
      </p>
      <div className="space-y-3">
        {PROVIDERS.map((provider) => {
          const isConnected = currentProvider === provider.id;
          return (
            <div
              key={provider.id}
              className="flex items-center justify-between rounded-lg border border-border p-3"
            >
              <div className="flex items-center gap-3">
                <div
                  className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ backgroundColor: provider.color + '20', color: provider.color }}
                >
                  {provider.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-medium">{provider.name}</p>
                  {isConnected && (
                    <p className="text-xs text-ok">Currently signed in</p>
                  )}
                </div>
              </div>
              {isConnected ? (
                <div className="flex items-center gap-1 text-xs text-ok">
                  <Check className="h-3.5 w-3.5" />
                  Connected
                </div>
              ) : (
                <button
                  onClick={() => signIn(provider.id, { callbackUrl: '/dashboard/profile' })}
                  className="flex items-center gap-1 rounded border border-wire px-3 py-1.5 text-xs text-text-secondary hover:bg-surface transition"
                >
                  <Plus className="h-3 w-3" />
                  Connect
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
