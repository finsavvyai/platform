import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/router';
import { Mail, Lock, User, Eye, EyeOff, AlertCircle, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import AuthLayout from '../../components/auth/AuthLayout';
import SocialButton from '../../components/auth/SocialButton';
import Divider from '../../components/auth/Divider';

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState('');
  const [error, setError] = useState('');

  const handleSocial = async (provider: 'google' | 'github' | 'apple') => {
    setIsLoading(provider);
    setError('');
    await signIn(provider, { callbackUrl: '/analyze' });
    setIsLoading('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name || !email || !password) {
      setError('Please fill in all fields.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setIsLoading('credentials');
    // In production: POST to /api/auth/register, then sign in
    const result = await signIn('credentials', {
      redirect: false,
      email,
      password,
      callbackUrl: '/analyze',
    });

    if (result?.error) {
      setError('Could not create account. Please try again.');
      setIsLoading('');
    } else if (result?.ok) {
      router.push('/analyze');
    }
  };

  const anyLoading = isLoading !== '';
  const strength = getPasswordStrength(password);

  return (
    <>
      <Head>
        <title>Sign Up | RankAI</title>
        <meta name="description" content="Create your RankAI account and start optimizing for AI agents." />
      </Head>

      <AuthLayout>
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Create your account</h1>
          <p className="text-sm text-slate-500">
            Start optimizing your content for AI agents.
          </p>
        </div>

        <div className="space-y-3">
          <SocialButton provider="google" onClick={() => handleSocial('google')} isLoading={isLoading === 'google'} disabled={anyLoading} />
          <SocialButton provider="github" onClick={() => handleSocial('github')} isLoading={isLoading === 'github'} disabled={anyLoading} />
          <SocialButton provider="apple" onClick={() => handleSocial('apple')} isLoading={isLoading === 'apple'} disabled={anyLoading} />
        </div>

        <Divider text="or sign up with email" />

        {error && <ErrorBanner message={error} />}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <Field id="name" label="Full name" icon={<User className="h-4 w-4" />} value={name} onChange={setName} placeholder="Jane Smith" disabled={anyLoading} />
          <Field id="email" label="Work email" icon={<Mail className="h-4 w-4" />} value={email} onChange={setEmail} type="email" placeholder="you@company.com" disabled={anyLoading} />

          <div>
            <label htmlFor="password" className="block text-xs font-medium text-slate-600 mb-1.5">Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                disabled={anyLoading}
                className="w-full pl-10 pr-11 py-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary/30 focus:border-primary/50 focus:outline-none transition-all disabled:opacity-50"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {password && <PasswordStrength strength={strength} />}
          </div>

          <motion.button type="submit" disabled={anyLoading} whileHover={anyLoading ? {} : { y: -1 }} whileTap={anyLoading ? {} : { scale: 0.98 }} className="w-full button-primary py-3 text-sm disabled:opacity-50">
            {isLoading === 'credentials' ? 'Creating account...' : 'Create account'}
          </motion.button>
        </form>

        <p className="text-center text-xs text-slate-400 mt-6">
          By signing up, you agree to our Terms of Service and Privacy Policy.
        </p>
        <p className="text-center text-sm text-slate-500 mt-4">
          Already have an account?{' '}
          <Link href="/auth/signin" className="font-medium text-primary hover:text-primary-600 transition-colors">Sign in</Link>
        </p>
      </AuthLayout>
    </>
  );
}

interface FieldProps {
  id: string; label: string; icon: React.ReactNode;
  value: string; onChange: (v: string) => void;
  placeholder: string; type?: string; disabled: boolean;
}

function Field({ id, label, icon, value, onChange, placeholder, type = 'text', disabled }: FieldProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-slate-600 mb-1.5">{label}</label>
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">{icon}</span>
        <input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} disabled={disabled} className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary/30 focus:border-primary/50 focus:outline-none transition-all disabled:opacity-50" />
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

function getPasswordStrength(pw: string): number {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}

function PasswordStrength({ strength }: { strength: number }) {
  const colors = ['bg-red-400', 'bg-amber-400', 'bg-yellow-400', 'bg-emerald-400'];
  const labels = ['Weak', 'Fair', 'Good', 'Strong'];
  return (
    <div className="mt-2 flex items-center gap-2">
      <div className="flex gap-1 flex-1">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`h-1 rounded-full flex-1 transition-colors ${i < strength ? colors[strength - 1] : 'bg-slate-200'}`} />
        ))}
      </div>
      <span className="text-[10px] font-medium text-slate-500">{labels[strength - 1] || ''}</span>
    </div>
  );
}
