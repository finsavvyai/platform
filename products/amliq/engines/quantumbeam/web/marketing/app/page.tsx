'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion'
import { useInView } from 'react-intersection-observer'
import {
  Shield,
  Zap,
  Brain,
  TrendingUp,
  ChevronRight,
  Menu,
  X,
  BarChart3,
  Lock,
  Eye,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Play,
  GitBranch,
  Users,
  Cpu,
  Network,
  Globe,
  Code,
  Layers,
  Target
} from 'lucide-react'

export default function HomePage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('quantum')
  const { scrollYProgress } = useScroll()
  const opacity = useTransform(scrollYProgress, [0, 0.2], [1, 0])

  // Animation variants
  const fadeInUp = {
    initial: { opacity: 0, y: 60 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6, ease: [0.6, -0.05, 0.01, 0.99] }
  }

  const staggerChildren = {
    animate: {
      transition: {
        staggerChildren: 0.1
      }
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white overflow-hidden">
      {/* Gradient Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-purple-500/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-blue-500/15 rounded-full blur-[150px]" />
        <div className="absolute top-1/2 left-1/2 w-[400px] h-[400px] bg-pink-500/10 rounded-full blur-[100px]" />
      </div>

      {/* Navigation - Qodo Style */}
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className="fixed top-0 left-0 right-0 z-50 bg-[#0A0A0F]/80 backdrop-blur-xl border-b border-white/5"
      >
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between h-20">
            {/* Logo */}
            <motion.div
              className="flex items-center space-x-3"
              whileHover={{ scale: 1.05 }}
            >
              <div className="relative">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg blur-lg opacity-50" />
              </div>
              <span className="text-xl font-bold">QuantumBeam</span>
            </motion.div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              <NavLink href="#features">Features</NavLink>
              <NavLink href="#technology">Technology</NavLink>
              <NavLink href="#pricing">Pricing</NavLink>
              <NavLink href="#docs">Docs</NavLink>
            </div>

            {/* CTA Buttons */}
            <div className="hidden md:flex items-center space-x-4">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-6 py-2.5 text-sm font-medium text-white/70 hover:text-white transition-colors"
              >
                Sign In
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05, boxShadow: "0 0 30px rgba(168, 85, 247, 0.4)" }}
                whileTap={{ scale: 0.95 }}
                className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg text-sm font-semibold flex items-center space-x-2 hover:shadow-lg hover:shadow-purple-500/50 transition-all"
              >
                <span>Get Started</span>
                <ArrowRight className="w-4 h-4" />
              </motion.button>
            </div>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden p-2"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden bg-[#0A0A0F]/95 backdrop-blur-xl border-t border-white/5"
            >
              <div className="px-6 py-6 space-y-4">
                <a href="#features" className="block py-2 text-white/70 hover:text-white">Features</a>
                <a href="#technology" className="block py-2 text-white/70 hover:text-white">Technology</a>
                <a href="#pricing" className="block py-2 text-white/70 hover:text-white">Pricing</a>
                <a href="#docs" className="block py-2 text-white/70 hover:text-white">Docs</a>
                <div className="pt-4 space-y-3">
                  <button className="w-full px-6 py-3 text-sm font-medium text-white/70 hover:text-white border border-white/10 rounded-lg">
                    Sign In
                  </button>
                  <button className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg text-sm font-semibold">
                    Get Started
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>

      {/* Hero Section - Qodo Style */}
      <section className="relative min-h-screen flex items-center justify-center pt-20">
        <div className="max-w-7xl mx-auto px-6 py-24 md:py-32">
          <div className="text-center">
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center space-x-2 bg-purple-500/10 border border-purple-500/20 rounded-full px-4 py-2 mb-8"
            >
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-medium text-purple-300">Classical Machine-Learning Fraud Scoring</span>
            </motion.div>

            {/* Main Heading */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-5xl md:text-7xl lg:text-8xl font-bold mb-8 leading-tight"
            >
              <span className="bg-gradient-to-r from-white via-purple-200 to-pink-200 bg-clip-text text-transparent">
                Fraud Detection
              </span>
              <br />
              <span className="text-white/90">in Real Time</span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-xl md:text-2xl text-white/60 max-w-3xl mx-auto mb-12 leading-relaxed"
            >
              Classical machine-learning models score transactions <span className="text-purple-400 font-semibold">in real time</span>.
              Built for high transaction volumes with a low-latency target. Accuracy benchmarking is in progress.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4 mb-16"
            >
              <motion.button
                whileHover={{ scale: 1.05, boxShadow: "0 0 40px rgba(168, 85, 247, 0.5)" }}
                whileTap={{ scale: 0.95 }}
                className="group px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl text-lg font-semibold flex items-center space-x-2 hover:shadow-2xl hover:shadow-purple-500/50 transition-all"
              >
                <span>Start Free Trial</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="group px-8 py-4 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-lg font-medium flex items-center space-x-2 hover:bg-white/10 transition-all"
              >
                <Play className="w-5 h-5" />
                <span>Watch Demo</span>
              </motion.button>
            </motion.div>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto"
            >
              {[
                { icon: CheckCircle2, value: 'ML', label: 'Classical Model Scoring' },
                { icon: Zap, value: '<50ms', label: 'Latency Target' },
                { icon: TrendingUp, value: '24/7', label: 'Real-Time Monitoring' }
              ].map((stat, index) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.5 + index * 0.1 }}
                  className="relative group"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 to-pink-600/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all">
                    <stat.icon className="w-8 h-8 text-purple-400 mb-3 mx-auto" />
                    <div className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
                      {stat.value}
                    </div>
                    <div className="text-sm text-white/60">{stat.label}</div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>

        {/* Floating Code Preview - Qodo Style */}
        <motion.div
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="absolute bottom-20 left-1/2 -translate-x-1/2 w-full max-w-4xl px-6"
        >
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 to-pink-600/20 rounded-2xl blur-2xl" />
            <div className="relative bg-[#1A1A2E]/90 backdrop-blur-xl border border-white/10 rounded-2xl p-6 overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full" />
                  <div className="w-3 h-3 bg-yellow-500 rounded-full" />
                  <div className="w-3 h-3 bg-green-500 rounded-full" />
                </div>
                <span className="text-xs text-white/40">fraud_detection.py</span>
              </div>
              <pre className="text-sm text-white/80 font-mono leading-relaxed">
                <code>{`from amliq_fraud import FraudDetector

detector = FraudDetector(model="ensemble")

# Analyze transaction with classical ML models
result = detector.analyze(
    transaction_id="txn_12345",
    amount=15000.00,
)

print(f"Fraud Score: {result.fraud_score}")
# Output: Fraud Score: 0.92 (High Risk)`}</code>
              </pre>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Features Grid - Qodo Style */}
      <section id="features" className="relative py-32">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-20"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                ML-Powered
              </span>
              {' '}Features
            </h2>
            <p className="text-xl text-white/60 max-w-2xl mx-auto">
              Advanced fraud detection capabilities powered by classical machine learning
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Brain,
                title: 'Ensemble Machine Learning',
                description: 'Random Forest and Gradient Boosting models classify complex fraud patterns',
                color: 'from-purple-500 to-pink-500'
              },
              {
                icon: Zap,
                title: 'Real-Time Processing',
                description: 'Analyze high transaction volumes with parallel model inference',
                color: 'from-blue-500 to-purple-500'
              },
              {
                icon: Network,
                title: 'Fraud Ring Detection',
                description: 'Graph algorithms identify sophisticated fraud networks',
                color: 'from-pink-500 to-red-500'
              },
              {
                icon: Lock,
                title: 'Strong Encryption',
                description: 'TLS encryption and hardened key management keep your data secure',
                color: 'from-green-500 to-blue-500'
              },
              {
                icon: BarChart3,
                title: 'Advanced Analytics',
                description: 'Model-driven insights reveal hidden patterns and trends',
                color: 'from-yellow-500 to-orange-500'
              },
              {
                icon: Cpu,
                title: 'Hybrid Architecture',
                description: 'Modular services for scoring, ring detection, and analytics',
                color: 'from-indigo-500 to-purple-500'
              }
            ].map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                whileHover={{ y: -8 }}
                className="group relative"
              >
                <div className={`absolute inset-0 bg-gradient-to-r ${feature.color} rounded-2xl blur-xl opacity-0 group-hover:opacity-30 transition-opacity`} />
                <div className="relative h-full bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 hover:bg-white/10 transition-all">
                  <div className={`w-14 h-14 bg-gradient-to-r ${feature.color} rounded-xl flex items-center justify-center mb-6`}>
                    <feature.icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                  <p className="text-white/60 leading-relaxed">{feature.description}</p>
                  <div className="mt-6 flex items-center text-sm text-purple-400 group-hover:text-purple-300">
                    Learn more <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Technology Deep Dive - Qodo Style */}
      <section id="technology" className="relative py-32 bg-gradient-to-b from-transparent via-purple-900/5 to-transparent">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <div className="inline-flex items-center space-x-2 bg-purple-500/10 border border-purple-500/20 rounded-full px-4 py-2 mb-6">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span className="text-sm font-medium text-purple-300">Machine-Learning Technology</span>
              </div>

              <h2 className="text-4xl md:text-5xl font-bold mb-6">
                How Machine Learning{' '}
                <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                  Catches Fraud
                </span>
              </h2>

              <p className="text-lg text-white/60 mb-8 leading-relaxed">
                Ensemble models trained on transaction features score every event in real time,
                combining behavioral signals, graph structure, and anomaly detection.
              </p>

              <div className="space-y-6">
                {[
                  {
                    icon: GitBranch,
                    title: 'Feature Engineering',
                    description: 'Extract behavioral and transactional signals per event'
                  },
                  {
                    icon: Network,
                    title: 'Graph Analysis',
                    description: 'Detect complex correlations across transaction networks'
                  },
                  {
                    icon: Target,
                    title: 'Ensemble Scoring',
                    description: 'Blend model outputs into a single calibrated risk score'
                  }
                ].map((item, index) => (
                  <motion.div
                    key={item.title}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: index * 0.1 }}
                    className="flex items-start space-x-4"
                  >
                    <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg flex items-center justify-center">
                      <item.icon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                      <p className="text-white/60">{item.description}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="relative"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-600/30 to-pink-600/30 rounded-3xl blur-3xl" />
                <div className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-12">
                  <div className="aspect-square flex items-center justify-center">
                    <div className="relative w-full h-full">
                      {/* Quantum Circuit Visualization */}
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                        className="absolute inset-0"
                      >
                        {[...Array(3)].map((_, i) => (
                          <div
                            key={i}
                            className="absolute top-1/2 left-1/2 w-full h-0.5 bg-gradient-to-r from-transparent via-purple-400 to-transparent"
                            style={{
                              transform: `translate(-50%, -50%) rotate(${i * 60}deg)`,
                              transformOrigin: 'center'
                            }}
                          />
                        ))}
                      </motion.div>

                      <div className="absolute inset-0 flex items-center justify-center">
                        <motion.div
                          animate={{ scale: [1, 1.1, 1] }}
                          transition={{ duration: 2, repeat: Infinity }}
                          className="w-32 h-32 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full flex items-center justify-center"
                        >
                          <Brain className="w-16 h-16 text-white" />
                        </motion.div>
                      </div>

                      {/* Orbiting Particles */}
                      {[...Array(8)].map((_, i) => (
                        <motion.div
                          key={i}
                          animate={{
                            rotate: 360,
                          }}
                          transition={{
                            duration: 10,
                            repeat: Infinity,
                            ease: "linear",
                            delay: i * 0.5
                          }}
                          className="absolute top-1/2 left-1/2"
                          style={{
                            width: `${60 + i * 15}%`,
                            height: `${60 + i * 15}%`,
                            marginLeft: `-${30 + i * 7.5}%`,
                            marginTop: `-${30 + i * 7.5}%`
                          }}
                        >
                          <div className="absolute top-0 left-1/2 w-3 h-3 bg-purple-400 rounded-full -translate-x-1/2" />
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Social Proof - Qodo Style */}
      <section className="relative py-32">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <p className="text-sm text-white/40 uppercase tracking-wider mb-8">Trusted by Industry Leaders</p>
            <div className="flex flex-wrap items-center justify-center gap-12 opacity-50">
              {['Goldman Sachs', 'JPMorgan', 'Visa', 'Mastercard', 'PayPal', 'Stripe'].map((company) => (
                <div key={company} className="text-2xl font-bold text-white/60">{company}</div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA Section - Qodo Style */}
      <section className="relative py-32">
        <div className="max-w-4xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 to-pink-600/20 rounded-3xl blur-3xl" />
            <div className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-12 md:p-16 text-center">
              <h2 className="text-4xl md:text-5xl font-bold mb-6">
                Ready to Experience{' '}
                <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                  Real-Time Fraud Protection
                </span>
                ?
              </h2>
              <p className="text-xl text-white/60 mb-10 max-w-2xl mx-auto">
                Protect your transactions with classical machine-learning fraud detection
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4">
                <motion.button
                  whileHover={{ scale: 1.05, boxShadow: "0 0 40px rgba(168, 85, 247, 0.5)" }}
                  whileTap={{ scale: 0.95 }}
                  className="group px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl text-lg font-semibold flex items-center space-x-2"
                >
                  <span>Start Free Trial</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-8 py-4 bg-white/5 border border-white/10 rounded-xl text-lg font-medium hover:bg-white/10 transition-all"
                >
                  Schedule Demo
                </motion.button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer - Qodo Style */}
      <footer className="relative border-t border-white/10 bg-[#0A0A0F]/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12">
            <div className="lg:col-span-2">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <span className="text-xl font-bold">QuantumBeam</span>
              </div>
              <p className="text-white/60 mb-6 leading-relaxed max-w-sm">
                Classical machine-learning fraud detection engine for real-time transaction scoring.
              </p>
              <div className="flex items-center space-x-4">
                {['Twitter', 'LinkedIn', 'GitHub'].map((social) => (
                  <a
                    key={social}
                    href="#"
                    className="w-10 h-10 bg-white/5 border border-white/10 rounded-lg flex items-center justify-center hover:bg-white/10 transition-all"
                  >
                    <span className="sr-only">{social}</span>
                    <Globe className="w-5 h-5 text-white/60" />
                  </a>
                ))}
              </div>
            </div>

            {[
              {
                title: 'Product',
                links: ['Features', 'Technology', 'Pricing', 'API', 'Documentation']
              },
              {
                title: 'Company',
                links: ['About', 'Blog', 'Careers', 'Contact', 'Press']
              },
              {
                title: 'Legal',
                links: ['Privacy', 'Terms', 'Security', 'Compliance']
              }
            ].map((section) => (
              <div key={section.title}>
                <h3 className="font-semibold mb-4">{section.title}</h3>
                <ul className="space-y-3">
                  {section.links.map((link) => (
                    <li key={link}>
                      <a href="#" className="text-white/60 hover:text-white transition-colors">
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="border-t border-white/10 mt-16 pt-8 flex flex-col md:flex-row items-center justify-between">
            <p className="text-white/40 text-sm">
              © 2024 QuantumBeam Inc. All rights reserved.
            </p>
            <div className="flex items-center space-x-6 mt-4 md:mt-0">
              <a href="#" className="text-white/40 hover:text-white text-sm transition-colors">Privacy Policy</a>
              <a href="#" className="text-white/40 hover:text-white text-sm transition-colors">Terms of Service</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

// NavLink Component
function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="relative text-sm font-medium text-white/70 hover:text-white transition-colors group"
    >
      {children}
      <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-purple-500 to-pink-500 group-hover:w-full transition-all duration-300" />
    </a>
  )
}
