'use client'

import { motion, useScroll, useTransform } from 'framer-motion'
import { useInView } from 'react-intersection-observer'
import Link from 'next/link'
import {
  Zap,
  Globe,
  Shield,
  Code2,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Cpu,
  Network,
  Rocket,
  Play,
  Github,
  Twitter
} from 'lucide-react'
import { InteractiveDemo } from '../components/InteractiveDemo'
import { LiveMetrics } from '../components/LiveMetrics'

// Animation variants
const fadeInUp = {
  hidden: { opacity: 0, y: 60 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] } }
}

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.3 }
  }
}

const scaleIn = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.6, ease: 'easeOut' } }
}

// Animated background grid
function GridBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:64px_64px]" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-gradient-radial from-blue-500/10 via-transparent to-transparent blur-3xl" />
      <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-gradient-radial from-purple-500/10 via-transparent to-transparent blur-3xl" />
    </div>
  )
}

// Floating particles
function FloatingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(20)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 bg-blue-400/30 rounded-full"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
          }}
          animate={{
            y: [0, -30, 0],
            opacity: [0.3, 0.8, 0.3],
          }}
          transition={{
            duration: 3 + Math.random() * 2,
            repeat: Infinity,
            delay: Math.random() * 2,
          }}
        />
      ))}
    </div>
  )
}

// Glowing orb component
function GlowingOrb({ className }: { className?: string }) {
  return (
    <div className={`absolute rounded-full blur-3xl opacity-20 animate-pulse ${className}`} />
  )
}

// Navigation
function Navigation() {
  return (
    <motion.nav
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
      className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-black/20 border-b border-white/5"
    >
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <Cpu className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-white">MCPOverflow</span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          <Link href="#features" className="text-gray-300 hover:text-white transition-colors">Features</Link>
          <Link href="#how-it-works" className="text-gray-300 hover:text-white transition-colors">How it Works</Link>
          <Link href="#pricing" className="text-gray-300 hover:text-white transition-colors">Pricing</Link>
          <Link href="https://docs.mcpoverflow.dev" className="text-gray-300 hover:text-white transition-colors">Docs</Link>
        </div>

        <div className="flex items-center gap-4">
          <Link href="/login" className="text-gray-300 hover:text-white transition-colors">Login</Link>
          <Link
            href="/signup"
            className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full text-white font-medium hover:shadow-lg hover:shadow-blue-500/25 transition-all"
          >
            Get Started
          </Link>
        </div>
      </div>
    </motion.nav>
  )
}

