import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/router';
import { Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import AuthLayout from '../../components/auth/AuthLayout';
import SocialButton from '../../components/auth/SocialButton';
import Divider from '../../components/auth/Divider';

export default function SignInPage() {
  const router = useRouter();
  const callbackUrl = (router.query.callbackUrl as string) || '/analyze';
  const errorParam = router.query.error as string | undefined;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState('');
  const [error, setError] = useState(errorParam || '');

  const handleSocial = async (provider: 'google' | 'github' | 'apple') => {
    setIsLoading(provider);
    setError('');
    await signIn(provider, { callbackUrl });
    setIsLoading('');
  };

  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setIsLoading('credentials');
    const result = await signIn('credentials', {
      redirect: false,
      email,
      password,
      callbackUrl,
    });

    if (result?.error) {
      setError('Invalid email or password.');
      setIsLoading('');
    } else if (result?.ok) {
      router.push(callbackUrl);
    }
  };

  const anyLoading = isLoading !== '';

  return (
    <>
      <Head>
        <title>Sign In | RankAI</title>
        <meta name="description" content="Sign in to your RankAI account." />
      </Head>

      <AuthLayout>
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Welcome back</h1>
          <p className="text-sm text-slate-500">
            Sign in to continue to your dashboard.
          </p>
        </div>

        <div className="space-y-3">
          <SocialButton provider="google" onClick={() => handleSocial('google')} isLoading={isLoading === 'google'} disabled={anyLoading} />
          <SocialButton provider="github" onClick={() => handleSocial('github')} isLoading={isLoading === 'github'} disabled={anyLoading} />
          <SocialButton provider="apple" onClick={() => handleSocial('apple')} isLoading={isLoading === 'apple'} disabled={anyLoading} />
        </div>

        <Divider text="or sign in with email" />

        {error && <ErrorBanner message={error} />}

        <form onSubmit={handleCredentials} className="space-y-4" noValidate>
          <FieldGroup label="Email" htmlFor="email">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              disabled={anyLoading}
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary/30 focus:border-primary/50 focus:outline-none transition-all disabled:opacity-50"
            />
          </FieldGroup>

          <FieldGroup label="Password" htmlFor="password">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              disabled={anyLoading}
              className="w-full pl-10 pr-11 py-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary/30 focus:border-primary/50 focus:outline-none transition-all disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </FieldGroup>

          <div className="flex justify-end">
            <a href="#" className="text-xs font-medium text-primary hover:text-primary-600 transition-colors">
              Forgot password?
            </a>
          </div>

          <motion.button
            type="submit"
            disabled={anyLoading}
            whileHover={anyLoading ? {} : { y: -1 }}
            whileTap={anyLoading ? {} : { scale: 0.98 }}
            className="w-full button-primary py-3 text-sm disabled:opacity-50"
          >
            {isLoading === 'credentials' ? 'Signing in...' : 'Sign in'}
          </motion.button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-8">
          Don&apos;t have an account?{' '}
          <Link href="/auth/signup" className="font-medium text-primary hover:text-primary-600 transition-colors">
            Sign up
          </Link>
        </p>
      </AuthLayout>
    </>
  );
}

function FieldGroup({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-xs font-medium text-slate-600 mb-1.5">
        {label}
      </label>
      <div className="relative">
        {children}
      </div>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-100 mb-4">
      <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
      <span className="text-sm text-red-700">{message}</span>
    </div>
  );
}
