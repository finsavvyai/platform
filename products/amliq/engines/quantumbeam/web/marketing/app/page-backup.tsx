'use client'

import { useState, useEffect } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
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
  Network
} from 'lucide-react'

export default function HomePage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 })
  const [statsRef, statsInView] = useInView({ triggerOnce: true, threshold: 0.1 })

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-brand border-b border-border">
        <div className="container-padding">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-r from-quantum-600 to-brand-purple rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold">QuantumBeam</span>
            </div>

            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">Features</a>
              <a href="#technology" className="text-muted-foreground hover:text-foreground transition-colors">Technology</a>
              <a href="#pricing" className="text-muted-foreground hover:text-foreground transition-colors">Pricing</a>
              <a href="#testimonials" className="text-muted-foreground hover:text-foreground transition-colors">Testimonials</a>
            </div>

            <div className="hidden md:flex items-center space-x-4">
              <button className="btn-secondary">Sign In</button>
              <button className="btn-primary">Get Started</button>
            </div>

            <button
              className="md:hidden"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="md:hidden bg-background border-b border-border"
          >
            <div className="container-padding py-4 space-y-4">
              <a href="#features" className="block text-muted-foreground hover:text-foreground transition-colors">Features</a>
              <a href="#technology" className="block text-muted-foreground hover:text-foreground transition-colors">Technology</a>
              <a href="#pricing" className="block text-muted-foreground hover:text-foreground transition-colors">Pricing</a>
              <a href="#testimonials" className="block text-muted-foreground hover:text-foreground transition-colors">Testimonials</a>
              <div className="flex flex-col space-y-2 pt-4">
                <button className="btn-secondary">Sign In</button>
                <button className="btn-primary">Get Started</button>
              </div>
            </div>
          </motion.div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="section-padding hero-gradient relative overflow-hidden">
        <div className="absolute inset-0 grid-pattern opacity-50"></div>

        {/* Quantum particles background */}
        <div className="absolute inset-0">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="quantum-particle"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 4}s`
              }}
            />
          ))}
        </div>

        <div className="container-padding relative z-10">
          <motion.div
            ref={ref}
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8 }}
            className="max-w-4xl mx-auto text-center"
          >
            <motion.div
              className="inline-flex items-center space-x-2 bg-quantum-600/10 text-quantum-600 px-4 py-2 rounded-full mb-6 quantum-border"
              animate={{ opacity: [1, 0.7, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Zap className="w-4 h-4" />
              <span className="text-sm font-semibold">Quantum-Enhanced Security</span>
            </motion.div>

            <h1 className="hero-text text-balance mb-6">
              <span className="gradient-text">Quantum-Powered Fraud Detection</span>
              <br />
              Unprecedented Accuracy & Speed
            </h1>

            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto text-pretty">
              Harness the power of quantum computing to identify fraudulent transactions with
              99.7% accuracy. Process millions of transactions in real-time with quantum-enhanced
              AI algorithms that adapt to emerging threats.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4">
              <button className="btn-primary w-full sm:w-auto quantum-glow">
                Start Free Trial
                <ChevronRight className="w-5 h-5 ml-2" />
              </button>
              <button className="btn-secondary w-full sm:w-auto">
                Watch Demo
                <Eye className="w-5 h-5 ml-2" />
              </button>
            </div>

            <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-3xl mx-auto">
              {[
                { label: 'Accuracy Rate', value: '99.7%', icon: CheckCircle2 },
                { label: 'Processing Speed', value: '100M+/sec', icon: Zap },
                { label: 'False Positive Rate', value: '&lt;0.1%', icon: AlertTriangle }
              ].map((stat, index) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={inView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.5, delay: 0.2 + index * 0.1 }}
                  className="text-center"
                >
                  <stat.icon className="w-6 h-6 text-quantum-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-quantum-600">{stat.value}</div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="section-padding bg-muted/50">
        <div className="container-padding">
          <motion.div
            ref={statsRef}
            initial={{ opacity: 0, y: 20 }}
            animate={statsInView ? { opacity: 1, y: 0 } : {}}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Quantum <span className="gradient-text">Advantage</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Our quantum algorithms process complex fraud patterns that are impossible
              for classical systems to detect in real-time.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {[
              {
                icon: Brain,
                title: "Quantum Machine Learning",
                description: "Variational Quantum Classifiers identify subtle fraud patterns with quantum superposition states.",
                color: "from-brand-purple to-brand-pink"
              },
              {
                icon: TrendingUp,
                title: "Real-time Processing",
                description: "Process millions of transactions per second with quantum parallelism and entanglement.",
                color: "from-quantum-600 to-quantum-700"
              },
              {
                icon: Lock,
                title: "Quantum Encryption",
                description: "Your data is protected by quantum-resistant encryption algorithms.",
                color: "from-brand-cyan to-quantum-600"
              },
              {
                icon: BarChart3,
                title: "Advanced Analytics",
                description: "Quantum-inspired analytics reveal hidden fraud rings and sophisticated attack patterns.",
                color: "from-brand-pink to-brand-purple"
              },
              {
                icon: Shield,
                title: "Adaptive Defense",
                description: "Self-evolving quantum models that adapt to new fraud techniques automatically.",
                color: "from-quantum-600 to-brand-cyan"
              },
              {
                icon: Eye,
                title: "Complete Visibility",
                description: "Comprehensive dashboard with quantum-enhanced visualization tools.",
                color: "from-brand-purple to-quantum-700"
              }
            ].map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                animate={statsInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="feature-card card-hover bg-card rounded-xl p-6 border border-border"
              >
                <div className={`w-12 h-12 bg-gradient-to-r ${feature.color} rounded-lg flex items-center justify-center mb-4`}>
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Technology Section */}
      <section id="technology" className="section-padding">
        <div className="container-padding">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
              >
                <h2 className="text-3xl md:text-4xl font-bold mb-6">
                  How <span className="gradient-text">Quantum</span> Works
                </h2>
                <p className="text-lg text-muted-foreground mb-6">
                  Unlike classical computers that process information in binary bits (0s and 1s),
                  quantum computers use qubits that can exist in superposition - allowing them to
                  explore multiple possibilities simultaneously.
                </p>
                <p className="text-lg text-muted-foreground mb-8">
                  Our quantum fraud detection algorithms leverage this quantum parallelism to
                  analyze billions of potential fraud patterns in parallel, identifying threats
                  that would be computationally impossible for classical systems to detect.
                </p>
                <div className="space-y-4">
                  {[
                    "Variational Quantum Classifier for pattern recognition",
                    "Quantum Approximate Optimization Algorithm (QAOA)",
                    "Quantum kernel methods for feature mapping",
                    "Hybrid quantum-classical processing pipeline"
                  ].map((item, index) => (
                    <div key={index} className="flex items-center space-x-3">
                      <CheckCircle2 className="w-5 h-5 text-quantum-600 flex-shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="relative"
              >
                <div className="quantum-border rounded-xl p-8 bg-muted/50">
                  <div className="aspect-square bg-gradient-to-br from-quantum-600/20 to-brand-purple/20 rounded-lg flex items-center justify-center">
                    <div className="text-center">
                      <Brain className="w-16 h-16 text-quantum-600 mx-auto mb-4 quantum-pulse" />
                      <div className="text-2xl font-bold gradient-text">Quantum Core</div>
                      <div className="text-sm text-muted-foreground mt-2">Processing at Quantum Speed</div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="section-padding bg-muted/50">
        <div className="container-padding">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-4xl mx-auto text-center"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Ready to Experience <span className="gradient-text">Quantum Security</span>?
            </h2>
            <p className="text-xl text-muted-foreground mb-8">
              Join leading financial institutions already using QuantumBeam to protect
              millions of transactions daily.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4">
              <button className="btn-primary quantum-glow">
                Start Free Trial
                <ChevronRight className="w-5 h-5 ml-2" />
              </button>
              <button className="btn-secondary">
                Schedule Demo
                <Eye className="w-5 h-5 ml-2" />
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-background border-t border-border">
        <div className="container-padding py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-r from-quantum-600 to-brand-purple rounded-lg flex items-center justify-center">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold">QuantumBeam</span>
              </div>
              <p className="text-muted-foreground">
                Quantum-enhanced fraud detection for the future of financial security.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Features</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Technology</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">API Docs</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">About</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Careers</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Contact</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Terms of Service</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Security</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Compliance</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-border mt-12 pt-8 text-center text-muted-foreground">
            <p>&copy; 2024 QuantumBeam Inc. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}