// Hero Section
function HeroSection() {
  const { scrollY } = useScroll()
  const y = useTransform(scrollY, [0, 500], [0, 150])
  const opacity = useTransform(scrollY, [0, 300], [1, 0])

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
      <GridBackground />
      <FloatingParticles />
      <GlowingOrb className="w-[500px] h-[500px] bg-blue-500 top-1/4 left-1/4" />
      <GlowingOrb className="w-[400px] h-[400px] bg-purple-500 bottom-1/4 right-1/4" />

      <motion.div
        style={{ y, opacity }}
        className="relative z-10 max-w-6xl mx-auto px-6 text-center"
      >
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm mb-8"
        >
          <Sparkles className="w-4 h-4 text-yellow-400" />
          <span className="text-sm text-gray-300">Now supporting GraphQL & Postman</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="text-5xl md:text-7xl lg:text-8xl font-bold text-white mb-6 leading-tight"
        >
          Every API.{' '}
          <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            Every AI.
          </span>
          <br />
          <span className="text-gray-400">Connected.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-xl md:text-2xl text-gray-400 max-w-3xl mx-auto mb-10"
        >
          Generate MCP connectors from your API specs in seconds.
          Let AI agents interact with any API instantly.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link
            href="/signup"
            className="group px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full text-white font-semibold text-lg hover:shadow-2xl hover:shadow-blue-500/30 transition-all flex items-center gap-2"
          >
            Start Building Free
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link
            href="#demo"
            className="px-8 py-4 bg-white/5 border border-white/10 rounded-full text-white font-semibold text-lg hover:bg-white/10 transition-all flex items-center gap-2 backdrop-blur-sm"
          >
            <Play className="w-5 h-5" />
            Watch Demo
          </Link>
        </motion.div>

        {/* Trusted by section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.8 }}
          className="mt-20"
        >
          <p className="text-sm text-gray-500 mb-6">TRUSTED BY DEVELOPERS AT</p>
          <div className="flex items-center justify-center gap-12 opacity-50">
            {['Stripe', 'Vercel', 'Supabase', 'Cloudflare', 'GitHub'].map((company) => (
              <span key={company} className="text-gray-400 font-semibold text-lg">{company}</span>
            ))}
          </div>
        </motion.div>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2"
      >
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="w-6 h-10 border-2 border-white/20 rounded-full flex items-start justify-center p-2"
        >
          <div className="w-1.5 h-3 bg-white/40 rounded-full" />
        </motion.div>
      </motion.div>
    </section>
  )
}

// Features Section
function FeaturesSection() {
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 })

  const features = [
    {
      icon: <Zap className="w-7 h-7" />,
      title: 'Lightning Fast',
      description: 'Generate 200+ MCP tools from any OpenAPI spec in under 60 seconds.',
      gradient: 'from-yellow-500 to-orange-500'
    },
    {
      icon: <Globe className="w-7 h-7" />,
      title: 'Global Edge Deployment',
      description: 'Deploy to Cloudflare Workers with zero-downtime updates worldwide.',
      gradient: 'from-blue-500 to-cyan-500'
    },
    {
      icon: <Shield className="w-7 h-7" />,
      title: 'Enterprise Security',
      description: 'Your credentials never leave your infrastructure. Full audit logging.',
      gradient: 'from-green-500 to-emerald-500'
    },
    {
      icon: <Code2 className="w-7 h-7" />,
      title: 'Multi-Format Support',
      description: 'OpenAPI 3.0, GraphQL schemas, and Postman collections supported.',
      gradient: 'from-purple-500 to-pink-500'
    },
    {
      icon: <Network className="w-7 h-7" />,
      title: 'AI-Native',
      description: 'Built for Claude, GPT, and any MCP-compatible AI agent.',
      gradient: 'from-indigo-500 to-blue-500'
    },
    {
      icon: <Rocket className="w-7 h-7" />,
      title: 'One-Click Deploy',
      description: 'From API spec to production in minutes. No infrastructure to manage.',
      gradient: 'from-rose-500 to-red-500'
    }
  ]

  return (
    <section id="features" className="relative py-32 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-black via-gray-900/50 to-black" />

      <motion.div
        ref={ref}
        variants={staggerContainer}
        initial="hidden"
        animate={inView ? 'visible' : 'hidden'}
        className="relative z-10 max-w-7xl mx-auto px-6"
      >
        <motion.div variants={fadeInUp} className="text-center mb-20">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Everything you need to
            <br />
            <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              connect AI to your APIs
            </span>
          </h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            MCPOverflow handles the complexity so you can focus on building amazing AI experiences.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              variants={scaleIn}
              className="group relative p-8 rounded-3xl bg-white/[0.02] border border-white/5 backdrop-blur-sm hover:bg-white/[0.05] hover:border-white/10 transition-all duration-500"
            >
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center text-white mb-6 group-hover:scale-110 transition-transform duration-300`}>
                {feature.icon}
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">{feature.title}</h3>
              <p className="text-gray-400 leading-relaxed">{feature.description}</p>

              {/* Subtle glow on hover */}
              <div className={`absolute inset-0 rounded-3xl bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-500 blur-xl`} />
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  )
}

