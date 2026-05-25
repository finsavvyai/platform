'use client'

import {
  Play,
  Pause,
  Square,
  RefreshCw,
  Settings,
  MoreHorizontal,
  TrendingUp,
  Clock,
  Zap
} from 'lucide-react'

import { Button } from '@mcpoverflow/ui'

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

interface AgentCardProps {
  agent: Agent
  isSelected: boolean
  onSelect: () => void
}

export function AgentCard({ agent, isSelected, onSelect }: AgentCardProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return <Play className="h-4 w-4 text-green-400" />
      case 'stopped': return <Square className="h-4 w-4 text-gray-400" />
      case 'error': return <div className="h-4 w-4 bg-red-400 rounded-full" />
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

  const getActionIcon = (status: string) => {
    switch (status) {
      case 'running': return <Pause className="h-4 w-4" />
      case 'stopped': return <Play className="h-4 w-4" />
      case 'paused': return <Play className="h-4 w-4" />
      case 'error': return <RefreshCw className="h-4 w-4" />
      default: return <Play className="h-4 w-4" />
    }
  }

  const getActionLabel = (status: string) => {
    switch (status) {
      case 'running': return 'Pause'
      case 'stopped': return 'Start'
      case 'paused': return 'Resume'
      case 'error': return 'Restart'
      default: return 'Start'
    }
  }

  return (
    <div
      onClick={onSelect}
      className={`glass-effect rounded-xl p-6 border cursor-pointer transition-all hover:scale-[1.02] ${
        isSelected
          ? 'border-purple-400 bg-purple-500/20'
          : 'border-white/10 bg-white/5 hover:bg-white/10'
      }`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-lg bg-gradient-to-r ${
            agent.status === 'running' ? 'from-green-500 to-emerald-600' :
            agent.status === 'error' ? 'from-red-500 to-pink-600' :
            'from-gray-500 to-gray-600'
          }`}>
            {getStatusIcon(agent.status)}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">{agent.name}</h3>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-purple-200">{agent.type}</span>
              <div className={`flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs border ${getStatusColor(agent.status)}`}>
                {getStatusIcon(agent.status)}
                <span className="capitalize">{agent.status}</span>
              </div>
            </div>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="text-purple-300 hover:text-white hover:bg-purple-800/20"
          onClick={(e) => {
            e.stopPropagation()
            // Handle more options
          }}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </div>

      <p className="text-sm text-purple-200 mb-4">{agent.description}</p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
        <div>
          <div className="flex items-center space-x-1 text-xs text-purple-300 mb-1">
            <Zap className="h-3 w-3" />
            <span>Requests</span>
          </div>
          <div className="text-lg font-semibold text-white">
            {agent.requests.toLocaleString()}
          </div>
        </div>

        <div>
          <div className="flex items-center space-x-1 text-xs text-purple-300 mb-1">
            <Clock className="h-3 w-3" />
            <span>Latency</span>
          </div>
          <div className="text-lg font-semibold text-white">
            {agent.latency}ms
          </div>
        </div>

        <div>
          <div className="flex items-center space-x-1 text-xs text-purple-300 mb-1">
            <TrendingUp className="h-3 w-3" />
            <span>Uptime</span>
          </div>
          <div className="text-lg font-semibold text-white">
            {agent.uptime}
          </div>
        </div>

        <div>
          <div className="text-xs text-purple-300 mb-1">Last Active</div>
          <div className="text-sm text-white">
            {agent.lastActive}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          className="border-purple-400 text-purple-200 hover:bg-purple-800/20"
          onClick={(e) => {
            e.stopPropagation()
            // Handle configure
          }}
        >
          <Settings className="mr-2 h-4 w-4" />
          Configure
        </Button>

        <Button
          size="sm"
          className={
            agent.status === 'running'
              ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
              : agent.status === 'error'
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-green-600 hover:bg-green-700 text-white'
          }
          onClick={(e) => {
            e.stopPropagation()
            // Handle start/stop/restart
          }}
        >
          {getActionIcon(agent.status)}
          <span className="ml-2">{getActionLabel(agent.status)}</span>
        </Button>
      </div>
    </div>
  )
}