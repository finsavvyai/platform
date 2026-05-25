'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, animate, useMotionValue, useTransform } from 'framer-motion'
import { Zap, Users, Globe, Sparkles } from 'lucide-react'

interface Metric {
    icon: React.ReactNode
    value: number
    suffix: string
    label: string
    color: string
}

const METRICS: Metric[] = [
    {
        icon: <Zap className="w-5 h-5" />,
        value: 127453,
        suffix: '+',
        label: 'Tools Generated',
        color: 'from-yellow-500 to-orange-500'
    },
    {
        icon: <Users className="w-5 h-5" />,
        value: 4892,
        suffix: '+',
        label: 'Developers',
        color: 'from-blue-500 to-cyan-500'
    },
    {
        icon: <Globe className="w-5 h-5" />,
        value: 89,
        suffix: '',
        label: 'Countries',
        color: 'from-green-500 to-emerald-500'
    },
    {
        icon: <Sparkles className="w-5 h-5" />,
        value: 2841,
        suffix: '+',
        label: 'APIs Connected',
        color: 'from-purple-500 to-pink-500'
    }
]

function AnimatedCounter({ value, suffix }: { value: number; suffix: string }) {
    const count = useMotionValue(0)
    const rounded = useTransform(count, Math.round)
    const [displayValue, setDisplayValue] = useState(0)

    useEffect(() => {
        const controls = animate(count, value, {
            duration: 2.5,
            ease: 'easeOut',
        })

        const unsubscribe = rounded.on('change', (v) => setDisplayValue(v))

        return () => {
            controls.stop()
            unsubscribe()
        }
    }, [count, rounded, value])

    return (
        <span>
            {displayValue.toLocaleString()}{suffix}
        </span>
    )
}

interface LiveMetricsProps {
    className?: string
}

export function LiveMetrics({ className = '' }: LiveMetricsProps) {
    const [isVisible, setIsVisible] = useState(false)
    const [recentActivity, setRecentActivity] = useState<string[]>([])
    const containerRef = useRef<HTMLDivElement>(null)

    // Simulate real-time activity
    useEffect(() => {
        const activities = [
            'Stripe API → 47 tools generated',
            'GitHub API → 128 tools generated',
            'Shopify API → 89 tools generated',
            'Slack API → 34 tools generated',
            'Twilio API → 22 tools generated',
            'SendGrid API → 18 tools generated',
            'HubSpot API → 75 tools generated',
            'Zendesk API → 41 tools generated',
        ]

        let index = 0
        const interval = setInterval(() => {
            setRecentActivity(prev => {
                const newActivity = [activities[index % activities.length], ...prev.slice(0, 2)]
                index++
                return newActivity
            })
        }, 4000)

        // Initial activity
        setRecentActivity([activities[0]])

        return () => clearInterval(interval)
    }, [])

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true)
                }
            },
            { threshold: 0.2 }
        )

        if (containerRef.current) {
            observer.observe(containerRef.current)
        }

        return () => observer.disconnect()
    }, [])

    return (
        <section ref={containerRef} className={`py-16 ${className}`}>
            <div className="max-w-7xl mx-auto px-6">
                {/* Metrics Grid */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={isVisible ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.6 }}
                    className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8"
                >
                    {METRICS.map((metric, index) => (
                        <motion.div
                            key={metric.label}
                            initial={{ opacity: 0, y: 20 }}
                            animate={isVisible ? { opacity: 1, y: 0 } : {}}
                            transition={{ duration: 0.6, delay: index * 0.1 }}
                            className="relative group"
                        >
                            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 hover:bg-white/[0.05] hover:border-white/10 transition-all duration-300">
                                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${metric.color} flex items-center justify-center text-white mb-4`}>
                                    {metric.icon}
                                </div>
                                <div className="text-3xl font-bold text-white mb-1">
                                    {isVisible ? (
                                        <AnimatedCounter value={metric.value} suffix={metric.suffix} />
                                    ) : (
                                        '0'
                                    )}
                                </div>
                                <div className="text-gray-400 text-sm">{metric.label}</div>
                            </div>

                            {/* Subtle glow on hover */}
                            <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${metric.color} opacity-0 group-hover:opacity-5 transition-opacity duration-500 blur-xl -z-10`} />
                        </motion.div>
                    ))}
                </motion.div>

                {/* Real-time Activity Feed */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={isVisible ? { opacity: 1 } : {}}
                    transition={{ duration: 0.6, delay: 0.5 }}
                    className="bg-white/[0.02] border border-white/5 rounded-2xl p-4"
                >
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                        <span className="text-sm text-gray-400">Live activity</span>
                    </div>
                    <div className="space-y-2 overflow-hidden">
                        {recentActivity.map((activity, index) => (
                            <motion.div
                                key={`${activity}-${index}`}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1 - index * 0.3, x: 0 }}
                                transition={{ duration: 0.3 }}
                                className="flex items-center gap-2 text-sm"
                            >
                                <Zap className="w-4 h-4 text-yellow-500" />
                                <span className="text-gray-300">{activity}</span>
                                <span className="text-gray-500 text-xs">just now</span>
                            </motion.div>
                        ))}
                    </div>
                </motion.div>
            </div>
        </section>
    )
}

export default LiveMetrics
