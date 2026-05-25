import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Loader2, Mail } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL ||
  (window.location.hostname === 'localhost' ? 'http://localhost:3020' : window.location.origin);

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || payload.message || 'Unable to submit password reset request');
      }

      setSubmitted(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to submit password reset request');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 px-4 py-12 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-md items-center">
        <div className="w-full rounded-3xl border border-white/10 bg-black/30 p-8 shadow-2xl backdrop-blur-xl">
          <Link
            to="/login"
            className="mb-6 inline-flex items-center gap-2 text-sm text-slate-300 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to login
          </Link>

          <h1 className="text-3xl font-semibold tracking-tight">Reset your password</h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Enter the email address tied to your account and we&apos;ll send reset instructions.
          </p>

          {submitted ? (
            <div className="mt-8 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5">
              <div className="flex items-start gap-3">
                <CheckCircle className="mt-0.5 h-5 w-5 text-emerald-400" />
                <div>
                  <h2 className="font-medium text-emerald-300">Check your email</h2>
                  <p className="mt-1 text-sm text-emerald-100/80">
                    If an account exists for {email}, password reset instructions are on the way.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="reset-email" className="mb-2 block text-sm font-medium text-slate-200">
                  Email address
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    id="reset-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-white/5 py-3 pl-11 pr-4 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400/60 focus:outline-none focus:ring-2 focus:ring-cyan-400/20"
                    placeholder="you@company.com"
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {isSubmitting ? 'Sending reset link...' : 'Send reset link'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
