'use client'

import { Card } from '@mcpoverflow/ui'
import { Zap, Activity, Clock, CheckCircle } from 'lucide-react'

export default function Home() {
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
              <a href="/" className="text-gray-300 hover:text-white">Home</a>
              <a href="/connectors" className="text-white font-medium">Connectors</a>
              <a href="/deployments" className="text-gray-300 hover:text-white">Deployments</a>
              <a href="/settings" className="text-gray-300 hover:text-white">Settings</a>
            </div>
            <button className="border border-gray-600 text-gray-300 px-4 py-2 rounded hover:bg-gray-700">
              Sign In
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Developer Platform</h1>
          <p className="text-gray-400">Build, test, and deploy MCP connectors for your APIs</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gray-800 border-gray-700 p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg text-white">Active Connectors</h3>
              <Activity className="h-5 w-5 text-blue-400" />
            </div>
            <div className="text-3xl font-bold text-blue-400 mb-1">0</div>
            <p className="text-gray-400 text-sm">Deployed and running</p>
          </Card>

          <Card className="bg-gray-800 border-gray-700 p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg text-white">API Calls Today</h3>
              <Zap className="h-5 w-5 text-green-400" />
            </div>
            <div className="text-3xl font-bold text-green-400 mb-1">0</div>
            <p className="text-gray-400 text-sm">Total requests</p>
          </Card>

          <Card className="bg-gray-800 border-gray-700 p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg text-white">Uptime</h3>
              <CheckCircle className="h-5 w-5 text-green-400" />
            </div>
            <div className="text-3xl font-bold text-green-400 mb-1">100%</div>
            <p className="text-gray-400 text-sm">Last 30 days</p>
          </Card>

          <Card className="bg-gray-800 border-gray-700 p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg text-white">Avg Response</h3>
              <Clock className="h-5 w-5 text-yellow-400" />
            </div>
            <div className="text-3xl font-bold text-yellow-400 mb-1">--</div>
            <p className="text-gray-400 text-sm">Response time</p>
          </Card>
        </div>

        {/* Main Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <h3 className="text-xl text-white mb-4">Create New Connector</h3>
            <p className="text-gray-400 mb-4">
              Generate MCP connectors from OpenAPI, GraphQL, or Postman collections
            </p>
            <div className="space-y-4">
              <button className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg">
                Create from OpenAPI/Swagger
              </button>
              <button className="w-full border border-gray-600 text-gray-300 px-6 py-3 rounded-lg hover:bg-gray-700">
                Create from GraphQL Schema
              </button>
              <button className="w-full border border-gray-600 text-gray-300 px-6 py-3 rounded-lg hover:bg-gray-700">
                Import Postman Collection
              </button>
            </div>
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <h3 className="text-xl text-white mb-4">Quick Start</h3>
            <p className="text-gray-400 mb-4">
              Get started with MCPOverflow in minutes
            </p>
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold">1</span>
                </div>
                <div>
                  <p className="text-white font-medium">Upload API Specification</p>
                  <p className="text-gray-400 text-sm">OpenAPI, GraphQL, or Postman</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold">2</span>
                </div>
                <div>
                  <p className="text-white font-medium">Configure Authentication</p>
                  <p className="text-gray-400 text-sm">API keys, OAuth, JWT, and more</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold">3</span>
                </div>
                <div>
                  <p className="text-white font-medium">Deploy</p>
                  <p className="text-gray-400 text-sm">One-click deployment to Cloudflare Workers</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Connectors */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
          <h3 className="text-xl text-white mb-4">Recent Connectors</h3>
          <p className="text-gray-400 mb-6">
            Your recently created and deployed connectors
          </p>
          <div className="text-center py-12">
            <div className="text-gray-500 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-white mb-2">No connectors yet</h3>
            <p className="text-gray-400 mb-6">Create your first MCP connector to get started</p>
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg">
              Create Your First Connector
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}