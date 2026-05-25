import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const SAFETY_TIMEOUT_MS = 30_000;

export default function AuthCallback() {
  const navigate = useNavigate();
  const [stalled, setStalled] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state') || '';
    // Mobile OAuth: bounce back to the native app via custom scheme.
    // The mobile app's WebBrowser.openAuthSessionAsync intercepts pushci://
    // and returns control to the app with the auth code.
    if (state.startsWith('mobile:') && code) {
      const deepLink = `pushci://auth/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`;
      window.location.replace(deepLink);
      return undefined;
    }
    if (!code) {
      navigate('/', { replace: true });
      return undefined;
    }
    // If useAuth's exchange takes too long, surface a recovery path so users
    // are not stuck on a spinner forever.
    const timer = window.setTimeout(() => setStalled(true), SAFETY_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [navigate]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="min-h-screen bg-zinc-950 flex items-center justify-center px-4"
    >
      <div className="text-center max-w-sm">
        {!stalled ? (
          <>
            <div
              aria-hidden="true"
              className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"
            />
            <p className="text-zinc-400 text-sm">Authenticating…</p>
            <p className="sr-only">Completing sign-in, please wait.</p>
          </>
        ) : (
          <div className="space-y-3" role="alert">
            <p className="text-zinc-200 text-sm font-medium">Still authenticating.</p>
            <p className="text-zinc-500 text-xs">
              This is taking longer than expected. The OAuth provider may be slow or
              your network may be intermittent.
            </p>
            <button
              type="button"
              onClick={() => navigate('/', { replace: true })}
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-zinc-100 hover:bg-zinc-700 transition-colors"
            >
              Back to sign-in
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
