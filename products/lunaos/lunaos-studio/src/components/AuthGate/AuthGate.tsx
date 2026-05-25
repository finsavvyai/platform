/**
 * AuthGate — checks for valid JWT. Shows login/signup form if not
 * authenticated. Renders children when authenticated.
 */

import React, { useState, useEffect } from 'react';
import { isAuthenticated, getMe, type User } from '../../lib/api-client';
import { useDarkMode } from '../../hooks/useDarkMode';
import { colors, fontFamily, fontSize } from '../../lib/theme';
import { AuthForm } from './AuthForm';
import { OAuthCallback } from './OAuthCallback';

interface AuthGateProps {
  children: (user: User) => React.ReactNode;
}

export function AuthGate({ children }: AuthGateProps) {
  const isDark = useDarkMode();
  const c = isDark ? colors.dark : colors.light;
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated()) {
      setLoading(false);
      return;
    }
    getMe()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={centerStyle(c)} role="status" aria-live="polite">
        <p style={{ color: c.textSecondary, fontFamily, fontSize: fontSize.body }}>
          Loading...
        </p>
      </div>
    );
  }

  const isOAuthCallback = window.location.pathname === '/auth/callback';

  if (isOAuthCallback) {
    return <OAuthCallback onSuccess={setUser} />;
  }

  if (!user) {
    return <AuthForm onSuccess={setUser} />;
  }

  return <>{children(user)}</>;
}

function centerStyle(c: { bg: string }): React.CSSProperties {
  return {
    fontFamily,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    width: '100vw',
    background: c.bg,
  };
}
