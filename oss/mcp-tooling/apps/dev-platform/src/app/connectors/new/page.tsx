'use client'

import { useState } from 'react'
import {
  Button,
  Card,
  Badge,
  Input,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Alert,
  AlertTitle,
} from '@mcpoverflow/ui'
import { Upload, Link, FileText, Database, Globe, Shield, Zap, ArrowLeft, ArrowRight, CheckCircle } from 'lucide-react'

export default function NewConnectorPage() {
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    specType: '',
    specFile: null,
    specUrl: '',
    authType: '',
    deploymentTarget: '',
  })

  const steps = [
    { id: 1, title: 'API Specification', icon: FileText },
    { id: 2, title: 'Authentication', icon: Shield },
    { id: 3, title: 'Endpoints', icon: Globe },
    { id: 4, title: 'Deployment', icon: Zap },
  ]

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Connector Name
              </label>
              <Input
                placeholder="My API Connector"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="bg-gray-700 border-gray-600 text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Description (Optional)
              </label>
              <Textarea
                placeholder="Describe your connector and its purpose..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="bg-gray-700 border-gray-600 text-white"
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                API Specification Type
              </label>
              <Select onValueChange={(value) => setFormData({ ...formData, specType: value })}>
                <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                  <SelectValue placeholder="Select specification type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openapi">OpenAPI/Swagger</SelectItem>
                  <SelectItem value="graphql">GraphQL Schema</SelectItem>
                  <SelectItem value="postman">Postman Collection</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.specType && (
              <div className="space-y-4">
                <div className="flex gap-4">
                  <Button
                    variant={formData.specFile ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => document.getElementById('file-upload')?.click()}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload File
                  </Button>
                  <Button
                    variant={formData.specUrl ? 'default' : 'outline'}
                    className="flex-1"
                  >
                    <Link className="w-4 h-4 mr-2" />
                    Use URL
                  </Button>
                </div>
                <input
                  id="file-upload"
                  type="file"
                  className="hidden"
                  accept=".json,.yaml,.yml,.postman_collection"
                />

                <Input
                  placeholder="https://api.example.com/openapi.json"
                  value={formData.specUrl}
                  onChange={(e) => setFormData({ ...formData, specUrl: e.target.value })}
                  className="bg-gray-700 border-gray-600 text-white"
                />
              </div>
            )}

            {formData.specUrl && (
              <Alert>
                <Database className="h-4 w-4" />
                <AlertTitle>API Specification Found</AlertTitle>
                <div className="mt-2 space-y-2 text-sm text-gray-300">
                  <p>Endpoints detected: 24</p>
                  <p>Authentication methods: API Key, OAuth 2.0</p>
                  <p>Base URL: https://api.example.com</p>
                </div>
              </Alert>
            )}
          </div>
        )

      case 2:
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Authentication Method
              </label>
              <Select onValueChange={(value) => setFormData({ ...formData, authType: value })}>
                <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                  <SelectValue placeholder="Select authentication method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Authentication</SelectItem>
                  <SelectItem value="api_key">API Key</SelectItem>
                  <SelectItem value="oauth_client">OAuth 2.0 (Client Credentials)</SelectItem>
                  <SelectItem value="oauth_code">OAuth 2.0 (Authorization Code)</SelectItem>
                  <SelectItem value="jwt">JWT Bearer Token</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.authType === 'api_key' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    API Key Header Name
                  </label>
                  <Input
                    placeholder="X-API-Key"
                    defaultValue="X-API-Key"
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Key Location
                  </label>
                  <Select defaultValue="header">
                    <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="header">Header</SelectItem>
                      <SelectItem value="query">Query Parameter</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {formData.authType === 'oauth_code' && (
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertTitle>OAuth 2.0 Configuration</AlertTitle>
                <p className="text-sm text-gray-300 mt-2">
                  OAuth 2.0 Authorization Code flow will be configured during deployment.
                  You'll need to register your application with the API provider.
                </p>
              </Alert>
            )}
          </div>
        )

      case 3:
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Available Endpoints</h3>
              <Badge className="bg-blue-500/20 text-blue-400">
                24 endpoints detected
              </Badge>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {['GET /users', 'POST /users', 'PUT /users/:id', 'DELETE /users/:id', 'GET /posts', 'POST /posts'].map((endpoint) => (
                <div key={endpoint} className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <input type="checkbox" defaultChecked className="rounded" />
                    <span className="text-white font-mono text-sm">{endpoint}</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="text-xs">
                      {endpoint.split(' ')[0]}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      Required
                    </Badge>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1">
                Select All
              </Button>
              <Button variant="outline" className="flex-1">
                Deselect All
              </Button>
            </div>
          </div>
        )

      case 4:
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Deployment Target
              </label>
              <Select onValueChange={(value) => setFormData({ ...formData, deploymentTarget: value })}>
                <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                  <SelectValue placeholder="Select deployment target" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cloudflare-workers">Cloudflare Workers</SelectItem>
                  <SelectItem value="vercel-edge">Vercel Edge Functions</SelectItem>
                  <SelectItem value="aws-lambda">AWS Lambda</SelectItem>
                  <SelectItem value="download-only">Download Code Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.deploymentTarget && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertTitle>Ready to Deploy</AlertTitle>
                <div className="mt-2 space-y-2 text-sm text-gray-300">
                  <p>Connector: <strong>{formData.name}</strong></p>
                  <p>Endpoints: <strong>15 selected</strong></p>
                  <p>Runtime: <strong>{formData.deploymentTarget}</strong></p>
                  <p>Authentication: <strong>{formData.authType || 'None'}</strong></p>
                </div>
              </Alert>
            )}

            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <span className="text-gray-300">OpenAPI specification validated</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <span className="text-gray-300">Authentication configured</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <span className="text-gray-300">Endpoints selected</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <span className="text-gray-300">Deployment target ready</span>
              </div>
            </div>
          </div>
        )

      default:
        return null
    }
  }

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
            <Button variant="outline" asChild>
              <a href="/connectors">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Connectors
              </a>
            </Button>
          </div>
        </div>
      </nav>

      {/* Header */}
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Create New Connector</h1>
          <p className="text-gray-400">Transform your API into an MCP connector</p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {steps.map((stepItem) => {
              const Icon = stepItem.icon
              const isActive = step === stepItem.id
              const isCompleted = step > stepItem.id

              return (
                <div key={stepItem.id} className="flex items-center flex-1">
                  <div className="flex items-center">
                    <div className={`
                      w-10 h-10 rounded-full flex items-center justify-center
                      ${isActive ? 'bg-blue-600' : isCompleted ? 'bg-green-600' : 'bg-gray-700'}
                    `}>
                      {isCompleted ? (
                        <CheckCircle className="w-5 h-5 text-white" />
                      ) : (
                        <Icon className="w-5 h-5 text-white" />
                      )}
                    </div>
                    <div className="ml-3">
                      <p className={`text-sm font-medium ${isActive ? 'text-white' : 'text-gray-400'}`}>
                        {stepItem.title}
                      </p>
                    </div>
                  </div>
                  {stepItem.id < steps.length && (
                    <div className={`flex-1 h-px mx-4 ${step > stepItem.id ? 'bg-green-600' : 'bg-gray-700'}`} />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Form Content */}
        <Card className="bg-gray-800 border-gray-700 p-8 mb-6">
          {renderStepContent()}
        </Card>

        {/* Navigation */}
        <div className="flex justify-between">
          <Button
            variant="outline"
            disabled={step === 1}
            onClick={() => setStep(step - 1)}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Previous
          </Button>
          <Button
            disabled={step === steps.length}
            onClick={() => setStep(step + 1)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {step === steps.length ? 'Create Connector' : 'Next'}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  )
}