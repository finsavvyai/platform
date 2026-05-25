import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { API_BASE_URL } from '../config';
import { btnGesturePrimary } from '../styles/gestures';

export default function CliAuthPage() {
  const { user, token, loginWithGitHub, loginWithGitLab, providers } = useAuth();
  const [cliToken, setCliToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tenant = new URLSearchParams(window.location.search).get('tenant');

  useEffect(() => {
    // SSO flow: unauthenticated user arrives with ?tenant=acme —
    // redirect to the SAML IdP login, which will post back to
    // /saml/acme/acs and set the session cookie before bouncing
    // back here with the JWT ready to display.
    if (!user && tenant) {
      window.location.href = `${API_BASE_URL}/saml/${encodeURIComponent(tenant)}/login?returnTo=${encodeURIComponent(window.location.href)}`;
      return;
    }
    if (!token) return;
    fetch(`${API_BASE_URL}/api/auth/cli/token`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: { token?: string; error?: string }) => {
        if (data.token) setCliToken(data.token);
        else setError(data.error || 'Failed to generate token');
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Network error'));
  }, [token, user, tenant]);

  const handleCopy = () => {
    if (!cliToken) return;
    navigator.clipboard.writeText(cliToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  if (!user) {
    if (tenant) {
      return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
          <div className="bg-zinc-900 rounded-xl p-8 max-w-md w-full text-center border border-zinc-800">
            <h1 className="text-xl font-semibold text-white mb-2">PushCI SSO Login</h1>
            <p className="text-zinc-400 mb-4">Redirecting to your SSO provider for <span className="text-white font-medium">{tenant}</span>...</p>
            <div className="flex justify-center py-4">
              <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
        <div className="bg-zinc-900 rounded-xl p-8 max-w-md w-full text-center border border-zinc-800">
          <h1 className="text-xl font-semibold text-white mb-2">PushCI CLI Login</h1>
          <p className="text-zinc-400 mb-6">Log in to connect your CLI</p>
          <div className="space-y-3">
            {providers.github && (
              <button onClick={loginWithGitHub} className={`w-full py-3 rounded-lg font-medium bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-100 ${btnGesturePrimary}`}>
                Continue with GitHub
              </button>
            )}
            {providers.gitlab && (
              <button onClick={loginWithGitLab} className={`w-full py-3 rounded-lg font-medium bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-100 ${btnGesturePrimary}`}>
                Continue with GitLab
              </button>
            )}
            {!providers.github && !providers.gitlab && (
              <p className="text-zinc-500 text-sm">No login providers configured.</p>
            )}
            <p className="text-zinc-500 text-xs mt-4">
              Enterprise SSO? Use <code className="bg-zinc-800 px-1 rounded">pushci login --tenant your-org</code>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
      <div className="bg-zinc-900 rounded-xl p-8 max-w-lg w-full border border-zinc-800">
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-white">CLI Authentication</h1>
          <p className="text-zinc-400 mt-1">
            Logged in as <span className="text-white font-medium">{user.login}</span>
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {cliToken ? (
          <>
            <p className="text-zinc-400 text-sm mb-3">
              Copy this token and paste it in your terminal:
            </p>
            <div className="bg-zinc-950 border border-zinc-700 rounded-lg p-3 font-mono text-xs text-zinc-300 break-all select-all mb-4">
              {cliToken}
            </div>
            <button
              onClick={handleCopy}
              className="w-full py-2.5 rounded-lg font-medium transition-colors bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              {copied ? 'Copied!' : 'Copy Token'}
            </button>
            <p className="text-zinc-500 text-xs mt-4 text-center">
              This token is valid for 1 year. You can close this page after copying.
            </p>
          </>
        ) : !error ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="text-center py-4 space-y-3">
            <p className="text-zinc-400 text-sm">Token generation failed.</p>
            <button
              onClick={() => { setError(null); window.location.reload(); }}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              Try again
            </button>
            <p className="text-zinc-500 text-xs">
              Still failing? Email <a href="mailto:support@pushci.dev" className="text-emerald-400 hover:underline">support@pushci.dev</a>.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
