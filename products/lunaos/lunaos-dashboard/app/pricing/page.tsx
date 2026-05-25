'use client';

import Link from 'next/link';

const plans = [
    {
        name: 'Free',
        price: '$0',
        period: 'forever',
        description: 'For individual developers',
        features: [
            'Unlimited commands',
            '28 AI agents',
            'CLI + Dashboard + Studio',
            'Bring your own API keys',
            'Community support',
        ],
        cta: 'Get Started',
        href: '/auth/signup',
        popular: false,
    },
    {
        name: 'Pro',
        price: '$29',
        period: '/month',
        description: 'For power users',
        features: [
            'Unlimited commands',
            'Managed AI keys (no BYOK needed)',
            '33 MCP servers pre-configured',
            'RAG code search + memory',
            'Visual QA + browser testing',
            'Priority support',
        ],
        cta: 'Start Pro Trial',
        href: '/dashboard/billing',
        popular: true,
    },
    {
        name: 'Team',
        price: '$79',
        period: '/month',
        description: 'For engineering teams',
        features: [
            'Everything in Pro',
            'Team workspace + collaboration',
            'SSO / SAML',
            'Shared memory + team learnings',
            'Audit logs + compliance',
            'Dedicated support + SLA',
        ],
        cta: 'Contact Sales',
        href: '/dashboard/billing',
        popular: false,
    },
];

export default function PricingPage() {
    return (
        <div className="min-h-screen py-24 px-4">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="text-center mb-16">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-sm font-medium mb-6">
                        <span>💰</span>
                        <span>Simple, transparent pricing</span>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
                        Let Luna watch your code
                    </h1>
                    <p className="text-lg text-neutral-400 max-w-2xl mx-auto">
                        Start free with unlimited commands. Upgrade for managed AI keys and team features.
                    </p>
                </div>

                {/* Pricing Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {plans.map(plan => (
                        <div
                            key={plan.name}
                            className={`neon-card p-8 flex flex-col ${plan.popular
                                ? 'border-violet-500/30 bg-gradient-to-b from-violet-500/5 to-transparent relative'
                                : ''
                                }`}
                        >
                            {plan.popular && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-violet-600 to-indigo-600 rounded-full text-xs font-semibold text-white uppercase tracking-wider">
                                    Most Popular
                                </div>
                            )}

                            <div className="mb-6">
                                <h3 className="text-lg font-semibold text-white mb-1">{plan.name}</h3>
                                <p className="text-sm text-neutral-500">{plan.description}</p>
                            </div>

                            <div className="mb-6">
                                <span className="text-4xl font-bold text-white">{plan.price}</span>
                                <span className="text-neutral-500 text-sm">{plan.period}</span>
                            </div>

                            <ul className="space-y-3 mb-8 flex-1">
                                {plan.features.map(feature => (
                                    <li key={feature} className="flex items-center gap-2 text-sm text-neutral-300">
                                        <span className="text-emerald-400 text-xs">✓</span>
                                        {feature}
                                    </li>
                                ))}
                            </ul>

                            <Link
                                href={plan.href}
                                className={`btn w-full ${plan.popular ? 'btn-primary' : 'btn-secondary'}`}
                            >
                                {plan.cta}
                            </Link>
                        </div>
                    ))}
                </div>

                {/* FAQ */}
                <div className="mt-16 text-center">
                    <p className="text-neutral-500 text-sm">
                        Questions? Email us at{' '}
                        <a href="mailto:hello@lunaos.ai" className="text-violet-400 hover:text-violet-300">
                            hello@lunaos.ai
                        </a>
                    </p>
                </div>
            </div>
        </div>
    );
}
