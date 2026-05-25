import React from 'react';
import { motion } from 'framer-motion';
import { 
  Zap, 
  TrendingUp, 
  CheckCircle, 
  ArrowRight, 
  BarChart3,
  Globe,
  Users,
  Timer,
  Target,
  Brain,
  Activity
} from 'lucide-react';
import { useSEO } from '../hooks/useSEO';

export default function PerformanceTestingLandingPage() {
  useSEO({
    title: 'AI Performance Testing & Load Testing | Intelligent Scalability Testing',
    description: 'Revolutionary AI-powered performance testing platform. Intelligent load testing with AI-generated scenarios, real-time bottleneck detection, and multi-region testing. Scale from 10 to 10,000+ virtual users.',
    keywords: 'performance testing, load testing, AI performance testing, scalability testing, stress testing, load testing tools, performance optimization, AI load testing',
    canonical: 'https://questro.io/performance-testing'
  });

  const performanceFeatures = [
    {
      icon: Globe,
      title: "Multi-Region Load Testing",
      description: "Deploy virtual users across global regions to test real-world performance scenarios"
    },
    {
      icon: Brain,
      title: "AI-Generated Test Scenarios",
      description: "Intelligent user behavior simulation based on your application patterns and analytics"
    },
    {
      icon: Activity,
      title: "Real-time Performance Monitoring",
      description: "Live metrics, alerts, and intelligent bottleneck detection as tests run"
    },
    {
      icon: Target,
      title: "Intelligent Bottleneck Detection",
      description: "AI analyzes performance data to identify and prioritize optimization opportunities"
    }
  ];

  const testTypes = [
    {
      name: "Load Testing",
      description: "Simulate normal expected load to ensure application stability",
      icon: Users,
      users: "10-1,000",
      color: "blue"
    },
    {
      name: "Stress Testing",
      description: "Push beyond normal capacity to find breaking points",
      icon: TrendingUp,
      users: "1,000-5,000",
      color: "orange"
    },
    {
      name: "Spike Testing",
      description: "Test sudden traffic surges and rapid scaling scenarios",
      icon: Zap,
      users: "Instant scaling",
      color: "purple"
    },
    {
      name: "Endurance Testing",
      description: "Long-running tests to identify memory leaks and degradation",
      icon: Timer,
      users: "Hours/Days",
      color: "green"
    }
  ];

  const metrics = [
    { label: "Response Time", value: "2.3s", change: "-15%", status: "good" },
    { label: "Throughput", value: "420 RPS", change: "+25%", status: "good" },
    { label: "Error Rate", value: "0.1%", change: "-50%", status: "good" },
    { label: "Active Users", value: "1,000", change: "Target", status: "neutral" }
  ];

  const voiceCommands = [
    "Run a load test with 500 users for 10 minutes",
    "Stress test the checkout flow with gradually increasing load",
    "Tell me about the performance bottlenecks found",
    "Schedule endurance tests to run every night"
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-green-900 via-blue-900 to-purple-900 text-white py-24">
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
                <Zap className="w-4 h-4 mr-2" />
                ⚡ AI-Powered Performance Testing Platform
              </div>
            </motion.div>
            
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold leading-tight mb-6">
              <span className="block">Intelligent</span>
              <span className="block bg-gradient-to-r from-green-400 to-blue-400 bg-clip-text text-transparent">
                Performance Testing
              </span>
            </h1>
            
            <p className="text-xl lg:text-2xl text-gray-300 max-w-4xl mx-auto mb-12 leading-relaxed">
              Scale from 10 to 10,000+ virtual users with AI-generated scenarios. 
              Real-time bottleneck detection, multi-region testing, and intelligent performance optimization recommendations.
            </p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="flex flex-col sm:flex-row gap-6 justify-center items-center mb-16"
            >
              <button className="group bg-gradient-to-r from-green-500 to-blue-600 hover:from-green-600 hover:to-blue-700 px-8 py-4 rounded-xl font-semibold text-lg transition-all transform hover:scale-105 hover:shadow-2xl">
                Start Load Test
                <ArrowRight className="inline-block w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </button>
              <button className="group border-2 border-white/30 hover:border-white/50 px-8 py-4 rounded-xl font-semibold text-lg backdrop-blur-sm hover:bg-white/10 transition-all">
                <BarChart3 className="inline-block w-5 h-5 mr-2" />
                View Performance Demo
              </button>
            </motion.div>

            {/* Live Performance Dashboard */}
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="max-w-5xl mx-auto"
            >
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-4">
                    <BarChart3 className="w-8 h-8 text-green-400" />
                    <div>
                      <h3 className="text-xl font-semibold">Live Performance Test</h3>
                      <p className="text-green-200">1,000 virtual users across 3 regions</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-green-300">98.7%</div>
                    <div className="text-sm text-green-200">Success Rate</div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {metrics.map((metric, index) => (
                    <div key={index} className="bg-white/10 rounded-lg p-4">
                      <div className="text-sm text-gray-300 mb-1">{metric.label}</div>
                      <div className="text-lg font-bold text-white">{metric.value}</div>
                      <div className={`text-xs ${
                        metric.status === 'good' ? 'text-green-300' : 
                        metric.status === 'warning' ? 'text-yellow-300' : 
                        'text-gray-300'
                      }`}>
                        {metric.change}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 p-4 bg-green-500/20 rounded-lg border border-green-500/30">
                  <div className="flex items-center space-x-2 mb-2">
                    <Brain className="w-5 h-5 text-green-400" />
                    <span className="font-semibold text-green-400">AI Insight</span>
                  </div>
                  <p className="text-sm text-green-200">
                    Database connection pool optimization could improve response time by 23%. 
                    Recommend increasing pool size to 150 connections.
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Test Types */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-5xl font-bold text-gray-900 mb-6">
              Comprehensive Performance Testing Types
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              From basic load testing to complex endurance scenarios, all powered by intelligent AI
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {testTypes.map((test, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all"
              >
                <div className={`bg-gradient-to-r ${
                  test.color === 'blue' ? 'from-blue-500 to-cyan-500' :
                  test.color === 'orange' ? 'from-orange-500 to-red-500' :
                  test.color === 'purple' ? 'from-purple-500 to-pink-500' :
                  'from-green-500 to-emerald-500'
                } p-3 rounded-xl w-fit mb-4`}>
                  <test.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-semibold text-gray-900 text-lg mb-2">{test.name}</h3>
                <p className="text-gray-600 text-sm mb-4">{test.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Scale:</span>
                  <span className={`text-xs font-bold ${
                    test.color === 'blue' ? 'text-blue-600' :
                    test.color === 'orange' ? 'text-orange-600' :
                    test.color === 'purple' ? 'text-purple-600' :
                    'text-green-600'
                  }`}>
                    {test.users}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Performance Features */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
              Intelligent Performance Testing Features
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              AI-powered testing that adapts to your application and provides actionable insights
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-12 items-center">
            {performanceFeatures.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: index % 2 === 0 ? -50 : 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.2 }}
                className={`flex items-start space-x-4 ${index % 2 === 1 ? 'md:flex-row-reverse md:space-x-reverse md:text-right' : ''}`}
              >
                <div className={`bg-gradient-to-r from-green-500 to-blue-500 p-4 rounded-2xl ${index % 2 === 1 ? 'md:order-2' : ''}`}>
                  <feature.icon className="w-8 h-8 text-white" />
                </div>
                <div className={`flex-1 ${index % 2 === 1 ? 'md:order-1' : ''}`}>
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">{feature.title}</h3>
                  <p className="text-gray-600 text-lg">{feature.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Voice Commands for Performance */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
                Voice-Controlled Performance Testing
              </h2>
              <p className="text-xl text-gray-600 mb-8">
                Start load tests, scale virtual users, and get performance insights using natural language commands.
              </p>
              
              <div className="space-y-4">
                {voiceCommands.map((command, index) => (
                  <div key={index} className="bg-white rounded-lg p-4 border-l-4 border-green-500">
                    <p className="font-mono text-green-600">"{command}"</p>
                  </div>
                ))}
              </div>

              <div className="mt-8 p-6 bg-blue-50 rounded-xl">
                <h4 className="font-semibold text-blue-900 mb-2">Pro Tip</h4>
                <p className="text-blue-700">
                  Combine voice commands with AI scenarios: "Run a Black Friday simulation with 2000 users focusing on checkout flow"
                </p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="bg-gradient-to-br from-green-600 to-blue-600 rounded-3xl p-8 text-white">
                <div className="flex items-center space-x-4 mb-6">
                  <TrendingUp className="w-8 h-8" />
                  <div>
                    <h3 className="text-xl font-semibold">Performance Analytics</h3>
                    <p className="text-green-200">AI-Powered Insights Engine</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm">Bottleneck Detection</span>
                      <span className="text-yellow-300 font-bold">Real-time</span>
                    </div>
                    <div className="text-xs text-green-200">AI identifies 15+ performance patterns</div>
                  </div>
                  
                  <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm">Optimization Recommendations</span>
                      <span className="text-blue-300 font-bold">Automated</span>
                    </div>
                    <div className="text-xs text-green-200">Intelligent suggestions for improvement</div>
                  </div>
                  
                  <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm">Scalability Prediction</span>
                      <span className="text-purple-300 font-bold">ML-Based</span>
                    </div>
                    <div className="text-xs text-green-200">Predict performance at different scales</div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Scalability Showcase */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
              Infinite Scalability
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              From startup to enterprise scale, test with confidence at any load level
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-8"
            >
              <div className="text-4xl font-bold text-blue-600 mb-2">10</div>
              <div className="text-lg font-semibold text-blue-800 mb-2">Virtual Users</div>
              <div className="text-blue-600">Perfect for development testing</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-center bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-8"
            >
              <div className="text-4xl font-bold text-purple-600 mb-2">1,000</div>
              <div className="text-lg font-semibold text-purple-800 mb-2">Virtual Users</div>
              <div className="text-purple-600">Production load simulation</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="text-center bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-8"
            >
              <div className="text-4xl font-bold text-green-600 mb-2">10,000+</div>
              <div className="text-lg font-semibold text-green-800 mb-2">Virtual Users</div>
              <div className="text-green-600">Enterprise stress testing</div>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-12 text-center"
          >
            <div className="bg-gradient-to-r from-green-500 to-blue-500 text-white rounded-2xl p-8 max-w-2xl mx-auto">
              <h3 className="text-2xl font-bold mb-4">Auto-Scaling Infrastructure</h3>
              <p className="text-lg opacity-90">
                Our intelligent infrastructure automatically scales to match your testing needs, 
                deploying virtual users across multiple regions for realistic load distribution.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-green-600 to-blue-600 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Test Performance at Any Scale
            </h2>
            <p className="text-xl mb-8 opacity-90">
              Start with 10 virtual users and scale to thousands. 
              AI-powered insights help you optimize before you launch.
            </p>
            <div className="flex flex-col sm:flex-row gap-6 justify-center">
              <button className="bg-white text-green-600 hover:bg-gray-100 px-8 py-4 rounded-xl font-semibold text-lg transition-all transform hover:scale-105 flex items-center justify-center">
                Start Load Test
                <Zap className="w-5 h-5 ml-2" />
              </button>
              <button className="border-2 border-white hover:bg-white hover:text-green-600 px-8 py-4 rounded-xl font-semibold text-lg transition-all">
                Schedule Performance Demo
              </button>
            </div>
            <p className="text-sm mt-6 opacity-75">
              Free performance testing included • Scale as needed • Multi-region support
            </p>
          </motion.div>
        </div>
      </section>
    </div>
  );
}