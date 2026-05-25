import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { LoginLeftPanel } from '../components/auth/LoginLeftPanel';
import { LoginForm } from '../components/auth/LoginForm';
import Logo from '../components/brand/Logo';
import { friendlyAuthError } from '../utils/authErrors';

export function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation('auth');
  const { login, loginWithToken } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = searchParams.get('token');
    const oauthError = searchParams.get('error');
    if (token) {
      window.history.replaceState({}, '', '/login');
      loginWithToken(token)
        .then(() => navigate('/dashboard', { replace: true }))
        .catch(() => setError('OAuth login failed'));
    }
    if (oauthError) {
      setError(friendlyAuthError(oauthError));
      window.history.replaceState({}, '', '/login');
    }
  }, [searchParams, navigate, loginWithToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('login.failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ background: '#0A0908' }}>
      <LoginLeftPanel />
      <div className="relative flex-1 flex flex-col items-center justify-center px-6 py-10 overflow-hidden"
        style={{ background: '#0A0908' }}>
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.025] pointer-events-none lg:hidden"
          style={{
            backgroundImage:
              'linear-gradient(rgba(201,169,110,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(201,169,110,0.5) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
          }}
        />
        <div className="relative z-10 w-full flex flex-col items-center">
          <div className="mb-8 lg:hidden" style={{ ['--text' as string]: '#F0EDE7' } as React.CSSProperties}>
            <Logo size={32} variant="light" />
          </div>
          <LoginForm
            email={email}
            password={password}
            error={error}
            loading={loading}
            onEmailChange={setEmail}
            onPasswordChange={setPassword}
            onSubmit={handleSubmit}
          />
        </div>
      </div>
    </div>
  );
}
