'use client'

import { useState, useEffect } from 'react'
import {
  Brain,
  Activity,
  Settings,
  Play,
  Pause,
  Square,
  RefreshCw,
  Zap,
  Globe,
  Cpu,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  Filter,
  Search,
  Plus,
  MoreHorizontal
} from 'lucide-react'

import { Button } from '@mcpoverflow/ui'
import { AgentCard } from '@/components/agent-card'
import { AgentVisualization } from '@/components/agent-visualization'
import { PerformanceChart } from '@/components/performance-chart'

interface Agent {
  id: string
  name: string
  status: 'running' | 'stopped' | 'error' | 'paused'
  type: string
  requests: number
  latency: number
  uptime: string
  lastActive: string
  description: string
}

export default function DashboardPage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Simulate loading agents
    const mockAgents: Agent[] = [
      {
        id: '1',
        name: 'Customer Support Bot',
        status: 'running',
        type: 'Support',
        requests: 15420,
        latency: 245,
        uptime: '99.97%',
        lastActive: '2 min ago',
        description: 'Handles customer inquiries and support tickets'
      },
      {
        id: '2',
        name: 'Data Analysis Agent',
        status: 'running',
        type: 'Analytics',
        requests: 8734,
        latency: 189,
        uptime: '99.99%',
        lastActive: 'Just now',
        description: 'Processes and analyzes large datasets'
      },
      {
        id: '3',
        name: 'Content Generator',
        status: 'paused',
        type: 'Content',
        requests: 3210,
        latency: 412,
        uptime: '98.45%',
        lastActive: '1 hour ago',
        description: 'Generates marketing content and blog posts'
      },
      {
        id: '4',
        name: 'API Monitor',
        status: 'error',
        type: 'Monitoring',
        requests: 456,
        latency: 0,
        uptime: '0%',
        lastActive: '3 hours ago',
        description: 'Monitors API health and performance'
      },
      {
        id: '5',
        name: 'Security Scanner',
        status: 'running',
        type: 'Security',
        requests: 987,
        latency: 342,
        uptime: '100%',
        lastActive: '5 min ago',
        description: 'Scans for security vulnerabilities'
      },
      {
        id: '6',
        name: 'Recommendation Engine',
        status: 'stopped',
        type: 'ML',
        requests: 0,
        latency: 0,
        uptime: '0%',
        lastActive: '1 day ago',
        description: 'Personalized content recommendations'
      }
    ]

    setTimeout(() => {
      setAgents(mockAgents)
      setIsLoading(false)
    }, 1000)
  }, [])

  const filteredAgents = agents.filter(agent => {
    const matchesSearch = agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         agent.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || agent.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return <Play className="h-4 w-4 text-green-400" />
      case 'stopped': return <Square className="h-4 w-4 text-gray-400" />
      case 'error': return <AlertTriangle className="h-4 w-4 text-red-400" />
      case 'paused': return <Pause className="h-4 w-4 text-yellow-400" />
      default: return <Clock className="h-4 w-4 text-gray-400" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-green-500/20 text-green-300 border-green-500/30'
      case 'stopped': return 'bg-gray-500/20 text-gray-300 border-gray-500/30'
      case 'error': return 'bg-red-500/20 text-red-300 border-red-500/30'
      case 'paused': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
      default: return 'bg-gray-500/20 text-gray-300 border-gray-500/30'
    }
  }

  const stats = {
    total: agents.length,
    running: agents.filter(a => a.status === 'running').length,
    totalRequests: agents.reduce((sum, a) => sum + a.requests, 0),
    avgLatency: agents.length > 0
      ? Math.round(agents.reduce((sum, a) => sum + a.latency, 0) / agents.length)
      : 0
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-purple-200 to-pink-200 bg-clip-text text-transparent">
              Agent Management Dashboard
            </h1>
            <p className="text-purple-200">
              Monitor and manage your AI agents in real-time
            </p>
          </div>
          <Button className="bg-purple-600 hover:bg-purple-700">
            <Plus className="mr-2 h-4 w-4" />
            Deploy New Agent
          </Button>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="glass-effect rounded-xl p-6 border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <Brain className="h-8 w-8 text-purple-400" />
              <span className="text-2xl font-bold text-white">{stats.total}</span>
            </div>
            <div className="text-sm text-purple-200">Total Agents</div>
          </div>

          <div className="glass-effect rounded-xl p-6 border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <Activity className="h-8 w-8 text-green-400" />
              <span className="text-2xl font-bold text-white">{stats.running}</span>
            </div>
            <div className="text-sm text-purple-200">Running</div>
          </div>

          <div className="glass-effect rounded-xl p-6 border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <Zap className="h-8 w-8 text-blue-400" />
              <span className="text-2xl font-bold text-white">{stats.totalRequests.toLocaleString()}</span>
            </div>
            <div className="text-sm text-purple-200">Total Requests</div>
          </div>

          <div className="glass-effect rounded-xl p-6 border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <Clock className="h-8 w-8 text-yellow-400" />
              <span className="text-2xl font-bold text-white">{stats.avgLatency}ms</span>
            </div>
            <div className="text-sm text-purple-200">Avg Latency</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Filters and Search */}
            <div className="glass-effect rounded-xl p-6 border border-white/10">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-purple-300" />
                  <input
                    type="text"
                    placeholder="Search agents..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:border-purple-400"
                  />
                </div>

                <div className="flex gap-2">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-purple-400"
                  >
                    <option value="all">All Status</option>
                    <option value="running">Running</option>
                    <option value="stopped">Stopped</option>
                    <option value="paused">Paused</option>
                    <option value="error">Error</option>
                  </select>

                  <Button variant="outline" className="border-white/20 text-purple-200 hover:bg-white/10">
                    <Filter className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Agent List */}
            <div className="space-y-4">
              {isLoading ? (
                <div className="glass-effect rounded-xl p-8 border border-white/10 text-center">
                  <RefreshCw className="h-8 w-8 text-purple-400 mx-auto mb-4 animate-spin" />
                  <p className="text-purple-200">Loading agents...</p>
                </div>
              ) : (
                filteredAgents.map((agent) => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    isSelected={selectedAgent === agent.id}
                    onSelect={() => setSelectedAgent(agent.id)}
                  />
                ))
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-8">
            {/* Agent Visualization */}
            <div className="glass-effect rounded-xl p-6 border border-white/10">
              <h3 className="text-xl font-semibold mb-4 flex items-center">
                <Globe className="h-5 w-5 mr-2 text-purple-400" />
                Network View
              </h3>
              <AgentVisualization agents={agents} />
            </div>

            {/* Performance Chart */}
            <div className="glass-effect rounded-xl p-6 border border-white/10">
              <h3 className="text-xl font-semibold mb-4 flex items-center">
                <TrendingUp className="h-5 w-5 mr-2 text-purple-400" />
                Performance Metrics
              </h3>
              <PerformanceChart />
            </div>

            {/* Quick Actions */}
            <div className="glass-effect rounded-xl p-6 border border-white/10">
              <h3 className="text-xl font-semibold mb-4">Quick Actions</h3>
              <div className="space-y-2">
                <Button variant="outline" className="w-full border-white/20 text-purple-200 hover:bg-white/10">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh All Agents
                </Button>
                <Button variant="outline" className="w-full border-white/20 text-purple-200 hover:bg-white/10">
                  <Settings className="mr-2 h-4 w-4" />
                  Global Settings
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}