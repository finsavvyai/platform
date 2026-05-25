import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import SignInButtons from '../components/auth/SignInButtons'
import AuthDivider from '../components/auth/AuthDivider'
import { COUNTRIES } from '../components/auth/countries'
import { SignupLeftPanel } from '../components/auth/SignupLeftPanel'
import { PasswordStrength } from '../components/auth/PasswordStrength'
import Logo from '../components/brand/Logo'
import { authInputStyle, authInputFocus, authInputBlur, authPrimaryStyle } from '../components/auth/AuthShell'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function Signup() {
  const navigate = useNavigate()
  const { t } = useTranslation('auth')
  const { signup } = useAuth()
  const [form, setForm] = useState({ orgName: '', email: '', password: '', country: 'US' })
  const [error, setError] = useState('')
  const [accountExists, setAccountExists] = useState(false)
  const [loading, setLoading] = useState(false)

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    if (accountExists) setAccountExists(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!EMAIL_RE.test(form.email)) { setError('Please enter a valid email address.'); return }
    if (form.password.length < 8) { setError('Password must be at least 8 characters.'); return }
    setLoading(true); setError(''); setAccountExists(false)
    try {
      await signup(form.email, form.password, form.orgName, form.country)
      navigate('/onboarding')
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('signup.failed')
      const status = (err as { status?: number })?.status
      const code = (err as { code?: string })?.code?.toLowerCase() ?? ''
      const isDup = status === 409 || /exist|already|duplicate|taken/i.test(msg) || /exist|conflict|duplicate/.test(code)
      if (isDup) setAccountExists(true)
      else setError(msg)
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex" style={{ background: '#0A0908' }}>
      <SignupLeftPanel />
      <div className="relative flex-1 flex flex-col items-center justify-center px-6 py-10 overflow-hidden">
        <div className="mb-8 lg:hidden" style={{ ['--text' as string]: '#F0EDE7' } as React.CSSProperties}>
          <Logo size={32} variant="light" />
        </div>
        <div className="w-full max-w-sm space-y-6">
          <div>
            <h2 className="text-2xl font-semibold mb-2" style={{ color: '#FAFAF8', letterSpacing: '-0.02em' }}>
              {t('signup.title')}
            </h2>
            <p className="text-sm" style={{ color: 'rgba(250,250,248,0.55)' }}>
              {t('signup.subtitle')}
            </p>
          </div>
          <SignInButtons action="sign_up" />
          <AuthDivider />
          {accountExists && (
            <div role="alert" className="p-4 rounded-[10px] space-y-2"
              style={{ background: 'rgba(201,169,110,0.08)', border: '1px solid rgba(201,169,110,0.25)' }}>
              <p className="text-sm font-medium" style={{ color: '#FAFAF8' }}>
                You already have an account
              </p>
              <p className="text-xs" style={{ color: 'rgba(250,250,248,0.62)' }}>
                An account with <span className="font-medium">{form.email}</span> already exists.
              </p>
              <div className="flex gap-2 pt-1">
                <Link to={`/login?email=${encodeURIComponent(form.email)}`}
                  className="text-xs font-medium underline" style={{ color: '#C9A96E' }}>
                  Sign in instead
                </Link>
                <span className="text-xs" style={{ color: 'rgba(250,250,248,0.4)' }}>·</span>
                <Link to={`/forgot-password?email=${encodeURIComponent(form.email)}`}
                  className="text-xs font-medium underline" style={{ color: '#C9A96E' }}>
                  Reset password
                </Link>
              </div>
            </div>
          )}
          {error && (
            <div role="alert" className="p-3 rounded-[10px]"
              style={{ background: 'rgba(224,82,82,0.08)', border: '1px solid rgba(224,82,82,0.25)' }}>
              <p className="text-sm" style={{ color: '#FF8A85' }}>{error}</p>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-3">
            <input type="text" value={form.orgName} onChange={set('orgName')} required
              aria-label="Organization name" autoComplete="organization"
              placeholder={t('signup.org_placeholder')} style={authInputStyle}
              onFocus={authInputFocus} onBlur={authInputBlur} />
            <input type="email" value={form.email} onChange={set('email')} required
              aria-label="Email" autoComplete="email" pattern="[^\s@]+@[^\s@]+\.[^\s@]+"
              placeholder={t('signup.email_placeholder')} style={authInputStyle}
              onFocus={authInputFocus} onBlur={authInputBlur} />
            <div>
              <input type="password" value={form.password} onChange={set('password')} required
                aria-label="Password" autoComplete="new-password" minLength={8}
                placeholder={t('signup.password_placeholder')} style={authInputStyle}
                onFocus={authInputFocus} onBlur={authInputBlur} />
              <PasswordStrength password={form.password} />
            </div>
            <select value={form.country} onChange={set('country')} aria-label="Country"
              style={authInputStyle} onFocus={authInputFocus} onBlur={authInputBlur}>
              {COUNTRIES.map((c) => <option key={c.code} value={c.code} style={{ background: '#110F0C', color: '#FAFAF8' }}>{c.name}</option>)}
            </select>
            <button type="submit" disabled={loading} aria-busy={loading}
              className="inline-flex items-center justify-center gap-2 disabled:opacity-60"
              style={authPrimaryStyle}>
              {loading ? t('signup.submitting') : t('signup.submit')} <ArrowRight className="w-4 h-4" />
            </button>
          </form>
          <p className="text-center text-xs leading-relaxed" style={{ color: 'rgba(250,250,248,0.55)' }}>
            {t('signup.agree_prefix')}{' '}
            <Link to="/terms" className="hover:underline" style={{ color: '#C9A96E' }}>{t('signup.terms_link')}</Link>{' '}
            {t('signup.and')}{' '}
            <Link to="/privacy" className="hover:underline" style={{ color: '#C9A96E' }}>{t('signup.privacy_link')}</Link>.
          </p>
          <p className="text-center text-xs" style={{ color: 'rgba(250,250,248,0.45)' }}>
            {t('signup.have_account')}{' '}
            <Link to="/login" className="hover:underline font-medium" style={{ color: '#C9A96E' }}>{t('signup.sign_in_link')}</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
