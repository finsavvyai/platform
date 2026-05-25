/**
 * OAuthCallback — handles the redirect from the OAuth provider.
 * Extracts the token from the URL, stores it, and redirects to the app.
 */

import React, { useEffect, useState } from 'react';
import { setToken, getMe, type User } from '../../lib/api-client';
import { useDarkMode } from '../../hooks/useDarkMode';
import { colors, fontFamily, fontSize } from '../../lib/theme';

interface OAuthCallbackProps {
  onSuccess: (user: User) => void;
}

export function OAuthCallback({ onSuccess }: OAuthCallbackProps) {
  const isDark = useDarkMode();
  const c = isDark ? colors.dark : colors.light;
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const oauthError = params.get('error');

    if (oauthError) {
      setError(oauthError);
      return;
    }

    if (!token) {
      setError('No authentication token received.');
      return;
    }

    setToken(token);

    getMe()
      .then((user) => {
        // Clean the URL without reloading
        window.history.replaceState({}, '', '/');
        onSuccess(user);
      })
      .catch(() => {
        setError('Failed to retrieve user profile.');
      });
  }, [onSuccess]);

  const containerStyle: React.CSSProperties = {
    fontFamily,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    width: '100vw',
    background: c.bg,
  };

  if (error) {
    return (
      <div style={containerStyle} role="alert">
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: c.red, fontSize: fontSize.body, fontFamily }}>
            {error}
          </p>
          <button
            type="button"
            onClick={() => { window.location.href = '/'; }}
            style={{
              marginTop: 16,
              background: 'none',
              border: 'none',
              color: c.accent,
              fontSize: fontSize.body,
              fontFamily,
              cursor: 'pointer',
            }}
          >
            Return to login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle} role="status" aria-live="polite">
      <p style={{ color: c.textSecondary, fontSize: fontSize.body, fontFamily }}>
        Completing sign in...
      </p>
    </div>
  );
}
