import { btnGesturePrimary } from '../styles/gestures';
import type { ProviderAvailability } from '../lib/auth/types';

interface Props {
  onGitHubLogin: () => void;
  onGitLabLogin: () => void;
  onGoogleLogin: () => void;
  onLinkedInLogin: () => void;
  onFacebookLogin: () => void;
  onBitbucketLogin: () => void;
  onMicrosoftLogin: () => void;
  providers: ProviderAvailability;
  error: string | null;
}

function ProviderButton({ onClick, enabled, icon, label }: {
  onClick: () => void; enabled: boolean; icon: React.ReactNode; label: string;
}) {
  return (
    <button
      onClick={onClick}
      type="button"
      disabled={!enabled}
      aria-label={enabled ? `Continue with ${label}` : `${label} sign-in is not configured`}
      className={`w-full flex items-center justify-center gap-3 px-6 py-3
                 rounded-lg font-medium transition-colors border
                 disabled:cursor-not-allowed disabled:bg-zinc-900 disabled:border-zinc-800 disabled:text-zinc-600
                 enabled:bg-zinc-800 enabled:hover:bg-zinc-700 enabled:border-zinc-700 enabled:text-zinc-100
                 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-500
                 ${enabled ? btnGesturePrimary : ''}`}
    >
      <span aria-hidden="true" className="contents">{icon}</span>
      <span>{enabled ? `Continue with ${label}` : `${label} not configured`}</span>
    </button>
  );
}

export default function LoginPage({
  onGitHubLogin, onGitLabLogin, onGoogleLogin,
  onLinkedInLogin, onFacebookLogin, onBitbucketLogin,
  onMicrosoftLogin, providers, error,
}: Props) {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="max-w-sm w-full text-center space-y-6 py-6 sm:py-10 md:py-12">
        <div>
          <h1 className="text-3xl font-bold text-zinc-100">PushCI</h1>
          <p className="text-zinc-500 mt-2">
            Zero-config CI/CD for developers
          </p>
        </div>

        {error && (
          <div
            role="alert"
            aria-live="assertive"
            className="rounded-lg border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300"
          >
            {error}
          </div>
        )}

        <div className="space-y-3">
          <p className="text-xs text-zinc-500 uppercase tracking-wider">Source control</p>

          <ProviderButton onClick={onGitHubLogin} enabled={providers.github} label="GitHub" icon={
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8
                       8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338
                       .726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756
                       -1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084
                       1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304
                       3.492.997.107-.775.418-1.305.762-1.604-2.665-.305
                       -5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236
                       -3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322
                       3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005
                       2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297
                       -1.23.653 1.653.242 2.874.118 3.176.77.84 1.235
                       1.911 1.235 3.221 0 4.609-2.807 5.624-5.479
                       5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192
                       .694.801.576C20.566 21.797 24 17.3 24 12c0-6.627
                       -5.373-12-12-12z"/>
            </svg>
          } />

          <ProviderButton onClick={onGitLabLogin} enabled={providers.gitlab} label="GitLab" icon={
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0
                       1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1
                       4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1
                       .11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0
                       1 18.6 2a.43.43 0 0 1 .58 0 .42.42 0 0 1
                       .11.18l2.44 7.51L23 13.45a.84.84 0 0 1-.35.94z"/>
            </svg>
          } />

          <ProviderButton onClick={onBitbucketLogin} enabled={providers.bitbucket} label="Bitbucket" icon={
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M.778 1.213a.768.768 0 00-.768.892l3.263 19.81c.084.5.515.868 1.022.873H19.95a.772.772 0 00.77-.646l3.27-20.03a.768.768 0 00-.768-.892zM14.52 15.53H9.522L8.17 8.466h7.561z"/>
            </svg>
          } />
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-zinc-800" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-zinc-950 px-3 text-zinc-600">or continue with</span>
          </div>
        </div>

        <div className="space-y-3">
          <ProviderButton onClick={onGoogleLogin} enabled={providers.google} label="Google" icon={
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          } />

          <ProviderButton onClick={onMicrosoftLogin} enabled={providers.microsoft} label="Microsoft" icon={
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <rect fill="#F25022" x="1" y="1" width="10" height="10"/>
              <rect fill="#7FBA00" x="13" y="1" width="10" height="10"/>
              <rect fill="#00A4EF" x="1" y="13" width="10" height="10"/>
              <rect fill="#FFB900" x="13" y="13" width="10" height="10"/>
            </svg>
          } />

          <ProviderButton onClick={onLinkedInLogin} enabled={providers.linkedin} label="LinkedIn" icon={
            <svg className="w-5 h-5" fill="#0A66C2" viewBox="0 0 24 24">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
          } />

          <ProviderButton onClick={onFacebookLogin} enabled={providers.facebook} label="Facebook" icon={
            <svg className="w-5 h-5" fill="#1877F2" viewBox="0 0 24 24">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
          } />
        </div>

        <p className="text-zinc-600 text-xs">
          Free forever for open source.
          Pro starts at $9/mo.
        </p>
      </div>
    </div>
  );
}
