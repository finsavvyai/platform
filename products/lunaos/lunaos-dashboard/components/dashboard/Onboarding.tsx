'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const ONBOARDING_KEY = 'lunaos_onboarding_complete';

interface Step {
    title: string;
    description: string;
    icon: string;
    href: string;
    cta: string;
}

const steps: Step[] = [
    {
        title: 'Run Your First Agent',
        description: 'Pick an agent from the catalog and run it on your code.',
        icon: '1',
        href: '/dashboard/agents',
        cta: 'Browse Agents',
    },
    {
        title: 'Connect a Repository',
        description: 'Link your GitHub repo for RAG-powered context.',
        icon: '2',
        href: '/dashboard/repos',
        cta: 'Connect Repo',
    },
    {
        title: 'Create an Agent Chain',
        description: 'Combine agents into automated multi-step workflows.',
        icon: '3',
        href: '/dashboard/chains',
        cta: 'Create Chain',
    },
    {
        title: 'Generate an API Key',
        description: 'Use the API to integrate agents into your CI/CD.',
        icon: '4',
        href: '/dashboard/api-keys',
        cta: 'Get API Key',
    },
];

export function Onboarding() {
    const [visible, setVisible] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const done = localStorage.getItem(ONBOARDING_KEY);
        if (!done) setVisible(true);
    }, []);

    if (!visible) return null;

    const dismiss = () => {
        localStorage.setItem(ONBOARDING_KEY, 'true');
        setVisible(false);
    };

    return (
        <div className="glass-card rounded-2xl p-6 mb-6 border border-violet-500/20">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
                <div>
                    <h2 className="text-lg font-semibold text-neutral-100">
                        Welcome to LunaOS
                    </h2>
                    <p className="text-sm text-neutral-400 mt-1">
                        Complete these steps to get the most out of your AI agents.
                    </p>
                </div>
                <button
                    onClick={dismiss}
                    className="text-neutral-500 hover:text-neutral-300 transition-colors text-sm"
                >
                    Dismiss
                </button>
            </div>

            {/* Progress bar */}
            <div className="flex gap-2 mb-6">
                {steps.map((_, i) => (
                    <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                            i <= currentStep ? 'bg-violet-500' : 'bg-white/10'
                        }`}
                    />
                ))}
            </div>

            {/* Current step */}
            <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center text-violet-400 font-bold shrink-0">
                    {steps[currentStep].icon}
                </div>
                <div className="flex-1">
                    <h3 className="font-medium text-neutral-100">
                        {steps[currentStep].title}
                    </h3>
                    <p className="text-sm text-neutral-400 mt-1">
                        {steps[currentStep].description}
                    </p>
                    <div className="flex items-center gap-3 mt-4">
                        <Link
                            href={steps[currentStep].href}
                            className="btn btn-primary text-sm"
                        >
                            {steps[currentStep].cta}
                        </Link>
                        {currentStep < steps.length - 1 ? (
                            <button
                                onClick={() => setCurrentStep((s) => s + 1)}
                                className="text-sm text-neutral-400 hover:text-neutral-200 transition-colors"
                            >
                                Skip this step
                            </button>
                        ) : (
                            <button
                                onClick={dismiss}
                                className="text-sm text-violet-400 hover:text-violet-300 transition-colors"
                            >
                                All done!
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Step dots */}
            <div className="flex justify-center gap-2 mt-5">
                {steps.map((_, i) => (
                    <button
                        key={i}
                        onClick={() => setCurrentStep(i)}
                        className={`w-2 h-2 rounded-full transition-colors ${
                            i === currentStep ? 'bg-violet-400' : 'bg-white/20'
                        }`}
                    />
                ))}
            </div>
        </div>
    );
}
