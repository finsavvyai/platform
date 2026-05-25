import React from 'react';
import { motion } from 'framer-motion';
import { 
  Mic, 
  Play, 
  CheckCircle, 
  ArrowRight, 
  Volume2,
  Waveform,
  Command,
  Clock,
  Globe,
  Shield
} from 'lucide-react';
import { useSEO } from '../hooks/useSEO';

export default function VoiceTestingLandingPage() {
  useSEO({
    title: 'Voice-Controlled Testing | Revolutionary Voice Commands for Test Automation',
    description: 'Experience the world\'s first voice-controlled testing platform. Create, execute, and manage tests using natural language commands. "Run the checkout tests on all browsers" - it\'s that simple.',
    keywords: 'voice testing, voice controlled testing, speech to test, natural language testing, voice commands testing, spoken test automation, voice QA, hands-free testing',
    canonical: 'https://questro.io/voice-testing'
  });

  const fadeInUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6 }
  };

  const voiceCommands = [
    {
      command: "Run the login test suite on all browsers",
      description: "Execute comprehensive login testing across Chrome, Firefox, Safari, and Edge",
      time: "2 minutes"
    },
    {
      command: "Schedule checkout tests to run every hour",
      description: "Set up automated recurring tests for critical payment flows",
      time: "30 seconds"
    },
    {
      command: "Tell me about today's test results",
      description: "Get a spoken summary of all test executions, failures, and performance metrics",
      time: "1 minute"
    },
    {
      command: "Scan my API for security vulnerabilities",
      description: "Initiate comprehensive security testing with voice commands",
      time: "5 minutes"
    }
  ];

  const benefits = [
    {
      icon: Clock,
      title: "10x Faster Test Creation",
      description: "Create complex test scenarios in seconds using natural language instead of writing code"
    },
    {
      icon: Volume2,
      title: "Hands-Free Operation",
      description: "Continue coding while managing tests through voice commands - perfect for multitasking"
    },
    {
      icon: Globe,
      title: "Multi-Language Support",
      description: "Voice commands work in English, Spanish, French, German, and more languages"
    },
    {
      icon: Shield,
      title: "Intelligent Understanding",
      description: "AI understands context, intent, and technical nuances in your voice commands"
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white py-24">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
              <div className="inline-flex items-center px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-sm font-medium">
                <Mic className="w-4 h-4 mr-2" />
                🚀 World's First Voice-Controlled Testing Platform
              </div>
            </motion.div>
            
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold leading-tight mb-6">
              <span className="block">Test with Your</span>
              <span className="block bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                Voice Commands
              </span>
            </h1>
            
            <p className="text-xl lg:text-2xl text-gray-300 max-w-4xl mx-auto mb-12 leading-relaxed">
              Revolutionize your testing workflow with natural language commands. 
              Simply speak your test scenarios and watch as AI creates, executes, and reports on your tests.
            </p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="flex flex-col sm:flex-row gap-6 justify-center items-center mb-16"
            >
              <button className="group bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700 px-8 py-4 rounded-xl font-semibold text-lg transition-all transform hover:scale-105 hover:shadow-2xl">
                Try Voice Testing Free
                <ArrowRight className="inline-block w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </button>
              <button className="group border-2 border-white/30 hover:border-white/50 px-8 py-4 rounded-xl font-semibold text-lg backdrop-blur-sm hover:bg-white/10 transition-all">
                <Play className="inline-block w-5 h-5 mr-2" />
                Watch Voice Demo
              </button>
            </motion.div>

            {/* Interactive Voice Demo */}
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="max-w-4xl mx-auto"
            >
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
                <div className="flex items-center space-x-4 mb-6">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                      <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse"></div>
                    </div>
                    <div>
                      <div className="text-sm opacity-75">Voice Recording Active</div>
                      <div className="font-semibold">Listening for commands...</div>
                    </div>
                  </div>
                  <Waveform className="w-8 h-8 text-cyan-400 animate-pulse" />
                </div>
                
                <div className="space-y-4">
                  <div className="bg-white/10 rounded-xl p-4">
                    <p className="text-sm opacity-75 mb-2">You said:</p>
                    <p className="font-medium text-lg">"Run the checkout flow tests on Chrome and Firefox"</p>
                  </div>
                  <div className="bg-white/10 rounded-xl p-4">
                    <p className="text-sm opacity-75 mb-2">AI Response:</p>
                    <div className="space-y-2">
                      <p className="font-medium text-green-300">✅ Understood: Checkout flow testing</p>
                      <p className="font-medium text-blue-300">🌐 Browsers: Chrome, Firefox</p>
                      <p className="font-medium text-purple-300">⚡ Executing 15 test steps across 2 browsers</p>
                      <p className="font-medium text-yellow-300">📊 ETA: 3 minutes</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Voice Commands Showcase */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-5xl font-bold text-gray-900 mb-6">
              Powerful Voice Commands
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Control your entire testing workflow with natural language commands
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8">
            {voiceCommands.map((cmd, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all"
              >
                <div className="flex items-start space-x-4">
                  <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-3 rounded-xl">
                    <Command className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="bg-gray-100 rounded-lg p-4 mb-4">
                      <p className="font-mono text-purple-600 font-medium">"{cmd.command}"</p>
                    </div>
                    <p className="text-gray-600 mb-3">{cmd.description}</p>
                    <div className="flex items-center text-sm text-gray-500">
                      <Clock className="w-4 h-4 mr-1" />
                      <span>Execution time: {cmd.time}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
              Why Voice-Controlled Testing?
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Experience unprecedented efficiency and natural interaction with your testing tools
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {benefits.map((benefit, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="text-center"
              >
                <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-4 rounded-2xl w-fit mx-auto mb-6">
                  <benefit.icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{benefit.title}</h3>
                <p className="text-gray-600">{benefit.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Technical Features */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
                Advanced Voice AI Technology
              </h2>
              <p className="text-xl text-gray-600 mb-8">
                Powered by cutting-edge speech recognition and natural language processing, 
                our voice AI understands context, intent, and technical terminology.
              </p>
              
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-6 h-6 text-green-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-gray-900">Real-time Speech Processing</h4>
                    <p className="text-gray-600">Instant command recognition with 99.5% accuracy</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-6 h-6 text-green-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-gray-900">Context-Aware Intelligence</h4>
                    <p className="text-gray-600">Understands test context and project-specific terminology</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-6 h-6 text-green-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-gray-900">Natural Language to Code</h4>
                    <p className="text-gray-600">Converts speech directly into executable test scripts</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-6 h-6 text-green-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-gray-900">Voice Feedback & Reporting</h4>
                    <p className="text-gray-600">Spoken summaries of test results and recommendations</p>
                  </div>
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
                  <Mic className="w-8 h-8" />
                  <div>
                    <h3 className="text-xl font-semibold">Voice Processing Engine</h3>
                    <p className="text-purple-200">Advanced AI Language Model</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm">Speech Recognition</span>
                      <span className="text-green-300 font-bold">99.5%</span>
                    </div>
                    <div className="w-full bg-white/20 rounded-full h-2">
                      <div className="bg-green-400 h-2 rounded-full" style={{width: '99.5%'}}></div>
                    </div>
                  </div>
                  
                  <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm">Intent Understanding</span>
                      <span className="text-blue-300 font-bold">97.8%</span>
                    </div>
                    <div className="w-full bg-white/20 rounded-full h-2">
                      <div className="bg-blue-400 h-2 rounded-full" style={{width: '97.8%'}}></div>
                    </div>
                  </div>
                  
                  <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm">Command Execution</span>
                      <span className="text-yellow-300 font-bold">&lt; 2s</span>
                    </div>
                    <div className="text-xs text-purple-200">Average response time</div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
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
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Ready to Test with Your Voice?
            </h2>
            <p className="text-xl mb-8 opacity-90">
              Join thousands of teams already using voice commands to revolutionize their testing workflow.
            </p>
            <div className="flex flex-col sm:flex-row gap-6 justify-center">
              <button className="bg-white text-purple-600 hover:bg-gray-100 px-8 py-4 rounded-xl font-semibold text-lg transition-all transform hover:scale-105 flex items-center justify-center">
                Start Voice Testing Free
                <Mic className="w-5 h-5 ml-2" />
              </button>
              <button className="border-2 border-white hover:bg-white hover:text-purple-600 px-8 py-4 rounded-xl font-semibold text-lg transition-all">
                Schedule Demo
              </button>
            </div>
            <p className="text-sm mt-6 opacity-75">
              No credit card required • Works with all testing frameworks • 14-day free trial
            </p>
          </motion.div>
        </div>
      </section>
    </div>
  );
}