// How It Works Section
function HowItWorksSection() {
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 })

  const steps = [
    { step: '01', title: 'Upload Your Spec', description: 'Drop in your OpenAPI, GraphQL, or Postman collection.' },
    { step: '02', title: 'Auto-Generate', description: 'We parse and create typed MCP tools automatically.' },
    { step: '03', title: 'One-Click Deploy', description: 'Deploy to the edge with global distribution.' },
    { step: '04', title: 'Connect AI', description: 'Your AI agents can now use your API instantly.' },
  ]

  return (
    <section id="how-it-works" className="relative py-32">
      <motion.div
        ref={ref}
        variants={staggerContainer}
        initial="hidden"
        animate={inView ? 'visible' : 'hidden'}
        className="max-w-7xl mx-auto px-6"
      >
        <motion.div variants={fadeInUp} className="text-center mb-20">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            How it works
          </h2>
          <p className="text-xl text-gray-400">
            Four simple steps to AI-powered API access
          </p>
        </motion.div>

        <div className="grid md:grid-cols-4 gap-8">
          {steps.map((item, index) => (
            <motion.div key={item.step} variants={fadeInUp} className="relative">
              <div className="text-6xl font-bold text-white/5 mb-4">{item.step}</div>
              <h3 className="text-xl font-semibold text-white mb-2">{item.title}</h3>
              <p className="text-gray-400">{item.description}</p>

              {index < 3 && (
                <div className="hidden md:block absolute top-8 left-full w-full h-px bg-gradient-to-r from-white/10 to-transparent" />
              )}
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  )
}

// Pricing Section
function PricingSection() {
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 })

  const plans = [
    {
      name: 'Free',
      price: '$0',
      period: 'forever',
      description: 'Perfect for trying out MCPOverflow',
      features: [
        '3 connectors',
        '1,000 API calls/month',
        'Community support',
        'OpenAPI support',
        'Basic analytics',
      ],
      cta: 'Get Started',
      popular: false,
    },
    {
      name: 'Pro',
      price: '$29',
      period: '/month',
      description: 'For professional developers and small teams',
      features: [
        'Unlimited connectors',
        '100,000 API calls/month',
        'Priority support',
        'OpenAPI, GraphQL & Postman',
        'Advanced analytics',
        'Custom domains',
        'Team collaboration (5 seats)',
      ],
      cta: 'Start Free Trial',
      popular: true,
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      period: '',
      description: 'For organizations with advanced needs',
      features: [
        'Everything in Pro',
        'Unlimited API calls',
        'Dedicated support',
        'SSO & SAML',
        'SLA guarantee',
        'On-premise deployment',
        'Custom integrations',
      ],
      cta: 'Contact Sales',
      popular: false,
    },
  ]

  return (
    <section id="pricing" className="relative py-32">
      <motion.div
        ref={ref}
        variants={staggerContainer}
        initial="hidden"
        animate={inView ? 'visible' : 'hidden'}
        className="max-w-7xl mx-auto px-6"
      >
        <motion.div variants={fadeInUp} className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Simple, transparent pricing
          </h2>
          <p className="text-xl text-gray-400">
            Start free, scale as you grow
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          {plans.map((plan) => (
            <motion.div
              key={plan.name}
              variants={scaleIn}
              className={`relative p-8 rounded-3xl border backdrop-blur-sm transition-all duration-500 ${plan.popular
                ? 'bg-gradient-to-b from-blue-500/10 to-purple-500/10 border-blue-500/30'
                : 'bg-white/[0.02] border-white/10 hover:border-white/20'
                }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full text-sm font-medium text-white">
                  Most Popular
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-xl font-semibold text-white mb-2">{plan.name}</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-white">{plan.price}</span>
                  <span className="text-gray-400">{plan.period}</span>
                </div>
                <p className="text-gray-400 mt-2">{plan.description}</p>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-3 text-gray-300">
                    <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>

              <Link
                href={plan.name === 'Enterprise' ? '/contact' : '/signup'}
                className={`block w-full py-3 rounded-xl font-semibold text-center transition-all ${plan.popular
                  ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:shadow-lg hover:shadow-blue-500/25'
                  : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
              >
                {plan.cta}
              </Link>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  )
}

// CTA Section
function CTASection() {
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.2 })

  return (
    <section className="relative py-32 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-pink-600/20 blur-3xl" />

      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 50 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.8 }}
        className="relative z-10 max-w-4xl mx-auto px-6 text-center"
      >
        <h2 className="text-4xl md:text-6xl font-bold text-white mb-6">
          Ready to connect your APIs to AI?
        </h2>
        <p className="text-xl text-gray-400 mb-10">
          Join thousands of developers building the future of AI-powered applications.
        </p>
        <Link
          href="/signup"
          className="inline-flex items-center gap-2 px-10 py-5 bg-white text-black font-semibold text-lg rounded-full hover:bg-gray-100 transition-colors"
        >
          Get Started for Free
          <ArrowRight className="w-5 h-5" />
        </Link>
      </motion.div>
    </section>
  )
}

// Footer
function Footer() {
  return (
    <footer className="border-t border-white/5 py-12">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Cpu className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-white">MCPOverflow</span>
          </div>

          <div className="flex items-center gap-8 text-gray-400 text-sm">
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
            <Link href="/docs" className="hover:text-white transition-colors">Documentation</Link>
            <Link href="/blog" className="hover:text-white transition-colors">Blog</Link>
          </div>

          <div className="flex items-center gap-4">
            <Link href="https://twitter.com/mcpoverflow" className="text-gray-400 hover:text-white transition-colors">
              <Twitter className="w-5 h-5" />
            </Link>
            <Link href="https://github.com/mcpoverflow" className="text-gray-400 hover:text-white transition-colors">
              <Github className="w-5 h-5" />
            </Link>
          </div>
        </div>

        <div className="mt-8 text-center text-gray-500 text-sm">
          © 2026 MCPOverflow. All rights reserved.
        </div>
      </div>
    </footer>
  )
}

// Main Page Component
export default function LandingPage() {
  return (
    <main className="bg-black text-white overflow-hidden">
      <Navigation />
      <HeroSection />
      <LiveMetrics />
      <FeaturesSection />
      <HowItWorksSection />
      <InteractiveDemo />
      <PricingSection />
      <CTASection />
      <Footer />
    </main>
  )
}