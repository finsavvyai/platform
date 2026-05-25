import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, ArrowRight, Mail } from 'lucide-react'
import { api } from '../api/client'
import { AuthShell, authInputStyle, authInputFocus, authInputBlur, authPrimaryStyle } from '../components/auth/AuthShell'

export function ForgotPassword() {
  const { t } = useTranslation('auth')
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await api.post('/auth/forgot-password', { email })
    } catch {
      // fall through — still show success screen with mailto fallback
    } finally {
      setSubmitted(true)
      setLoading(false)
    }
  }

  const supportMailto = `mailto:support@amliq.finance?subject=${encodeURIComponent('Password reset request')}&body=${encodeURIComponent(`Please send a password reset link to: ${email}`)}`

  return (
    <AuthShell>
      <Link to="/login"
        className="inline-flex items-center gap-1.5 text-sm mb-8 transition-opacity opacity-70 hover:opacity-100"
        style={{ color: 'rgba(250,250,248,0.7)' }}>
        <ArrowLeft size={16} />
        {t('forgot.back_to_login')}
      </Link>

      <h1 className="text-2xl font-semibold mb-2" style={{ color: '#FAFAF8', letterSpacing: '-0.02em' }}>
        {t('forgot.title')}
      </h1>
      <p className="text-sm mb-8" style={{ color: 'rgba(250,250,248,0.6)' }}>
        {t('forgot.description')}
      </p>

      {submitted ? (
        <div className="rounded-[14px] p-6 text-center space-y-3"
          style={{ background: 'rgba(61,170,106,0.08)', border: '1px solid rgba(61,170,106,0.25)' }}>
          <Mail size={32} className="mx-auto mb-1" style={{ color: '#3DAA6A' }} />
          <p className="font-medium" style={{ color: '#FAFAF8' }}>
            {t('forgot.success_title')}
          </p>
          <p className="text-sm" style={{ color: 'rgba(250,250,248,0.62)' }}>
            {t('forgot.success_message', { email })}
          </p>
          <p className="text-xs pt-2" style={{ color: 'rgba(250,250,248,0.45)', borderTop: '1px solid rgba(250,250,248,0.08)' }}>
            Didn’t get the email? Check your spam folder, or <a href={supportMailto} className="underline" style={{ color: '#C9A96E' }}>email support</a>.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="email" required value={email}
            onChange={e => setEmail(e.target.value)}
            aria-label={t('forgot.email_placeholder')}
            placeholder={t('forgot.email_placeholder')}
            autoComplete="email" autoFocus
            style={authInputStyle}
            onFocus={authInputFocus} onBlur={authInputBlur} />
          {error && <p role="alert" className="text-sm" style={{ color: '#FF8A85' }}>{error}</p>}
          <button type="submit" disabled={loading}
            className="inline-flex items-center justify-center gap-2 disabled:opacity-60"
            style={authPrimaryStyle}>
            {loading ? 'Sending…' : t('forgot.submit')} <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      )}
    </AuthShell>
  )
}

export default ForgotPassword
