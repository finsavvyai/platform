import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, AlertCircle, Loader2, Sparkles, Shield, Zap } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { motion } from 'framer-motion';

const OAUTH_PROVIDERS = [
    {
        id: 'google',
        name: 'Google',
        icon: (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
        ),
    },
    {
        id: 'github',
        name: 'GitHub',
        icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" /></svg>,
    },
    {
        id: 'azure-ad',
        name: 'Microsoft',
        icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="#00A4EF"><path d="M0 0h11.377v11.372H0zm12.623 0H24v11.372H12.623zM0 12.623h11.377V24H0zm12.623 0H24V24H12.623z" /></svg>,
    },
    {
        id: 'linkedin',
        name: 'LinkedIn',
        icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="#0A66C2"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg>,
    },
    {
        id: 'discord',
        name: 'Discord',
        icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="#5865F2"><path d="M20.317 4.37a19.79 19.79 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.865-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.618-1.25.077.077 0 00-.079-.037A19.74 19.74 0 003.677 4.37a.07.07 0 00-.032.028C.533 9.046-.32 13.58.099 18.058a.082.082 0 00.031.056 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.873-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.11 13.11 0 01-1.872-.892.077.077 0 01-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 01.078-.01c3.928 1.793 8.18 1.793 12.061 0a.074.074 0 01.079.009c.12.1.245.198.372.292a.077.077 0 01-.006.128 12.3 12.3 0 01-1.873.891.076.076 0 00-.041.107c.36.698.772 1.363 1.225 1.993a.076.076 0 00.084.029 19.84 19.84 0 006.002-3.03.077.077 0 00.031-.055c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.029z" /></svg>,
    },
];

