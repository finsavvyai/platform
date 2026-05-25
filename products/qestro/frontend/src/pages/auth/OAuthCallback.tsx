/**
 * OAuth Callback Handler
 * Receives tokens from the OAuth redirect and stores them.
 */
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { Loader2 } from 'lucide-react';

export default function OAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setUser, setAuthenticated } = useAuthStore();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const accessToken = searchParams.get('access_token');
    const refreshToken = searchParams.get('refresh_token');
    const userId = searchParams.get('user_id');
    const email = searchParams.get('email');
    const name = searchParams.get('name');
    const avatar = searchParams.get('avatar');
    const provider = searchParams.get('provider');
    const errParam = searchParams.get('error');

    if (errParam) {
      setError(`Login failed: ${errParam}`);
      setTimeout(() => navigate('/login'), 3000);
      return;
    }

    if (!accessToken || !email) {
      setError('Missing authentication data');
      setTimeout(() => navigate('/login'), 3000);
      return;
    }

    // Store tokens
    localStorage.setItem('access_token', accessToken);
    if (refreshToken) {
      localStorage.setItem('refresh_token', refreshToken);
    }

    // Update auth store
    const nameParts = (name || email.split('@')[0]).split(' ');
    setUser({
      id: userId || `oauth-${Date.now()}`,
      email,
      name: name || email.split('@')[0],
      firstName: nameParts[0],
      lastName: nameParts.slice(1).join(' ') || '',
      role: 'user',
      subscription: 'pro',
      avatar: avatar || undefined,
      preferences: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      authMethod: provider || 'oauth',
    });

    setAuthenticated(true);

    navigate('/');
  }, [searchParams, navigate, setUser, setAuthenticated]);

  if (error) {
    return (
      <div className="min-h-screen bg-[#1a1f37] flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-lg mb-2">{error}</p>
          <p className="text-gray-500">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a1f37] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-gray-400">Completing sign in...</p>
      </div>
    </div>
  );
}
