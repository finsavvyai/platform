import React from 'react';
import { motion } from 'framer-motion';
import { 
  Mic, 
  Brain, 
  Shield, 
  Zap, 
  BarChart3, 
  Code, 
  Globe, 
  CheckCircle,
  ArrowRight,
  Play,
  Star,
  Users,
  Award,
  TrendingUp
} from 'lucide-react';
import { useSEO } from '../hooks/useSEO';

export default function HomePage() {
  useSEO({
    title: 'AI-Powered Testing Platform - Voice, Performance & Security',
    description: 'Revolutionary testing platform with voice-controlled test creation, AI-powered performance testing, intelligent security scanning, and automated unit test generation. Transform your testing workflow.',
    keywords: 'AI testing, voice testing, performance testing, penetration testing, unit test generation, test automation, security testing',
    canonical: 'https://questro.io'
  });

  const fadeInUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6 }
  };

  const staggerChildren = {
    animate: {
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mb-8"
            >
              <span className="inline-flex items-center px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-sm font-medium">
                🚀 World's First Voice-Controlled AI Testing Platform
              </span>
            </motion.div>
            
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold leading-tight mb-6">
              <span className="block">The Future of</span>
              <span className="block bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                Intelligent Testing
              </span>
            </h1>
            
            <p className="text-xl lg:text-2xl text-gray-300 max-w-4xl mx-auto mb-12 leading-relaxed">
              Transform your testing with revolutionary AI that understands voice commands, 
              generates intelligent tests, performs security assessments, and scales performance testing—all in one platform.
            </p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="flex flex-col sm:flex-row gap-6 justify-center items-center mb-16"
            >
              <button className="group bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700 px-8 py-4 rounded-xl font-semibold text-lg transition-all transform hover:scale-105 hover:shadow-2xl">
                Start Free Trial
                <ArrowRight className="inline-block w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </button>
              <button className="group border-2 border-white/30 hover:border-white/50 px-8 py-4 rounded-xl font-semibold text-lg backdrop-blur-sm hover:bg-white/10 transition-all">
                <Play className="inline-block w-5 h-5 mr-2" />
                Watch Demo
              </button>
            </motion.div>

            {/* Feature Icons */}
            <motion.div
              variants={staggerChildren}
              initial="initial"
              animate="animate"
              className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto"
            >
              {[
                { icon: Mic, label: 'Voice Testing', desc: 'Speak your tests' },
                { icon: Brain, label: 'AI Generation', desc: 'Intelligent automation' },
                { icon: Shield, label: 'Security Scanning', desc: 'Penetration testing' },
                { icon: Zap, label: 'Performance', desc: 'Load & stress testing' }
              ].map((feature, index) => (
                <motion.div
                  key={index}
                  variants={fadeInUp}
                  className="text-center group"
                >
                  <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 group-hover:bg-white/20 transition-all">
                    <feature.icon className="w-8 h-8 mx-auto mb-3 text-cyan-400" />
                    <h3 className="font-semibold mb-1">{feature.label}</h3>
                    <p className="text-sm text-gray-400">{feature.desc}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Revolutionary Features */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-5xl font-bold text-gray-900 mb-6">
              Revolutionary Testing Capabilities
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Experience the future of testing with AI-powered features that no other platform offers
            </p>
          </motion.div>

          <div className="grid lg:grid-cols-2 gap-16 items-center mb-20">
            {/* Voice Testing */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="space-y-6"
            >
              <div className="flex items-center space-x-3 mb-4">
                <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-3 rounded-xl">
                  <Mic className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-3xl font-bold text-gray-900">Voice-Controlled Testing</h3>
              </div>
              <p className="text-lg text-gray-600 leading-relaxed">
                The world's first voice-controlled testing platform. Simply speak your test scenarios and watch as AI generates 
                complete test suites, executes them, and provides spoken summaries of results.
              </p>
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-500 mt-1 flex-shrink-0" />
                  <span className="text-gray-700">"Run the login test suite on all browsers"</span>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-500 mt-1 flex-shrink-0" />
                  <span className="text-gray-700">"Schedule checkout tests to run every hour"</span>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-500 mt-1 flex-shrink-0" />
                  <span className="text-gray-700">"Tell me about today's test results"</span>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="bg-gradient-to-br from-purple-600 to-pink-600 rounded-3xl p-8 text-white">
                <div className="flex items-center space-x-4 mb-6">
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                    <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse"></div>
                  </div>
                  <div>
                    <div className="text-sm opacity-75">Voice Recording Active</div>
                    <div className="font-semibold">Listening for commands...</div>
                  </div>
                </div>
                <div className="bg-white/10 rounded-xl p-4 mb-4">
                  <p className="text-sm opacity-75 mb-2">You said:</p>
                  <p className="font-medium">"Test the checkout flow with valid payment methods"</p>
                </div>
                <div className="bg-white/10 rounded-xl p-4">
                  <p className="text-sm opacity-75 mb-2">AI Generated:</p>
                  <p className="font-medium">✅ 12 test steps created</p>
                  <p className="font-medium">⚡ Executing across 3 browsers</p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* AI-Powered Generation */}
          <div className="grid lg:grid-cols-2 gap-16 items-center mb-20">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="lg:order-2 space-y-6"
            >
              <div className="flex items-center space-x-3 mb-4">
                <div className="bg-gradient-to-r from-blue-500 to-cyan-500 p-3 rounded-xl">
                  <Brain className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-3xl font-bold text-gray-900">AI Test Generation</h3>
              </div>
              <p className="text-lg text-gray-600 leading-relaxed">
                Upload your code and watch AI analyze it to generate comprehensive unit tests, integration tests, 
                and performance benchmarks. Supports TypeScript, Python, Java, C#, and more.
              </p>
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-500 mt-1 flex-shrink-0" />
                  <span className="text-gray-700">Intelligent code analysis with AST parsing</span>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-500 mt-1 flex-shrink-0" />
                  <span className="text-gray-700">Auto-generated mocks and test data</span>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-500 mt-1 flex-shrink-0" />
                  <span className="text-gray-700">Edge case detection and testing</span>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="lg:order-1"
            >
              <div className="bg-gradient-to-br from-blue-600 to-cyan-600 rounded-3xl p-8 text-white">
                <div className="mb-6">
                  <Code className="w-12 h-12 mb-4" />
                  <h4 className="text-xl font-semibold mb-2">UserService.ts</h4>
                  <div className="text-sm opacity-75">Analyzing code structure...</div>
                </div>
                <div className="space-y-3">
                  <div className="bg-white/10 rounded-lg p-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Classes Found</span>
                      <span className="font-bold">3</span>
                    </div>
                  </div>
                  <div className="bg-white/10 rounded-lg p-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Methods Analyzed</span>
                      <span className="font-bold">18</span>
                    </div>
                  </div>
                  <div className="bg-white/10 rounded-lg p-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Tests Generated</span>
                      <span className="font-bold text-green-300">47</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Security Testing */}
          <div className="grid lg:grid-cols-2 gap-16 items-center mb-20">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="space-y-6"
            >
              <div className="flex items-center space-x-3 mb-4">
                <div className="bg-gradient-to-r from-red-500 to-orange-500 p-3 rounded-xl">
                  <Shield className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-3xl font-bold text-gray-900">AI Security Testing</h3>
              </div>
              <p className="text-lg text-gray-600 leading-relaxed">
                Revolutionary AI-powered penetration testing that identifies vulnerabilities, generates ethical 
                test payloads, and provides actionable security recommendations—all while maintaining strict ethical boundaries.
              </p>
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-500 mt-1 flex-shrink-0" />
                  <span className="text-gray-700">Complete OWASP Top 10 vulnerability scanning</span>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-500 mt-1 flex-shrink-0" />
                  <span className="text-gray-700">Intelligent payload generation and testing</span>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-500 mt-1 flex-shrink-0" />
                  <span className="text-gray-700">Voice-controlled security assessments</span>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <div className="bg-gradient-to-br from-red-600 to-orange-600 rounded-3xl p-8 text-white">
                <div className="mb-6">
                  <div className="flex items-center space-x-3">
                    <Shield className="w-8 h-8" />
                    <div>
                      <h4 className="text-xl font-semibold">Security Assessment</h4>
                      <div className="text-sm opacity-75">example.com</div>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="bg-white/10 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm">Critical Vulnerabilities</span>
                      <span className="bg-red-500 text-white px-2 py-1 rounded text-xs font-bold">2</span>
                    </div>
                    <div className="text-xs opacity-75">SQL Injection, XSS</div>
                  </div>
                  <div className="bg-white/10 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm">Security Score</span>
                      <span className="text-yellow-300 font-bold">6.2/10</span>
                    </div>
                    <div className="text-xs opacity-75">Needs immediate attention</div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Performance Testing */}
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="lg:order-2 space-y-6"
            >
              <div className="flex items-center space-x-3 mb-4">
                <div className="bg-gradient-to-r from-green-500 to-emerald-500 p-3 rounded-xl">
                  <Zap className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-3xl font-bold text-gray-900">Performance Testing</h3>
              </div>
              <p className="text-lg text-gray-600 leading-relaxed">
                Intelligent performance testing that scales from 10 to 10,000+ virtual users across global regions. 
                AI analyzes bottlenecks and provides optimization recommendations in real-time.
              </p>
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-500 mt-1 flex-shrink-0" />
                  <span className="text-gray-700">Multi-region load testing with AI scenarios</span>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-500 mt-1 flex-shrink-0" />
                  <span className="text-gray-700">Real-time performance analytics and alerts</span>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-500 mt-1 flex-shrink-0" />
                  <span className="text-gray-700">Intelligent bottleneck detection and optimization</span>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="lg:order-1"
            >
              <div className="bg-gradient-to-br from-green-600 to-emerald-600 rounded-3xl p-8 text-white">
                <div className="mb-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Zap className="w-8 h-8" />
                      <div>
                        <h4 className="text-xl font-semibold">Load Test</h4>
                        <div className="text-sm opacity-75">1,000 virtual users</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">2.3s</div>
                      <div className="text-xs opacity-75">Avg Response</div>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/10 rounded-lg p-3 text-center">
                    <div className="text-lg font-bold">98.7%</div>
                    <div className="text-xs opacity-75">Success Rate</div>
                  </div>
                  <div className="bg-white/10 rounded-lg p-3 text-center">
                    <div className="text-lg font-bold">420</div>
                    <div className="text-xs opacity-75">RPS</div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Trusted by Development Teams Worldwide
            </h2>
            <p className="text-xl text-gray-400">
              Join thousands of teams using Questro to revolutionize their testing
            </p>
          </motion.div>

          <motion.div
            variants={staggerChildren}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            className="grid grid-cols-2 md:grid-cols-4 gap-8"
          >
            {[
              { number: '10M+', label: 'Tests Executed', icon: CheckCircle },
              { number: '50K+', label: 'Vulnerabilities Found', icon: Shield },
              { number: '1M+', label: 'Voice Commands', icon: Mic },
              { number: '99.9%', label: 'Uptime SLA', icon: Award }
            ].map((stat, index) => (
              <motion.div
                key={index}
                variants={fadeInUp}
                className="text-center"
              >
                <stat.icon className="w-12 h-12 mx-auto mb-4 text-cyan-400" />
                <div className="text-3xl md:text-4xl font-bold mb-2">{stat.number}</div>
                <div className="text-gray-400">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              What Teams Are Saying
            </h2>
            <p className="text-xl text-gray-600">
              See how Questro transforms testing workflows
            </p>
          </motion.div>

          <motion.div
            variants={staggerChildren}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            className="grid md:grid-cols-3 gap-8"
          >
            {[
              {
                quote: "Voice testing is a game changer. I can create and run tests while reviewing code - it's incredibly efficient.",
                author: "Sarah Chen",
                role: "Senior QA Engineer at TechCorp",
                rating: 5
              },
              {
                quote: "The AI security testing found vulnerabilities our team missed. It's like having a security expert on demand.",
                author: "Marcus Rodriguez", 
                role: "DevOps Lead at StartupCo",
                rating: 5
              },
              {
                quote: "Performance testing that actually scales. We went from 100 to 5000 users seamlessly with intelligent insights.",
                author: "Jennifer Wu",
                role: "CTO at GrowthLabs",
                rating: 5
              }
            ].map((testimonial, index) => (
              <motion.div
                key={index}
                variants={fadeInUp}
                className="bg-gray-50 rounded-2xl p-8"
              >
                <div className="flex mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                  ))}
                </div>
                <blockquote className="text-gray-700 mb-6 leading-relaxed">
                  "{testimonial.quote}"
                </blockquote>
                <div>
                  <div className="font-semibold text-gray-900">{testimonial.author}</div>
                  <div className="text-gray-600 text-sm">{testimonial.role}</div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-purple-600 to-blue-600 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-5xl font-bold mb-6">
              Ready to Transform Your Testing?
            </h2>
            <p className="text-xl mb-8 opacity-90">
              Join the testing revolution. Start with voice commands, scale with AI intelligence.
            </p>
            <div className="flex flex-col sm:flex-row gap-6 justify-center">
              <button className="bg-white text-purple-600 hover:bg-gray-100 px-8 py-4 rounded-xl font-semibold text-lg transition-all transform hover:scale-105">
                Start Free Trial
              </button>
              <button className="border-2 border-white hover:bg-white hover:text-purple-600 px-8 py-4 rounded-xl font-semibold text-lg transition-all">
                Book Demo
              </button>
            </div>
            <p className="text-sm mt-6 opacity-75">
              Free forever plan available • No credit card required • 5-minute setup
            </p>
          </motion.div>
        </div>
      </section>
    </div>
  );
}