'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    X,
    ArrowRight,
    ArrowLeft,
    Upload,
    Sparkles,
    Rocket,
    CheckCircle,
    Code2,
    Zap,
    Globe,
    Settings
} from 'lucide-react'

interface OnboardingStep {
    id: string
    title: string
    description: string
    icon: React.ReactNode
    action?: string
    highlight?: string  // CSS selector to highlight
}

const ONBOARDING_STEPS: OnboardingStep[] = [
    {
        id: 'welcome',
        title: 'Welcome to MCPOverflow! 🚀',
        description: 'Let me show you how to connect your APIs to AI agents in just a few steps.',
        icon: <Sparkles className="w-8 h-8 text-yellow-400" />,
    },
    {
        id: 'upload',
        title: 'Upload Your API Spec',
        description: 'Start by uploading an OpenAPI, GraphQL, or Postman collection. We support all major formats.',
        icon: <Upload className="w-8 h-8 text-blue-400" />,
        action: 'Try it now',
        highlight: '[data-onboarding="upload-spec"]',
    },
    {
        id: 'generate',
        title: 'Auto-Generate MCP Tools',
        description: 'Watch as we automatically parse your spec and generate type-safe MCP tools for every endpoint.',
        icon: <Code2 className="w-8 h-8 text-purple-400" />,
        action: 'Generate',
        highlight: '[data-onboarding="generate-button"]',
    },
    {
        id: 'deploy',
        title: 'One-Click Deploy',
        description: 'Deploy your connector to the edge with one click. We handle SSL, scaling, and global distribution.',
        icon: <Rocket className="w-8 h-8 text-pink-400" />,
        action: 'Deploy',
        highlight: '[data-onboarding="deploy-button"]',
    },
    {
        id: 'connect',
        title: 'Connect to AI Agents',
        description: 'Use your connector URL with Claude, GPT, or any MCP-compatible AI agent. That\'s it!',
        icon: <Globe className="w-8 h-8 text-green-400" />,
        action: 'View Docs',
        highlight: '[data-onboarding="connector-url"]',
    },
    {
        id: 'complete',
        title: 'You\'re All Set! 🎉',
        description: 'You now know how to connect any API to AI. Explore templates or create your first connector.',
        icon: <CheckCircle className="w-8 h-8 text-green-400" />,
    },
]

interface OnboardingTourProps {
    isOpen: boolean
    onComplete: () => void
    onSkip: () => void
}

export function OnboardingTour({ isOpen, onComplete, onSkip }: OnboardingTourProps) {
    const [currentStep, setCurrentStep] = useState(0)
    const [highlightPosition, setHighlightPosition] = useState<DOMRect | null>(null)

    const step = ONBOARDING_STEPS[currentStep]
    const isLastStep = currentStep === ONBOARDING_STEPS.length - 1
    const isFirstStep = currentStep === 0

    // Update highlight position when step changes
    useEffect(() => {
        if (!step.highlight) {
            setHighlightPosition(null)
            return
        }

        const element = document.querySelector(step.highlight)
        if (element) {
            const rect = element.getBoundingClientRect()
            setHighlightPosition(rect)

            // Scroll element into view if needed
            element.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
    }, [step.highlight])

    const handleNext = useCallback(() => {
        if (isLastStep) {
            onComplete()
        } else {
            setCurrentStep(prev => prev + 1)
        }
    }, [isLastStep, onComplete])

    const handlePrev = useCallback(() => {
        if (!isFirstStep) {
            setCurrentStep(prev => prev - 1)
        }
    }, [isFirstStep])

    const handleSkip = useCallback(() => {
        onSkip()
    }, [onSkip])

    if (!isOpen) return null

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100]"
            >
                {/* Backdrop */}
                <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

                {/* Highlight Mask */}
                {highlightPosition && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="absolute pointer-events-none"
                        style={{
                            left: highlightPosition.left - 8,
                            top: highlightPosition.top - 8,
                            width: highlightPosition.width + 16,
                            height: highlightPosition.height + 16,
                            boxShadow: '0 0 0 9999px rgba(0,0,0,0.8)',
                            borderRadius: '12px',
                        }}
                    >
                        <div className="absolute inset-0 rounded-xl border-2 border-blue-500 animate-pulse" />
                    </motion.div>
                )}

                {/* Tooltip */}
                <motion.div
                    key={step.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md"
                    style={highlightPosition ? {
                        top: highlightPosition.bottom + 24,
                        transform: 'translateX(-50%)',
                    } : undefined}
                >
                    <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 shadow-2xl">
                        {/* Close Button */}
                        <button
                            onClick={handleSkip}
                            className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        {/* Step Header */}
                        <div className="flex items-center gap-4 mb-4">
                            <div className="p-3 rounded-xl bg-white/5">
                                {step.icon}
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white">{step.title}</h3>
                                <p className="text-sm text-gray-500">
                                    Step {currentStep + 1} of {ONBOARDING_STEPS.length}
                                </p>
                            </div>
                        </div>

                        {/* Description */}
                        <p className="text-gray-300 mb-6">{step.description}</p>

                        {/* Progress Dots */}
                        <div className="flex items-center justify-center gap-2 mb-6">
                            {ONBOARDING_STEPS.map((_, index) => (
                                <button
                                    key={index}
                                    onClick={() => setCurrentStep(index)}
                                    className={`w-2 h-2 rounded-full transition-all ${index === currentStep
                                            ? 'w-6 bg-blue-500'
                                            : index < currentStep
                                                ? 'bg-blue-500/50'
                                                : 'bg-gray-600'
                                        }`}
                                />
                            ))}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-between">
                            <button
                                onClick={handlePrev}
                                disabled={isFirstStep}
                                className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                Back
                            </button>

                            <div className="flex items-center gap-3">
                                <button
                                    onClick={handleSkip}
                                    className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                                >
                                    Skip Tour
                                </button>
                                <button
                                    onClick={handleNext}
                                    className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg text-white font-medium hover:shadow-lg hover:shadow-blue-500/25 transition-all"
                                >
                                    {isLastStep ? 'Get Started' : 'Next'}
                                    <ArrowRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    )
}

// Hook to manage onboarding state
export function useOnboarding() {
    const [isOpen, setIsOpen] = useState(false)
    const [hasCompleted, setHasCompleted] = useState(false)

    useEffect(() => {
        // Check localStorage for completion status
        const completed = localStorage.getItem('mcpoverflow:onboarding:completed')
        if (completed) {
            setHasCompleted(true)
        } else {
            // Auto-start for new users (with delay)
            const timer = setTimeout(() => setIsOpen(true), 1500)
            return () => clearTimeout(timer)
        }
    }, [])

    const complete = useCallback(() => {
        localStorage.setItem('mcpoverflow:onboarding:completed', 'true')
        setIsOpen(false)
        setHasCompleted(true)
    }, [])

    const skip = useCallback(() => {
        localStorage.setItem('mcpoverflow:onboarding:skipped', 'true')
        setIsOpen(false)
    }, [])

    const restart = useCallback(() => {
        localStorage.removeItem('mcpoverflow:onboarding:completed')
        localStorage.removeItem('mcpoverflow:onboarding:skipped')
        setHasCompleted(false)
        setIsOpen(true)
    }, [])

    return {
        isOpen,
        hasCompleted,
        complete,
        skip,
        restart,
        start: () => setIsOpen(true),
    }
}

export default OnboardingTour
