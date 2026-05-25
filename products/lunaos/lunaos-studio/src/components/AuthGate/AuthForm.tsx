/**
 * AuthForm — login/signup form with email + password.
 * Apple HIG styling, dark mode support.
 */

import React, { useState } from 'react';
import { login, signup, ApiError, type User } from '../../lib/api-client';
import { useDarkMode } from '../../hooks/useDarkMode';
import {
  spacing, radius, fontFamily, fontSize, fontWeight, colors, shadow,
} from '../../lib/theme';
import { OAuthButtons } from './OAuthButtons';

interface AuthFormProps {
  onSuccess: (user: User) => void;
}

export function AuthForm({ onSuccess }: AuthFormProps) {
  const isDark = useDarkMode();
  const c = isDark ? colors.dark : colors.light;
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const user = mode === 'login'
        ? await login(email, password)
        : await signup(email, password, name);
      onSuccess(user);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Connection failed');
    } finally {
      setSubmitting(false);
    }
  };

  const containerStyle: React.CSSProperties = {
    fontFamily, display: 'flex', alignItems: 'center', justifyContent: 'center',
    height: '100vh', width: '100vw', background: c.bg,
  };

  const cardStyle: React.CSSProperties = {
    width: 380, padding: spacing.xl, borderRadius: radius.lg,
    background: isDark ? '#1C1C1E' : '#FFFFFF',
    border: `1px solid ${c.separator}`, boxShadow: shadow.lg,
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: `${spacing.sm}px ${spacing.md}px`,
    borderRadius: radius.sm, border: `1px solid ${c.separator}`,
    background: isDark ? '#2C2C2E' : '#F2F2F7', color: c.text,
    fontSize: fontSize.body, fontFamily, outline: 'none',
    marginBottom: spacing.md,
  };

  const btnStyle: React.CSSProperties = {
    width: '100%', padding: `${spacing.sm + 2}px 0`,
    borderRadius: radius.sm, border: 'none', background: c.accent,
    color: '#FFFFFF', fontWeight: fontWeight.semibold,
    fontSize: fontSize.body, cursor: submitting ? 'default' : 'pointer',
    fontFamily, opacity: submitting ? 0.6 : 1,
  };

  const linkStyle: React.CSSProperties = {
    background: 'none', border: 'none', color: c.accent,
    cursor: 'pointer', fontSize: fontSize.subheadline, fontFamily,
  };

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <h1 style={{ fontSize: fontSize.title2, fontWeight: fontWeight.bold, color: c.text, margin: `0 0 ${spacing.xs}px`, textAlign: 'center' }}>
          LunaOS Studio
        </h1>
        <p style={{ fontSize: fontSize.subheadline, color: c.textSecondary, textAlign: 'center', margin: `0 0 ${spacing.lg}px` }}>
          {mode === 'login' ? 'Sign in to your account' : 'Create your account'}
        </p>

        <OAuthButtons onSuccess={onSuccess} />

        <form onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <input style={inputStyle} placeholder="Name" value={name}
              onChange={(e) => setName(e.target.value)} aria-label="Name" />
          )}
          <input style={inputStyle} type="email" placeholder="Email" value={email}
            onChange={(e) => setEmail(e.target.value)} required aria-label="Email" />
          <input style={inputStyle} type="password" placeholder="Password" value={password}
            onChange={(e) => setPassword(e.target.value)} required minLength={8} aria-label="Password" />

          {error && (
            <p style={{ color: c.red, fontSize: fontSize.caption1, margin: `0 0 ${spacing.sm}px` }}>
              {error}
            </p>
          )}

          <button type="submit" style={btnStyle} disabled={submitting}>
            {submitting ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: spacing.md }}>
          <button style={linkStyle} onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }}>
            {mode === 'login' ? 'Don\'t have an account? Sign up' : 'Already have an account? Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
}
