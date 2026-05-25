import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, AlertCircle } from 'lucide-react';
import { Button } from '../components/atoms';

export default function SSOCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get('code');
    const errorParam = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    if (errorParam) {
      setError(errorDescription || 'SSO authentication failed. Please try again.');
      return;
    }

    if (!code) {
      setError('No authorization code received. Please try signing in again.');
      return;
    }

    // Exchange the code for tokens via the backend
    const exchangeCode = async () => {
      try {
        const response = await fetch('/api/auth/sso/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, provider: searchParams.get('provider') || 'unknown' }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => null);
          throw new Error(data?.error || 'SSO authentication failed');
        }

        const data = await response.json();

        if (data.tokens?.accessToken) {
          localStorage.setItem('accessToken', data.tokens.accessToken);
          if (data.tokens.refreshToken) {
            localStorage.setItem('refreshToken', data.tokens.refreshToken);
          }
          navigate('/', { replace: true });
        } else {
          throw new Error('Invalid response from server');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Authentication failed. Please try again.');
      }
    };

    exchangeCode();
  }, [searchParams, navigate]);

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-white mb-2">Sign-in Failed</h1>
          <p className="text-slate-400 mb-6">{error}</p>
          <Button onClick={() => navigate('/login')} variant="outline">
            Back to Login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-6">
      <div className="text-center">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-4" />
        <p className="text-slate-300">Completing sign-in...</p>
      </div>
    </div>
  );
}
