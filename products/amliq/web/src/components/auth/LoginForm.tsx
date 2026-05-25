import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import SignInButtons from './SignInButtons';
import AuthDivider from './AuthDivider';

interface Props {
  email: string;
  password: string;
  error: string;
  loading: boolean;
  onEmailChange: (v: string) => void;
  onPasswordChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

const inputStyle: React.CSSProperties = {
  background: 'rgba(250,250,248,0.04)',
  border: '1px solid rgba(250,250,248,0.10)',
  color: '#FAFAF8',
  borderRadius: 10,
  width: '100%',
  padding: '12px 16px',
  fontSize: 14,
  minHeight: 48,
  outline: 'none',
  transition: 'all 0.2s ease',
};

export function LoginForm({ email, password, error, loading, onEmailChange, onPasswordChange, onSubmit }: Props) {
  const { t } = useTranslation('auth');

  return (
    <div className="w-full max-w-sm space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-2" style={{ color: '#FAFAF8', letterSpacing: '-0.02em' }}>
          {t('login.title')}
        </h2>
        <p className="text-sm" style={{ color: 'rgba(250,250,248,0.55)' }}>
          {t('login.subtitle')}
        </p>
      </div>

      <SignInButtons action="sign_in" />
      <AuthDivider />

      {error && (
        <div
          role="alert"
          className="p-3 rounded-[10px]"
          style={{ background: 'rgba(224,82,82,0.08)', border: '1px solid rgba(224,82,82,0.25)' }}
        >
          <p className="text-sm" style={{ color: '#FF8A85' }}>{error}</p>
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-4">
        <input
          type="email"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          required
          aria-label="Email"
          autoComplete="email"
          pattern="[^\s@]+@[^\s@]+\.[^\s@]+"
          placeholder={t('login.email_placeholder')}
          style={inputStyle}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = '#C9A96E'
            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(201,169,110,0.18)'
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'rgba(250,250,248,0.10)'
            e.currentTarget.style.boxShadow = 'none'
          }}
        />
        <div>
          <input
            type="password"
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            required
            aria-label="Password"
            autoComplete="current-password"
            placeholder={t('login.password_placeholder')}
            style={inputStyle}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = '#C9A96E'
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(201,169,110,0.18)'
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'rgba(250,250,248,0.10)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          />
          <div className="flex justify-end mt-2">
            <Link
              to="/forgot-password"
              className="text-xs hover:underline"
              style={{ color: '#C9A96E' }}
            >
              {t('login.forgot_password')}
            </Link>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          aria-busy={loading}
          className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold rounded-[10px] transition-all disabled:opacity-60"
          style={{ background: '#C9A96E', color: '#0A0908' }}
          onMouseEnter={(e) => {
            if (loading) return
            e.currentTarget.style.background = '#D4B882'
            e.currentTarget.style.transform = 'translateY(-1px)'
            e.currentTarget.style.boxShadow = '0 12px 32px rgba(201,169,110,0.38)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#C9A96E'
            e.currentTarget.style.transform = 'none'
            e.currentTarget.style.boxShadow = 'none'
          }}
        >
          {loading ? t('login.submitting') : t('login.submit')} <ArrowRight className="w-4 h-4" />
        </button>
      </form>

      <p className="text-center text-xs" style={{ color: 'rgba(250,250,248,0.5)' }}>
        {t('login.no_account')}{' '}
        <Link to="/signup" className="hover:underline font-medium" style={{ color: '#C9A96E' }}>
          {t('login.start_trial')}
        </Link>
      </p>
    </div>
  );
}
