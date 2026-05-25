import { useState } from 'react';
import { useLinkedAccounts, LinkedAccount } from '../hooks/useLinkedAccounts';
import { btnGesturePrimary, btnGestureSubtle } from '../styles/gestures';

type ScmProvider = 'github' | 'gitlab' | 'bitbucket';

interface ProviderMeta {
  label: string;
  color: string;
  icon: JSX.Element;
}

const SCM_PROVIDERS: Record<ScmProvider, ProviderMeta> = {
  github: {
    label: 'GitHub',
    color: 'bg-zinc-700',
    icon: (
      <svg className="w-5 h-5 text-zinc-200" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207
                 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033
                 -1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756
                 -1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237
                 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775
                 .418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467
                 -5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535
                 -1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509
                 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404
                 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242
                 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0
                 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823
                 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24
                 17.3 24 12c0-6.627-5.373-12-12-12z"/>
      </svg>
    ),
  },
  gitlab: {
    label: 'GitLab',
    color: 'bg-orange-700',
    icon: (
      <svg className="w-5 h-5 text-orange-300" fill="currentColor" viewBox="0 0 24 24">
        <path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 01-.3-.94l1.22
                 -3.78 2.44-7.51a.42.42 0 01.82 0l2.44 7.51h8.06l2.44
                 -7.51a.42.42 0 01.82 0l2.44 7.51 1.22 3.78a.84.84 0
                 01-.3.94z"/>
      </svg>
    ),
  },
  bitbucket: {
    label: 'Bitbucket',
    color: 'bg-blue-700',
    icon: (
      <svg className="w-5 h-5 text-blue-300" fill="currentColor" viewBox="0 0 24 24">
        <path d="M.778 1.213a.768.768 0 00-.768.892l3.263 19.81c.084.5.515
                 .868 1.022.873H19.95a.772.772 0 00.77-.646l3.27-20.03a.768.768
                 0 00-.768-.891zM14.52 15.53H9.522L8.17 8.466h7.561z"/>
      </svg>
    ),
  },
};

const ALL_SCM: ScmProvider[] = ['github', 'gitlab', 'bitbucket'];

function CheckIcon() {
  return (
    <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

interface AccountRowProps {
  provider: ScmProvider;
  account: LinkedAccount | undefined;
  isPrimary: boolean;
  onLink: (p: ScmProvider) => void;
  onUnlink: (p: ScmProvider) => void;
  unlinking: ScmProvider | null;
}

function AccountRow({ provider, account, isPrimary, onLink, onUnlink, unlinking }: AccountRowProps) {
  const meta = SCM_PROVIDERS[provider];
  const linked = Boolean(account);

  return (
    <div className="flex items-center justify-between py-3 border-b border-surface-border last:border-b-0">
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 ${meta.color} rounded-lg flex items-center justify-center`}>
          {meta.icon}
        </div>
        <div>
          <p className="text-sm font-medium text-zinc-200">{meta.label}</p>
          {linked && account ? (
            <p className="text-xs text-zinc-500">
              {account.login}
              {isPrimary && (
                <span className="ml-1.5 text-emerald-400 font-medium">Primary</span>
              )}
            </p>
          ) : (
            <p className="text-xs text-zinc-500">Not connected</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {linked ? (
          <>
            <span className="flex items-center gap-1 text-xs text-emerald-400">
              <CheckIcon />
              Connected
            </span>
            {!isPrimary && (
              <button
                onClick={() => onUnlink(provider)}
                disabled={unlinking === provider}
                className={`text-xs px-3 py-1.5 rounded text-zinc-400 hover:text-red-400
                           bg-zinc-800 hover:bg-zinc-700 border border-surface-border
                           disabled:opacity-50 ${btnGestureSubtle}`}
              >
                {unlinking === provider ? 'Removing...' : 'Disconnect'}
              </button>
            )}
          </>
        ) : (
          <button
            onClick={() => onLink(provider)}
            className={`text-xs px-3 py-1.5 rounded font-medium text-emerald-400
                       bg-emerald-500/10 border border-emerald-500/20
                       hover:bg-emerald-500/20 ${btnGesturePrimary}`}
          >
            Link {meta.label}
          </button>
        )}
      </div>
    </div>
  );
}

interface AccountLinkingProps {
  userProvider?: string;
}

export default function AccountLinking({ userProvider }: AccountLinkingProps) {
  const { accounts, loading, error, linkAccount, unlinkAccount } = useLinkedAccounts();
  const [unlinking, setUnlinking] = useState<ScmProvider | null>(null);

  const linkedMap = new Map<ScmProvider, LinkedAccount>();
  for (const acct of accounts) {
    linkedMap.set(acct.provider, acct);
  }

  const handleUnlink = async (provider: ScmProvider) => {
    setUnlinking(provider);
    await unlinkAccount(provider);
    setUnlinking(null);
  };

  if (loading) {
    return (
      <div className="bg-surface-card border border-surface-border rounded-xl p-5">
        <div className="animate-pulse space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-9 h-9 bg-zinc-700 rounded-lg" />
              <div className="flex-1 h-4 bg-zinc-700 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-card border border-surface-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-medium text-zinc-200">SCM Accounts</h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            Link source control accounts for repository access
          </p>
        </div>
        <span className="text-xs text-zinc-500">
          {accounts.length} of {ALL_SCM.length} linked
        </span>
      </div>

      {error && (
        <div className="mb-4 px-3 py-2 text-xs text-red-400 bg-red-500/10
                        border border-red-500/20 rounded-lg">
          {error}
        </div>
      )}

      <div className="divide-y divide-surface-border">
        {ALL_SCM.map((provider) => (
          <AccountRow
            key={provider}
            provider={provider}
            account={linkedMap.get(provider)}
            isPrimary={userProvider === provider}
            onLink={(p) => void linkAccount(p)}
            onUnlink={(p) => void handleUnlink(p)}
            unlinking={unlinking}
          />
        ))}
      </div>

      {accounts.length === 0 && (
        <p className="mt-3 text-xs text-zinc-500 text-center">
          Link at least one SCM account to import repositories.
        </p>
      )}
    </div>
  );
}
