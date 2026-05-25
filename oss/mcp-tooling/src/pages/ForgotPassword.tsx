import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Code2, Loader2, Mail, ArrowLeft } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export function ForgotPassword() {
  const { resetPassword } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [email, setEmail] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    if (!email || !email.includes('@') || !email.includes('.')) {
      setError('Please enter a valid email address')
      return
    }

    setLoading(true)

    try {
      const result = await resetPassword(email)

      if (result.success) {
        setSuccess(true)
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
          <h1 className="mb-2 text-3xl font-bold text-gray-900">Reset your password</h1>
          <p className="text-gray-600">
            Enter your email address and we'll send you a link to reset your password
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
          {success ? (
            <div className="py-4 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <Mail className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-gray-900">Check your email</h3>
              <p className="mb-4 text-gray-600">
                We've sent password reset instructions to{' '}
                <span className="font-medium">{email}</span>
              </p>
              <div className="space-y-3">
                <p className="text-sm text-gray-500">
                  Didn't receive the email? Check your spam folder or try again.
                </p>
                <button
                  onClick={() => setSuccess(false)}
                  className="w-full rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-200"
                >
                  Try again
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="email" className="mb-2 block text-sm font-medium text-gray-900">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-gray-900"
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                />
              </div>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {error}
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
                    Sending reset link...
                  </>
                ) : (
                  'Send reset link'
                )}
              </button>
            </form>
          )}

          <div className="mt-6 text-center">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-sm text-gray-600 transition-colors hover:text-gray-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
