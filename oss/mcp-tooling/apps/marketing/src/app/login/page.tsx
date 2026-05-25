'use client'

import { useEffect } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { Cpu, LogIn, Shield, Zap, ArrowRight } from 'lucide-react'

// Cloudflare Access login URL - configured in your Access application
const CF_ACCESS_LOGIN_URL = process.env.NEXT_PUBLIC_CF_ACCESS_LOGIN_URL || 'https://mcpoverflow.cloudflareaccess.com/cdn-cgi/access/login'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.mcpoverflow.io'

export default function LoginPage() {
    // Redirect to Cloudflare Access if already authenticated
    useEffect(() => {
        // Check if user has Access cookie
        const checkAuth = async () => {
            try {
                const res = await fetch(`${APP_URL}/api/users/me`, {
                    credentials: 'include',
                })
                if (res.ok) {
                    window.location.href = APP_URL
                }
            } catch {
                // Not authenticated, stay on page
            }
        }
        checkAuth()
    }, [])

    const handleLogin = () => {
        // Redirect to Cloudflare Access with return URL
        const returnUrl = encodeURIComponent(APP_URL)
        window.location.href = `${CF_ACCESS_LOGIN_URL}?redirect_uri=${returnUrl}`
    }

    return (
        <main className="min-h-screen bg-black flex items-center justify-center p-6">
            {/* Background effects */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="relative z-10 w-full max-w-md"
            >
                {/* Logo */}
                <Link href="/" className="flex items-center justify-center gap-2 mb-8">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                        <Cpu className="w-6 h-6 text-white" />
                    </div>
                    <span className="text-2xl font-bold text-white">MCPOverflow</span>
                </Link>

                {/* Card */}
                <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-8">
                    <h1 className="text-2xl font-bold text-white text-center mb-2">
                        Welcome back
                    </h1>
                    <p className="text-gray-400 text-center mb-8">
                        Sign in with your GitHub or Google account
                    </p>

                    {/* Security badge */}
                    <div className="flex items-center justify-center gap-2 mb-6 text-sm text-gray-400">
                        <Shield className="w-4 h-4 text-green-400" />
                        <span>Secured by Cloudflare Access</span>
                    </div>

                    {/* Main login button */}
                    <button
                        onClick={handleLogin}
                        className="w-full py-4 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl text-white font-semibold hover:shadow-lg hover:shadow-blue-500/25 transition-all flex items-center justify-center gap-3 group"
                    >
                        <LogIn className="w-5 h-5" />
                        Continue to Sign In
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </button>

                    {/* Providers info */}
                    <div className="mt-6 flex items-center justify-center gap-6 text-gray-500">
                        <div className="flex items-center gap-2">
                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                            </svg>
                            <span className="text-sm">GitHub</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                            <span className="text-sm">Google</span>
                        </div>
                    </div>

                    {/* Benefits */}
                    <div className="mt-8 pt-6 border-t border-white/10 space-y-3">
                        <div className="flex items-center gap-3 text-sm text-gray-400">
                            <Zap className="w-4 h-4 text-yellow-400" />
                            <span>No passwords to remember</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-gray-400">
                            <Shield className="w-4 h-4 text-green-400" />
                            <span>Enterprise-grade security</span>
                        </div>
                    </div>
                </div>

                {/* Signup link */}
                <p className="text-center text-gray-400 mt-6">
                    Don&apos;t have an account?{' '}
                    <Link href="/signup" className="text-blue-400 hover:text-blue-300 font-medium">
                        Sign up
                    </Link>
                </p>
            </motion.div>
        </main>
    )
}