export default function LoginPage() {
    const navigate = useNavigate();
    const { login, loginWithOAuth, isLoading, error, isAuthenticated } = useAuthStore();
    const [showPassword, setShowPassword] = useState(false);
    const isLocalDemoAvailable = import.meta.env.DEV;
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        rememberMe: false,
    });

    useEffect(() => {
        if (isAuthenticated) {
            navigate('/');
        }
    }, [isAuthenticated, navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await login({ email: formData.email, password: formData.password });
    };

    const handleDemoLogin = async () => {
        await login({ email: 'demo@qestro.dev', password: 'qestro-demo' });
    };

    return (
        <div className="min-h-screen flex" style={{
            background: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
        }}>
            {/* Left side - Branding */}
            <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden">
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute -top-40 -left-40 w-80 h-80 rounded-full opacity-20"
                        style={{ background: 'radial-gradient(circle, #7c3aed, transparent)', filter: 'blur(60px)' }} />
                    <div className="absolute top-1/2 left-1/2 w-96 h-96 rounded-full opacity-15"
                        style={{ background: 'radial-gradient(circle, #3b82f6, transparent)', filter: 'blur(80px)' }} />
                    <div className="absolute -bottom-20 -right-20 w-72 h-72 rounded-full opacity-20"
                        style={{ background: 'radial-gradient(circle, #ec4899, transparent)', filter: 'blur(60px)' }} />
                </div>

                <div className="relative z-10">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.6 }}
                        className="flex items-center gap-3"
                    >
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                            style={{ background: 'linear-gradient(135deg, #7c3aed, #3b82f6)' }}>
                            <Sparkles className="w-6 h-6 text-white" />
                        </div>
                        <span className="text-2xl font-bold text-white tracking-tight">Qestro</span>
                    </motion.div>
                </div>

                <div className="relative z-10 space-y-8">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                    >
                        <h1 className="text-5xl font-bold text-white leading-tight">
                            The AI-Powered<br />
                            <span style={{ background: 'linear-gradient(90deg, #7c3aed, #3b82f6, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                                QA Platform
                            </span>
                        </h1>
                        <p className="mt-4 text-lg text-gray-300 max-w-md">
                            Autonomous test generation, self-healing tests, and AI code reviews — all in one platform.
                        </p>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.4 }}
                        className="space-y-4"
                    >
                        {[
                            { icon: Sparkles, text: 'AI test generation from user stories', color: '#7c3aed' },
                            { icon: Shield, text: 'Self-healing test infrastructure', color: '#3b82f6' },
                            { icon: Zap, text: 'Cross-browser, mobile, and API coverage', color: '#06b6d4' },
                        ].map((feature, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${feature.color}22` }}>
                                    <feature.icon className="w-4 h-4" style={{ color: feature.color }} />
                                </div>
                                <span className="text-gray-300 text-sm">{feature.text}</span>
                            </div>
                        ))}
                    </motion.div>
                </div>

                <div className="relative z-10">
                    <p className="text-gray-500 text-sm">&copy; 2026 Qestro. Built for enterprise QA teams.</p>
                </div>
            </div>

            {/* Right side - Login form */}
            <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="w-full max-w-md"
                >
                    {/* Mobile logo */}
                    <div className="lg:hidden flex items-center justify-center gap-3 mb-10">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                            style={{ background: 'linear-gradient(135deg, #7c3aed, #3b82f6)' }}>
                            <Sparkles className="w-6 h-6 text-white" />
                        </div>
                        <span className="text-2xl font-bold text-white tracking-tight">Qestro</span>
                    </div>

                    <div className="rounded-2xl p-8 sm:p-10" style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        backdropFilter: 'blur(20px)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                    }}>
                        <div className="mb-8">
                            <h2 className="text-2xl font-bold text-white">Welcome back</h2>
                            <p className="mt-2 text-sm text-gray-400">
                                Or{' '}
                                <Link to="/register" className="font-medium hover:underline" style={{ color: '#818cf8' }}>
                                    start your free trial
                                </Link>
                            </p>
                        </div>

                        {/* Social login buttons — unified grid, consistent visual weight */}
                        <div className="grid grid-cols-3 gap-2 mb-6">
                            {OAUTH_PROVIDERS.map((provider) => (
                                <button
                                    key={provider.id}
                                    type="button"
                                    className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-sm font-medium text-gray-300 transition-all duration-200 hover:bg-white/10"
                                    style={{ border: '1px solid rgba(255,255,255,0.1)' }}
                                    onClick={() => void loginWithOAuth(provider.id)}
                                    disabled={isLoading}
                                    title={`Sign in with ${provider.name}`}
                                >
                                    {provider.icon}
                                    <span className="hidden sm:inline">{provider.name}</span>
                                </button>
                            ))}
                        </div>

                        {/* Divider */}
                        <div className="relative my-6">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }} />
                            </div>
                            <div className="relative flex justify-center text-xs">
                                <span className="px-3 text-gray-500" style={{ backgroundColor: 'transparent' }}>or sign in with email</span>
                            </div>
                        </div>

                        <form className="space-y-5" onSubmit={handleSubmit}>
                            <div className="space-y-4">
                                <div>
                                    <label htmlFor="email-address" className="block text-sm font-medium text-gray-300 mb-1.5">
                                        Email address
                                    </label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                            <Mail className="h-4 w-4 text-gray-500" />
                                        </div>
                                        <input
                                            id="email-address"
                                            name="email"
                                            type="email"
                                            autoComplete="email"
                                            required
                                            className="block w-full pl-10 pr-4 py-2.5 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-all duration-200"
                                            style={{
                                                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                            }}
                                            onFocus={(e) => { e.target.style.borderColor = '#7c3aed'; e.target.style.boxShadow = '0 0 0 2px rgba(124, 58, 237, 0.3)'; }}
                                            onBlur={(e) => { e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'; e.target.style.boxShadow = 'none'; }}
                                            placeholder="you@company.com"
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1.5">
                                        Password
                                    </label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                            <Lock className="h-4 w-4 text-gray-500" />
                                        </div>
                                        <input
                                            id="password"
                                            name="password"
                                            type={showPassword ? 'text' : 'password'}
                                            autoComplete="current-password"
                                            required
                                            className="block w-full pl-10 pr-10 py-2.5 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none transition-all duration-200"
                                            style={{
                                                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                            }}
                                            onFocus={(e) => { e.target.style.borderColor = '#7c3aed'; e.target.style.boxShadow = '0 0 0 2px rgba(124, 58, 237, 0.3)'; }}
                                            onBlur={(e) => { e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'; e.target.style.boxShadow = 'none'; }}
                                            placeholder="..."
                                            value={formData.password}
                                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        />
                                        <button
                                            type="button"
                                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                                            className="absolute inset-y-0 right-0 pr-3.5 flex items-center"
                                            onClick={() => setShowPassword(!showPassword)}
                                        >
                                            {showPassword
                                                ? <EyeOff className="h-4 w-4 text-gray-500 hover:text-gray-300 transition-colors" />
                                                : <Eye className="h-4 w-4 text-gray-500 hover:text-gray-300 transition-colors" />
                                            }
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    className="rounded-xl p-3"
                                    style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)' }}
                                >
                                    <div className="flex items-center gap-2">
                                        <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
                                        <span className="text-sm text-red-300">{error}</span>
                                    </div>
                                </motion.div>
                            )}

                            <div className="flex items-center justify-between">
                                <div className="flex items-center">
                                    <input
                                        id="remember-me"
                                        name="remember-me"
                                        type="checkbox"
                                        className="h-4 w-4 rounded border-gray-600 bg-transparent"
                                        style={{ accentColor: '#7c3aed' }}
                                        checked={formData.rememberMe}
                                        onChange={(e) => setFormData({ ...formData, rememberMe: e.target.checked })}
                                    />
                                    <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-400">
                                        Remember me
                                    </label>
                                </div>
                                <Link to="/forgot-password" className="text-sm font-medium hover:underline" style={{ color: '#818cf8' }}>
                                    Forgot password?
                                </Link>
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full flex items-center justify-center py-2.5 px-4 rounded-xl text-sm font-semibold text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-purple-500/25 active:scale-[0.98]"
                                style={{ background: 'linear-gradient(135deg, #7c3aed, #3b82f6)' }}
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="animate-spin h-4 w-4 mr-2" />
                                        Signing in...
                                    </>
                                ) : (
                                    'Sign in'
                                )}
                            </button>

                            {isLocalDemoAvailable && (
                                <button
                                    type="button"
                                    disabled={isLoading}
                                    onClick={() => void handleDemoLogin()}
                                    className="w-full flex items-center justify-center py-2.5 px-4 rounded-xl text-sm font-semibold text-gray-200 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/10 active:scale-[0.98]"
                                    style={{ border: '1px solid rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.06)' }}
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="animate-spin h-4 w-4 mr-2" />
                                            Opening demo...
                                        </>
                                    ) : (
                                        'Open demo workspace'
                                    )}
                                </button>
                            )}
                        </form>

                        <p className="mt-6 text-center text-xs text-gray-500">
                            Demo credentials are available for production smoke testing.
                        </p>
                        <p className="mt-2 text-center text-xs text-gray-500">
                            Early access — sign up free to get started.
                        </p>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
