'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { Cpu, Send, CheckCircle2, Building, Mail, MessageSquare } from 'lucide-react'

export default function ContactPage() {
    const [submitted, setSubmitted] = useState(false)
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1500))
        setLoading(false)
        setSubmitted(true)
    }

    if (submitted) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center p-6">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="max-w-md w-full bg-white/5 border border-white/10 rounded-3xl p-8 text-center"
                >
                    <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle2 className="w-8 h-8 text-green-500" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-4">Request Received</h2>
                    <p className="text-gray-400 mb-8">
                        Thanks for your interest in MCPOverflow Enterprise! Our team will be in touch within 24 hours to schedule your dedicated environment demo.
                    </p>
                    <Link
                        href="/"
                        className="inline-flex px-6 py-3 bg-white/10 hover:bg-white/20 rounded-full text-white font-medium transition-colors"
                    >
                        Back to Home
                    </Link>
                </motion.div>
            </div>
        )
    }

    return (
        <main className="min-h-screen bg-black text-white">
            <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-black/20 border-b border-white/5">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                            <Cpu className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-xl font-bold text-white">MCPOverflow</span>
                    </Link>
                </div>
            </nav>

            <div className="pt-32 pb-20 px-6">
                <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-16 items-center">
                    <motion.div
                        initial={{ opacity: 0, x: -30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.6 }}
                    >
                        <h1 className="text-4xl md:text-5xl font-bold mb-6">
                            Enterprise Deployment & <br />
                            <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                                Dedicated Support
                            </span>
                        </h1>
                        <p className="text-xl text-gray-400 mb-10">
                            Get a dedicated private environment, custom SSO integration, and priority support for your mission-critical AI infrastructure.
                        </p>

                        <div className="space-y-6">
                            {[
                                'Private Cloudflare Workers instance',
                                'Custom SSO (SAML/OIDC) integration',
                                'SLA with 99.99% uptime guarantee',
                                'Dedicated support channel',
                                'Custom API rate limits',
                                'On-premise deployment options'
                            ].map((item, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <CheckCircle2 className="w-5 h-5 text-blue-500" />
                                    <span className="text-gray-300">{item}</span>
                                </div>
                            ))}
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, x: 30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-sm"
                    >
                        <h3 className="text-2xl font-semibold mb-6">Contact Sales</h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">First Name</label>
                                    <div className="relative">
                                        <input type="text" required className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors" placeholder="Jane" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">Last Name</label>
                                    <div className="relative">
                                        <input type="text" required className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors" placeholder="Doe" />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Work Email</label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                                    <input type="email" required className="w-full bg-black/50 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors" placeholder="jane@company.com" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Company Name</label>
                                <div className="relative">
                                    <Building className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                                    <input type="text" required className="w-full bg-black/50 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors" placeholder="Acme Inc." />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">What are you looking for?</label>
                                <div className="relative">
                                    <MessageSquare className="absolute left-4 top-3 w-5 h-5 text-gray-500" />
                                    <textarea required rows={4} className="w-full bg-black/50 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors" placeholder="Tell us about your infrastructure needs..." />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-4 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl text-white font-semibold hover:shadow-lg hover:shadow-blue-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {loading ? 'Sending...' : (
                                    <>
                                        Request Demo
                                        <Send className="w-4 h-4" />
                                    </>
                                )}
                            </button>
                        </form>
                    </motion.div>
                </div>
            </div>
        </main>
    )
}
