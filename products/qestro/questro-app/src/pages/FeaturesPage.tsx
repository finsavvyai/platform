import React from 'react';
import { motion } from 'framer-motion';
import { 
  Mic, 
  Brain, 
  Shield, 
  Zap, 
  Code2, 
  Globe, 
  BarChart3,
  CheckCircle,
  ArrowRight,
  Smartphone,
  Monitor,
  Cloud,
  Lock,
  TrendingUp,
  Users,
  Clock,
  Target
} from 'lucide-react';
import { useSEO } from '../hooks/useSEO';

export default function FeaturesPage() {
  useSEO({
    title: 'Revolutionary Testing Features - Voice, AI, Security & Performance',
    description: 'Explore Questro\'s comprehensive testing features: voice-controlled test creation, AI-powered generation, security scanning, performance testing, and intelligent analytics.',
    keywords: 'testing features, voice testing, AI testing, security testing, performance testing, test automation features',
    canonical: 'https://questro.io/features'
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

  const mainFeatures = [
    {
      icon: Mic,
      title: 'Voice-Controlled Testing',
      description: 'Revolutionary voice interface for natural test creation and execution',
      gradient: 'from-purple-500 to-pink-500',
      features: [
        'Natural language test creation',
        'Voice test execution and scheduling',
        'Spoken test result summaries',
        'Multi-language voice support',
        'Voice command macros',
        'Real-time voice feedback'
      ],
      demo: '"Run the checkout tests on all browsers and tell me the results"'
    },
    {
      icon: Brain,
      title: 'AI Test Generation',
      description: 'Intelligent test creation from code analysis and natural language',
      gradient: 'from-blue-500 to-cyan-500',
      features: [
        'Code-to-test AI generation',
        'Multi-language support (TS, Python, Java, C#)',
        'Intelligent mock generation',
        'Edge case detection',
        'Test data generation',
        'Framework-specific outputs'
      ],
      demo: 'Upload UserService.ts → Get 47 comprehensive unit tests'
    },
    {
      icon: Shield,
      title: 'AI Security Testing',
      description: 'Advanced penetration testing with ethical AI-powered vulnerability detection',
      gradient: 'from-red-500 to-orange-500',
      features: [
        'OWASP Top 10 comprehensive scanning',
        'Intelligent payload generation',
        'Real-time vulnerability assessment',
        'Compliance testing (SOC 2, PCI DSS)',
        'Voice-controlled security scans',
        'Ethical boundary protection'
      ],
      demo: '"Scan my API for SQL injection vulnerabilities"'
    },
    {
      icon: Zap,
      title: 'Performance Testing',
      description: 'Scalable load testing with AI-powered scenario generation and analysis',
      gradient: 'from-green-500 to-emerald-500',
      features: [
        'Multi-region load testing',
        'AI-generated user scenarios',
        'Real-time performance monitoring',
        'Intelligent bottleneck detection',
        'Auto-scaling test infrastructure',
        'Voice performance reporting'
      ],
      demo: '10 → 10,000 virtual users with intelligent insights'
    }
  ];

  const additionalFeatures = [
    {
      icon: Code2,
      title: 'Code Analysis Engine',
      description: 'Deep AST parsing and intelligent code understanding',
      features: ['Multi-language AST parsing', 'Complexity analysis', 'Testability scoring', 'Quality recommendations']
    },
    {
      icon: Globe,
      title: 'Cross-Platform Testing',
      description: 'Unified testing across web, mobile, and API platforms',
      features: ['Web application testing', 'Mobile app testing (iOS/Android)', 'API testing', 'Cross-browser compatibility']
    },
    {
      icon: BarChart3,
      title: 'Intelligent Analytics',
      description: 'AI-powered insights and predictive testing analytics',
      features: ['Predictive failure analysis', 'Performance trending', 'Quality metrics', 'Team productivity insights']
    },
    {
      icon: Cloud,
      title: 'Cloud-Native Architecture',
      description: 'Scalable, reliable, and globally distributed testing infrastructure',
      features: ['Global test execution', 'Auto-scaling infrastructure', '99.9% uptime SLA', 'Enterprise security']
    },
    {
      icon: Users,
      title: 'Team Collaboration',
      description: 'Advanced collaboration features for modern development teams',
      features: ['Real-time collaboration', 'Voice-based communication', 'Shared test libraries', 'Role-based permissions']
    },
    {
      icon: Lock,
      title: 'Enterprise Security',
      description: 'Bank-grade security with comprehensive compliance support',
      features: ['SOC 2 Type II compliance', 'GDPR compliant', 'SSO integration', 'Audit logging']
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 text-white py-24">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center"
          >
            <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-6">
              Revolutionary Testing
              <span className="block bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                Features
              </span>
            </h1>
            <p className="text-xl lg:text-2xl text-gray-300 max-w-4xl mx-auto mb-12">
              Discover the comprehensive suite of AI-powered testing capabilities that make Questro 
              the most advanced testing platform ever created.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Main Features */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-5xl font-bold text-gray-900 mb-6">
              Core Testing Capabilities
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Four revolutionary pillars that transform how teams approach testing
            </p>
          </motion.div>

          <div className="space-y-32">
            {mainFeatures.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: index * 0.1 }}
                className={`grid lg:grid-cols-2 gap-16 items-center ${
                  index % 2 === 1 ? 'lg:grid-flow-col-dense' : ''
                }`}
              >
                <div className={`space-y-6 ${index % 2 === 1 ? 'lg:col-start-2' : ''}`}>
                  <div className="flex items-center space-x-4">
                    <div className={`bg-gradient-to-r ${feature.gradient} p-4 rounded-2xl`}>
                      <feature.icon className="w-10 h-10 text-white" />
                    </div>
                    <h3 className="text-3xl md:text-4xl font-bold text-gray-900">
                      {feature.title}
                    </h3>
                  </div>
                  
                  <p className="text-xl text-gray-600 leading-relaxed">
                    {feature.description}
                  </p>

                  <div className="space-y-4">
                    {feature.features.map((item, itemIndex) => (
                      <div key={itemIndex} className="flex items-start space-x-3">
                        <CheckCircle className="w-6 h-6 text-green-500 mt-0.5 flex-shrink-0" />
                        <span className="text-gray-700 text-lg">{item}</span>
                      </div>
                    ))}
                  </div>

                  <div className={`bg-gradient-to-r ${feature.gradient} bg-opacity-5 border border-gray-200 rounded-xl p-6`}>
                    <h4 className="font-semibold text-gray-900 mb-2">Example:</h4>
                    <p className="text-gray-700 italic">"{feature.demo}"</p>
                  </div>
                </div>

                <div className={`${index % 2 === 1 ? 'lg:col-start-1' : ''}`}>
                  <div className={`bg-gradient-to-br ${feature.gradient} rounded-3xl p-8 text-white shadow-2xl`}>
                    <div className="mb-8">
                      <feature.icon className="w-16 h-16 mb-4 opacity-90" />
                      <h4 className="text-2xl font-bold mb-2">{feature.title}</h4>
                      <p className="opacity-90">{feature.description}</p>
                    </div>
                    
                    <div className="space-y-4">
                      {feature.features.slice(0, 3).map((item, itemIndex) => (
                        <div key={itemIndex} className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                          <div className="flex items-center space-x-3">
                            <CheckCircle className="w-5 h-5 text-white/80" />
                            <span className="font-medium">{item}</span>
                          </div>
                        </div>
                      ))}
                      
                      {feature.features.length > 3 && (
                        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-center">
                          <span className="font-medium">+{feature.features.length - 3} more features</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Additional Features Grid */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
              Complete Testing Ecosystem
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Additional capabilities that make Questro a comprehensive testing solution
            </p>
          </motion.div>

          <motion.div
            variants={staggerChildren}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            {additionalFeatures.map((feature, index) => (
              <motion.div
                key={index}
                variants={fadeInUp}
                className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <div className="bg-gradient-to-r from-blue-500 to-purple-500 p-3 rounded-xl w-fit mb-6">
                  <feature.icon className="w-8 h-8 text-white" />
                </div>
                
                <h3 className="text-xl font-bold text-gray-900 mb-3">
                  {feature.title}
                </h3>
                
                <p className="text-gray-600 mb-6 leading-relaxed">
                  {feature.description}
                </p>

                <div className="space-y-3">
                  {feature.features.map((item, itemIndex) => (
                    <div key={itemIndex} className="flex items-start space-x-3">
                      <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700 text-sm">{item}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Platform Capabilities */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
              Platform Capabilities
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Built for scale, designed for teams, powered by AI
            </p>
          </motion.div>

          <div className="grid lg:grid-cols-3 gap-12">
            {/* Mobile & Web Testing */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center"
            >
              <div className="bg-gradient-to-r from-blue-500 to-cyan-500 p-6 rounded-3xl mb-6 mx-auto w-fit">
                <div className="flex items-center space-x-4">
                  <Smartphone className="w-12 h-12 text-white" />
                  <Monitor className="w-12 h-12 text-white" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                Universal Platform Support
              </h3>
              <p className="text-gray-600 mb-6">
                Test across web browsers, mobile devices, and APIs with a unified approach
              </p>
              <div className="space-y-2 text-left">
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="text-gray-700">Chrome, Firefox, Safari, Edge</span>
                </div>
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="text-gray-700">iOS and Android native apps</span>
                </div>
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="text-gray-700">REST and GraphQL APIs</span>
                </div>
              </div>
            </motion.div>

            {/* Scalability */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-center"
            >
              <div className="bg-gradient-to-r from-green-500 to-emerald-500 p-6 rounded-3xl mb-6 mx-auto w-fit">
                <TrendingUp className="w-16 h-16 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                Infinite Scalability
              </h3>
              <p className="text-gray-600 mb-6">
                From startup to enterprise, scale your testing with intelligent resource management
              </p>
              <div className="space-y-2 text-left">
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="text-gray-700">Auto-scaling infrastructure</span>
                </div>
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="text-gray-700">Global test execution</span>
                </div>
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="text-gray-700">Intelligent load balancing</span>
                </div>
              </div>
            </motion.div>

            {/* Real-time Intelligence */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="text-center"
            >
              <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-6 rounded-3xl mb-6 mx-auto w-fit">
                <Clock className="w-16 h-16 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                Real-time Intelligence
              </h3>
              <p className="text-gray-600 mb-6">
                AI-powered insights and recommendations delivered in real-time
              </p>
              <div className="space-y-2 text-left">
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="text-gray-700">Live test result streaming</span>
                </div>
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="text-gray-700">Predictive failure detection</span>
                </div>
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="text-gray-700">Intelligent recommendations</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Experience the Future of Testing
            </h2>
            <p className="text-xl mb-8 opacity-90">
              Try all features free for 14 days. No credit card required.
            </p>
            <div className="flex flex-col sm:flex-row gap-6 justify-center">
              <button className="bg-white text-indigo-600 hover:bg-gray-100 px-8 py-4 rounded-xl font-semibold text-lg transition-all transform hover:scale-105 flex items-center justify-center">
                Start Free Trial
                <ArrowRight className="w-5 h-5 ml-2" />
              </button>
              <button className="border-2 border-white hover:bg-white hover:text-indigo-600 px-8 py-4 rounded-xl font-semibold text-lg transition-all">
                View Demo
              </button>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}