import React, { useState } from 'react';
import { Database, ShieldCheck, Sparkles } from 'lucide-react';
import { authAPI } from '../services/api';

interface LoginPageProps {
  onLogin: () => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [email, setEmail] = useState('admin@queryflux.dev');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authAPI.login(email, password);
      onLogin();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid credentials';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="premium-shell flex min-h-screen items-center justify-center overflow-hidden p-4">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-border/80 bg-card/65 shadow-2xl backdrop-blur-2xl md:grid-cols-[1.1fr_0.9fr]">
        <div className="relative hidden min-h-[34rem] overflow-hidden border-r border-border/70 p-8 md:block">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,hsl(var(--primary)/0.24),transparent_24rem),radial-gradient(circle_at_82%_78%,hsl(var(--accent)/0.22),transparent_22rem)]" />
          <div className="relative flex h-full flex-col justify-between">
            <div>
              <div className="premium-orb mb-8 flex h-14 w-14 items-center justify-center rounded-3xl">
                <Database className="h-7 w-7 text-background" />
              </div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-warning/30 bg-warning/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.24em] text-warning">
                <Sparkles className="h-3.5 w-3.5" />
                Premium query cockpit
              </div>
              <h2 className="max-w-md text-5xl font-black leading-tight tracking-tight text-gradient-data">
                Ship safer SQL with live context.
              </h2>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {['Schema intel', 'Safe run', 'Audit trail'].map((item) => (
                <div key={item} className="premium-pill rounded-2xl p-3 text-xs font-semibold text-muted-foreground">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6 p-8 md:p-10">
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="premium-orb flex h-14 w-14 items-center justify-center rounded-2xl md:hidden">
              <Database className="h-7 w-7 text-background" />
            </div>
            <div className="hidden h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 md:flex">
              <ShieldCheck className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-3xl font-black tracking-tight">QueryFlux</h1>
            <p className="text-sm text-muted-foreground">Sign in to your account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-bold" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="premium-input w-full rounded-2xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-bold" htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="premium-input w-full rounded-2xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground"
              />
            </div>

            {error && (
              <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="premium-button w-full cursor-pointer rounded-2xl px-4 py-3 text-sm font-black transition-all disabled:opacity-50"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="rounded-2xl border border-border/70 bg-background/35 px-4 py-3 text-center text-xs text-muted-foreground">
            Dev credentials: admin@queryflux.dev / Admin123!
          </p>
        </div>
      </div>
    </div>
  );
}
