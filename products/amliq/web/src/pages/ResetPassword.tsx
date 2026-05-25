import React, { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CheckCircle } from 'lucide-react'
import { api } from '../api/client'
import { AuthShell, authInputStyle, authInputFocus, authInputBlur, authPrimaryStyle } from '../components/auth/AuthShell'

export function ResetPassword() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  useEffect(() => {
    if (token) window.history.replaceState({}, '', '/reset-password')
  }, [token])
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }
    setLoading(true); setError('')
    try {
      await api.post('/auth/reset-password', { token, password })
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed')
    } finally { setLoading(false) }
  }

  if (!token) {
    return (
      <AuthShell>
        <div className="text-center">
          <p className="text-sm font-medium mb-3" style={{ color: '#FF8A85' }}>Invalid reset link</p>
          <Link to="/forgot-password" className="text-sm font-medium" style={{ color: '#C9A96E' }}>
            Request a new reset link
          </Link>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <Link to="/login"
        className="inline-flex items-center gap-1.5 text-sm mb-8 transition-opacity opacity-70 hover:opacity-100"
        style={{ color: 'rgba(250,250,248,0.7)' }}>
        <ArrowLeft size={16} /> Back to login
      </Link>

      {done ? (
        <div className="rounded-[14px] p-6 text-center space-y-3"
          style={{ background: 'rgba(61,170,106,0.08)', border: '1px solid rgba(61,170,106,0.25)' }}>
          <CheckCircle size={32} className="mx-auto mb-1" style={{ color: '#3DAA6A' }} />
          <p className="font-medium" style={{ color: '#FAFAF8' }}>Password updated</p>
          <Link to="/login" className="text-sm font-medium" style={{ color: '#C9A96E' }}>
            Sign in with your new password
          </Link>
        </div>
      ) : (
        <>
          <h1 className="text-2xl font-semibold mb-2" style={{ color: '#FAFAF8', letterSpacing: '-0.02em' }}>
            Set new password
          </h1>
          <p className="text-sm mb-8" style={{ color: 'rgba(250,250,248,0.6)' }}>
            Enter your new password below.
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input type="password" required value={password} minLength={8}
              onChange={e => setPassword(e.target.value)}
              placeholder="New password (8+ characters)" autoFocus
              style={authInputStyle} onFocus={authInputFocus} onBlur={authInputBlur} />
            <input type="password" required value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Confirm password"
              style={authInputStyle} onFocus={authInputFocus} onBlur={authInputBlur} />
            {error && <p role="alert" className="text-sm" style={{ color: '#FF8A85' }}>{error}</p>}
            <button type="submit" disabled={loading}
              className="inline-flex items-center justify-center gap-2 disabled:opacity-60"
              style={authPrimaryStyle}>
              {loading ? 'Updating…' : 'Update Password'} <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </>
      )}
    </AuthShell>
  )
}

export default ResetPassword
