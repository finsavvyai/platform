import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Code2, Loader2, Eye, EyeOff, Check, X } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

// Password strength checker (reuse from Register)
const checkPasswordStrength = (password: string) => {
  const checks = {
    length: password.length >= 8,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    numbers: /\d/.test(password),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
  }

  const score = Object.values(checks).filter(Boolean).length
  const strength = score <= 2 ? 'weak' : score <= 4 ? 'medium' : 'strong'

  return { checks, strength, score }
}

export function ResetPassword() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { updatePassword } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [validToken, setValidToken] = useState(true)
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  })

  const passwordStrength = checkPasswordStrength(formData.password)
  const accessToken = searchParams.get('access_token')
  const refreshToken = searchParams.get('refresh_token')

  useEffect(() => {
    // Check if we have the required tokens
    if (!accessToken || !refreshToken) {
      setValidToken(false)
      setError('Invalid or expired password reset link. Please request a new one.')
    }
  }, [accessToken, refreshToken])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    if (!validToken) return

    // Enhanced password validation
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (passwordStrength.score < 3) {
      setError('Password must meet at least 3 of the 5 security requirements')
      return
    }

    setLoading(true)

    try {
      const result = await updatePassword(formData.password)

      if (result.success) {
        setSuccess(true)
        setTimeout(() => {
          navigate('/login')
        }, 3000)
      } else {
        setError(result.message)
      }
    } finally {
      setLoading(false)
    }
  }

  if (!validToken) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <Link
              to="/"
              className="mb-2 inline-flex items-center gap-2 text-2xl font-bold text-gray-900"
            >
              <Code2 className="h-8 w-8" />
              <span>MCPoverflow</span>
            </Link>
            <h1 className="mb-2 text-3xl font-bold text-gray-900">Invalid reset link</h1>
            <p className="text-gray-600">This password reset link is invalid or has expired.</p>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
            <div className="mb-6">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                <X className="h-8 w-8 text-red-600" />
              </div>
              <p className="mb-4 text-gray-600">{error}</p>
            </div>

            <div className="space-y-3">
              <Link
                to="/forgot-password"
                className="block w-full rounded-lg bg-gray-900 px-6 py-3 text-center font-medium text-white transition-colors hover:bg-gray-800"
              >
                Request new reset link
              </Link>
              <Link
                to="/login"
                className="block w-full rounded-lg bg-gray-100 px-6 py-3 text-center font-medium text-gray-900 transition-colors hover:bg-gray-200"
              >
                Back to sign in
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link
            to="/"
            className="mb-2 inline-flex items-center gap-2 text-2xl font-bold text-gray-900"
          >
            <Code2 className="h-8 w-8" />
            <span>MCPoverflow</span>
          </Link>
          <h1 className="mb-2 text-3xl font-bold text-gray-900">Set new password</h1>
          <p className="text-gray-600">Choose a strong password for your account</p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
          {success ? (
            <div className="py-4 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-gray-900">Password updated!</h3>
              <p className="text-gray-600">
                Your password has been successfully updated. Redirecting to sign in...
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="password" className="mb-2 block text-sm font-medium text-gray-900">
                  New password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 pr-10 focus:border-transparent focus:ring-2 focus:ring-gray-900"
                    placeholder="••••••••"
                    required
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 transform text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>

                {formData.password && (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <div
                        className={`h-2 flex-1 rounded-full ${passwordStrength.strength === 'weak' ? 'bg-red-500' : passwordStrength.strength === 'medium' ? 'bg-yellow-500' : 'bg-green-500'}`}
                      ></div>
                      <span
                        className={`text-xs font-medium ${passwordStrength.strength === 'weak' ? 'text-red-600' : passwordStrength.strength === 'medium' ? 'text-yellow-600' : 'text-green-600'}`}
                      >
                        {passwordStrength.strength.toUpperCase()}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {Object.entries({
                        'At least 8 characters': passwordStrength.checks.length,
                        'One lowercase letter': passwordStrength.checks.lowercase,
                        'One uppercase letter': passwordStrength.checks.uppercase,
                        'One number': passwordStrength.checks.numbers,
                        'One special character': passwordStrength.checks.special,
                      }).map(([requirement, met]) => (
                        <div key={requirement} className="flex items-center gap-2 text-xs">
                          {met ? (
                            <Check className="h-3 w-3 text-green-600" />
                          ) : (
                            <X className="h-3 w-3 text-gray-300" />
                          )}
                          <span className={met ? 'text-green-600' : 'text-gray-500'}>
                            {requirement}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="mb-2 block text-sm font-medium text-gray-900"
                >
                  Confirm new password
                </label>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 pr-10 focus:border-transparent focus:ring-2 focus:ring-gray-900"
                    placeholder="••••••••"
                    required
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 transform text-gray-400 hover:text-gray-600"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
                {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                  <p className="mt-1 text-xs text-red-600">Passwords do not match</p>
                )}
              </div>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || passwordStrength.score < 3}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-gray-900 px-6 py-3 font-medium text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Updating password...
                  </>
                ) : (
                  'Update password'
                )}
              </button>
            </form>
          )}

          <div className="mt-6 text-center">
            <Link
              to="/login"
              className="text-sm text-gray-600 transition-colors hover:text-gray-900"
            >
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
