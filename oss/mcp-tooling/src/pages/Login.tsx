import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Code2, Loader2, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export function Login() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { signIn, resendVerification } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [needsVerification, setNeedsVerification] = useState(false)
  const [verificationEmail, setVerificationEmail] = useState('')
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)

    try {
      const result = await signIn(formData.email, formData.password)

      if (result.success) {
        setSuccess(result.message)
        setTimeout(() => {
          // Check if there's a redirect URL
          const redirectTo = searchParams.get('redirectTo')
          navigate(redirectTo || '/dashboard')
        }, 1000)
      } else {
        setError(result.message)

        // Check if error indicates email needs verification
        if (result.message.includes('verify your email')) {
          setNeedsVerification(true)
          setVerificationEmail(formData.email)
        }
      }
    } finally {
      setLoading(false)
    }
  }

  const handleResendVerification = async () => {
    setLoading(true)
    try {
      const result = await resendVerification(verificationEmail)
      if (result.success) {
        setSuccess(result.message)
        setError(null)
      } else {
        setError(result.message)
      }
    } finally {
      setLoading(false)
    }
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
          <h1 className="mb-2 text-3xl font-bold text-gray-900">Welcome back</h1>
          <p className="text-gray-600">Sign in to your account</p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-medium text-gray-900">
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-gray-900"
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label htmlFor="password" className="block text-sm font-medium text-gray-900">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-sm text-gray-600 transition-colors hover:text-gray-900"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 pr-10 focus:border-transparent focus:ring-2 focus:ring-gray-900"
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transform text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {success && (
              <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                {success}
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {error}
                {needsVerification && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs">Need to verify your email?</p>
                    <button
                      onClick={handleResendVerification}
                      disabled={loading}
                      className="w-full rounded bg-red-100 px-3 py-2 text-xs font-medium text-red-800 transition-colors hover:bg-red-200 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {loading ? 'Resending...' : 'Resend verification email'}
                    </button>
                  </div>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-gray-900 px-6 py-3 font-medium text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-600">
            Don't have an account?{' '}
            <Link to="/register" className="font-medium text-gray-900 hover:text-gray-700">
              Sign up
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
