'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Brain,
  Zap,
  Activity,
  Globe,
  Users,
  TrendingUp,
  Play,
  ArrowRight,
  Cpu,
  Network,
  Sparkles
} from 'lucide-react'

import { Button } from '@mcpoverflow/ui'
import { ThreeVisualization } from '@/components/three-visualization'
import { AgentMetrics } from '@/components/agent-metrics'
import { FeatureShowcase } from '@/components/feature-showcase'

export default function HomePage() {
  const [activeMetric, setActiveMetric] = useState(0)
  const [scrollY, setScrollY] = useState(0)

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveMetric((prev) => (prev + 1) % 4)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  const metrics = [
    { label: 'Active Agents', value: '2,847', change: '+12%', icon: Cpu },
    { label: 'API Calls Today', value: '1.2M', change: '+24%', icon: Zap },
    { label: 'Uptime', value: '99.97%', change: '+0.2%', icon: Activity },
    { label: 'Global Regions', value: '24', change: '+4', icon: Globe },
  ]

  const features = [
    {
      icon: Brain,
      title: 'Intelligent Agent Management',
      description: 'Deploy, monitor, and manage AI agents with advanced orchestration capabilities.',
      color: 'from-blue-500 to-purple-600'
    },
    {
      icon: Network,
      title: 'Real-time Visualization',
      description: '3D visualizations and interactive graphs showing agent behavior and performance.',
      color: 'from-purple-500 to-pink-600'
    },
    {
      icon: TrendingUp,
      title: 'Advanced Analytics',
      description: 'Comprehensive metrics, performance tracking, and predictive insights.',
      color: 'from-pink-500 to-red-600'
    },
    {
      icon: Users,
      title: 'Collaborative Workflows',
      description: 'Team-based agent management with role-based access control.',
      color: 'from-red-500 to-orange-600'
    }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
      {/* Navigation Header */}
      <header className="fixed top-0 w-full z-50 glass-effect border-b border-white/10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Brain className="h-8 w-8 text-purple-400" />
              <span className="text-xl font-bold">MCPOverflow AI</span>
            </div>
            <nav className="hidden md:flex items-center space-x-8">
              <Link href="/dashboard" className="hover:text-purple-400 transition-colors">
                Dashboard
              </Link>
              <Link href="/agents" className="hover:text-purple-400 transition-colors">
                Agents
              </Link>
              <Link href="/analytics" className="hover:text-purple-400 transition-colors">
                Analytics
              </Link>
              <Link href="/docs" className="hover:text-purple-400 transition-colors">
                Documentation
              </Link>
            </nav>
            <Button className="bg-purple-600 hover:bg-purple-700">
              Get Started <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          <ThreeVisualization />
        </div>

        <div className="relative z-10 container mx-auto px-4 pt-20">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center space-x-2 bg-purple-500/20 rounded-full px-4 py-2 mb-8 border border-purple-500/30">
              <Sparkles className="h-4 w-4 text-purple-300" />
              <span className="text-purple-200 text-sm">Powered by Advanced AI</span>
            </div>

            <h1 className="text-6xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-white via-purple-200 to-pink-200 bg-clip-text text-transparent">
              Intelligent Agent Management Platform
            </h1>

            <p className="text-xl md:text-2xl text-purple-100 mb-8 max-w-2xl mx-auto leading-relaxed">
              Deploy, monitor, and manage AI agents with real-time 3D visualizations,
              advanced analytics, and collaborative workflows powered by MCPOverflow.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Button size="lg" className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-4 text-lg">
                <Play className="mr-2 h-5 w-5" />
                Start Free Trial
              </Button>
              <Button size="lg" variant="outline" className="border-purple-400 text-purple-200 hover:bg-purple-800/20 px-8 py-4 text-lg">
                View Demo
              </Button>
            </div>

            {/* Live Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
              {metrics.map((metric, index) => (
                <div
                  key={index}
                  className={`glass-effect rounded-lg p-4 border transition-all duration-500 ${
                    activeMetric === index
                      ? 'border-purple-400 bg-purple-500/20 scale-105'
                      : 'border-white/10 bg-white/5'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <metric.icon className="h-5 w-5 text-purple-300" />
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      metric.change.startsWith('+')
                        ? 'bg-green-500/20 text-green-300'
                        : 'bg-red-500/20 text-red-300'
                    }`}>
                      {metric.change}
                    </span>
                  </div>
                  <div className="text-2xl font-bold text-white">{metric.value}</div>
                  <div className="text-sm text-purple-200">{metric.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 text-purple-300 animate-bounce">
          <div className="flex flex-col items-center">
            <span className="text-sm mb-2">Scroll to explore</span>
            <div className="w-6 h-10 border-2 border-purple-300 rounded-full flex justify-center">
              <div className="w-1 h-3 bg-purple-300 rounded-full mt-2 animate-pulse"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 relative">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-purple-200 to-pink-200 bg-clip-text text-transparent">
              Powerful Features for AI Management
            </h2>
            <p className="text-xl text-purple-100 max-w-2xl mx-auto">
              Everything you need to build, deploy, and manage intelligent AI agents at scale.
            </p>
          </div>

          <FeatureShowcase features={features} />
        </div>
      </section>

      {/* Interactive Analytics Section */}
      <section className="py-20 relative bg-black/20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-blue-200 to-purple-200 bg-clip-text text-transparent">
              Real-time Agent Analytics
            </h2>
            <p className="text-xl text-purple-100 max-w-2xl mx-auto">
              Monitor agent performance, track metrics, and optimize workflows with live data visualization.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="glass-effect rounded-xl p-6 border border-white/10">
              <h3 className="text-2xl font-semibold mb-4">Performance Metrics</h3>
              <AgentMetrics />
            </div>

            <div className="glass-effect rounded-xl p-6 border border-white/10">
              <h3 className="text-2xl font-semibold mb-4">Agent Activity</h3>
              <div className="h-64 flex items-center justify-center">
                <div className="text-center">
                  <Activity className="h-16 w-16 text-purple-400 mx-auto mb-4" />
                  <p className="text-purple-200">Interactive activity graph</p>
                  <p className="text-sm text-purple-300 mt-2">
                    Real-time agent interactions and system load
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 relative">
        <div className="container mx-auto px-4">
          <div className="glass-effect rounded-2xl p-12 text-center border border-purple-500/30">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-purple-200 to-pink-200 bg-clip-text text-transparent">
              Ready to Transform Your AI Workflows?
            </h2>
            <p className="text-xl text-purple-100 mb-8 max-w-2xl mx-auto">
              Join thousands of developers and organizations using MCPOverflow AI to build the future of intelligent automation.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-4 text-lg">
                Get Started Free
              </Button>
              <Button size="lg" variant="outline" className="border-purple-400 text-purple-200 hover:bg-purple-800/20 px-8 py-4 text-lg">
                Schedule Demo
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-white/10">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-2 mb-4 md:mb-0">
              <Brain className="h-6 w-6 text-purple-400" />
              <span className="text-lg font-semibold">MCPOverflow AI</span>
            </div>
            <nav className="flex space-x-8">
              <Link href="/privacy" className="text-purple-200 hover:text-purple-400 transition-colors">
                Privacy
              </Link>
              <Link href="/terms" className="text-purple-200 hover:text-purple-400 transition-colors">
                Terms
              </Link>
              <Link href="/contact" className="text-purple-200 hover:text-purple-400 transition-colors">
                Contact
              </Link>
            </nav>
          </div>
          <div className="text-center mt-8 text-purple-300">
            <p>&copy; 2024 MCPOverflow. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}