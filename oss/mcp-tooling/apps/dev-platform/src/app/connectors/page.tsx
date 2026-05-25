'use client'

import {
  Button,
  Card,
  Badge,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@mcpoverflow/ui'
import { Plus, Search, Filter, MoreHorizontal, Eye, Edit, Trash2, Zap, Globe, Shield } from 'lucide-react'

const mockConnectors = [
  {
    id: '1',
    name: 'GitHub API Connector',
    status: 'active',
    runtime: 'worker-ts',
    authMode: 'api_key',
    endpointCount: 15,
    lastDeployed: '2024-10-15',
    apiCalls: 12543,
    uptime: '99.9%',
  },
  {
    id: '2',
    name: 'Stripe Payment API',
    status: 'active',
    runtime: 'worker-go',
    authMode: 'api_key',
    endpointCount: 28,
    lastDeployed: '2024-10-14',
    apiCalls: 8921,
    uptime: '99.8%',
  },
  {
    id: '3',
    name: 'Slack Bot API',
    status: 'draft',
    runtime: 'worker-ts',
    authMode: 'oauth_client',
    endpointCount: 12,
    lastDeployed: null,
    apiCalls: 0,
    uptime: 'N/A',
  },
]

const statusColors = {
  active: 'bg-green-500/20 text-green-400 border-green-500/50',
  draft: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
  error: 'bg-red-500/20 text-red-400 border-red-500/50',
}

const runtimeColors = {
  'worker-ts': 'bg-blue-500/20 text-blue-400',
  'worker-go': 'bg-purple-500/20 text-purple-400',
  'download-only': 'bg-gray-500/20 text-gray-400',
}

export default function ConnectorsPage() {
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Navigation */}
      <nav className="bg-gray-800 border-b border-gray-700">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">MCP</span>
              </div>
              <span className="text-xl font-bold text-blue-400">MCPOverflow</span>
            </div>
            <div className="flex items-center space-x-6">
              <a href="/" className="text-gray-300 hover:text-white">Dashboard</a>
              <a href="/connectors" className="text-white font-medium">Connectors</a>
              <a href="/deployments" className="text-gray-300 hover:text-white">Deployments</a>
              <a href="/settings" className="text-gray-300 hover:text-white">Settings</a>
            </div>
            <Button variant="outline">Sign In</Button>
          </div>
        </div>
      </nav>

      {/* Header */}
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Connectors</h1>
            <p className="text-gray-400">Manage your MCP connectors and deployments</p>
          </div>
          <Button className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            New Connector
          </Button>
        </div>

        {/* Filters */}
        <Card className="bg-gray-800 border-gray-700 p-6 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search connectors..."
                  className="pl-10 bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <Select>
                <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
              <Select>
                <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                  <SelectValue placeholder="All Runtimes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Runtimes</SelectItem>
                  <SelectItem value="worker-ts">TypeScript Worker</SelectItem>
                  <SelectItem value="worker-go">Go Worker</SelectItem>
                  <SelectItem value="download-only">Download Only</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline">
                <Filter className="w-4 h-4 mr-2" />
                More Filters
              </Button>
            </div>
          </div>
        </Card>

        {/* Connectors Grid */}
        <div className="grid gap-4">
          {mockConnectors.map((connector) => (
            <Card key={connector.id} className="bg-gray-800 border-gray-700 p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <h3 className="text-lg font-semibold text-white">{connector.name}</h3>
                    <Badge className={statusColors[connector.status]}>
                      {connector.status}
                    </Badge>
                    <Badge className={runtimeColors[connector.runtime]}>
                      {connector.runtime}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-6 text-sm text-gray-400 mb-4">
                    <div className="flex items-center gap-1">
                      <Globe className="w-4 h-4" />
                      <span>{connector.endpointCount} endpoints</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Shield className="w-4 h-4" />
                      <span>{connector.authMode.replace('_', ' ')}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Zap className="w-4 h-4" />
                      <span>{connector.apiCalls.toLocaleString()} calls</span>
                    </div>
                    <div>
                      <span>Uptime: {connector.uptime}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-400">
                      Last deployed: {connector.lastDeployed || 'Never'}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm">
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem>
                            <Eye className="w-4 h-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Edit className="w-4 h-4 mr-2" />
                            Edit Connector
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-red-400 focus:text-red-400">
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Empty State */}
        {mockConnectors.length === 0 && (
          <Card className="bg-gray-800 border-gray-700 p-12 text-center">
            <div className="text-gray-500 mb-4">
              <Plus className="w-16 h-16 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">No connectors yet</h3>
            <p className="text-gray-400 mb-6">Create your first MCP connector to get started</p>
            <Button className="bg-blue-600 hover:bg-blue-700">
              Create Your First Connector
            </Button>
          </Card>
        )}
      </div>
    </div>
  )
}