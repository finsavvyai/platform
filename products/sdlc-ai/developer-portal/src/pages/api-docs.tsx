/**
 * API Documentation Page
 * Interactive API documentation with live playground
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { CodeBlock } from '@/components/ui/code-block';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { CopyButton } from '@/components/ui/copy-button';
import { useAPI } from '@/hooks/use-api';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { PlayCircle, CheckCircle, AlertTriangle, Info } from 'lucide-react';

interface EndpointInfo {
  path: string;
  method: string;
  description: string;
  parameters: Parameter[];
  requestBody?: any;
  responses: ResponseInfo[];
  examples: Example[];
}

interface Parameter {
  name: string;
  type: string;
  required: boolean;
  description: string;
  default?: any;
  enum?: string[];
}

interface ResponseInfo {
  code: number;
  description: string;
  schema?: any;
}

interface Example {
  title: string;
  description: string;
  request?: any;
  response?: any;
  language: string;
}

interface PlaygroundState {
  endpoint: string;
  method: string;
  requestBody: string;
  headers: string;
  response: string;
  loading: boolean;
  error: string | null;
}

export default function APIDocsPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'rag' | 'documents' | 'payments' | 'analytics' | 'playground'>('overview');
  const [selectedEndpoint, setSelectedEndpoint] = useState<string>('');
  const [playground, setPlayground] = useState<PlaygroundState>({
    endpoint: '',
    method: 'GET',
    requestBody: '',
    headers: '{}',
    response: '',
    loading: false,
    error: null,
  });

  const api = useAPI();

  // API Endpoints Data
  const endpoints: Record<string, EndpointInfo[]> = {
    overview: [
      {
        path: '/health',
        method: 'GET',
        description: 'Check the health status of the SDLC.ai API',
        parameters: [],
        responses: [
          {
            code: 200,
            description: 'API is healthy',
            schema: {
              status: 'healthy',
              services: {
                rag: 'healthy',
                documents: 'healthy',
                payments: 'healthy',
              },
            },
          },
        ],
        examples: [
          {
            title: 'Basic Health Check',
            description: 'Get current API health status',
            language: 'curl',
          },
        ],
      },
      {
        path: '/version',
        method: 'GET',
        description: 'Get API version information',
        parameters: [],
        responses: [
          {
            code: 200,
            description: 'API version information',
            schema: {
              version: '1.0.0',
              build: '20240115-1234',
              environment: 'production',
            },
          },
        ],
      },
    ],
    rag: [
      {
        path: '/api/v1/rag/query',
        method: 'POST',
        description: 'Execute a RAG (Retrieval-Augmented Generation) query',
        parameters: [
          {
            name: 'query',
            type: 'string',
            required: true,
            description: 'The query to execute',
          },
          {
            name: 'max_results',
            type: 'integer',
            required: false,
            default: 10,
            description: 'Maximum number of results to return',
          },
          {
            name: 'include_citations',
            type: 'boolean',
            required: false,
            default: true,
            description: 'Include citation information in response',
          },
        ],
        requestBody: {
          query: string,
          max_results?: number,
          include_citations?: boolean,
          filters?: Record<string, any>,
        },
        responses: [
          {
            code: 200,
            description: 'Query response with citations',
            schema: {
              query_id: 'string',
              response: 'string',
              confidence: 'number',
              citations: 'array',
              token_usage: 'object',
              response_time_ms: 'number',
            },
          },
        ],
        examples: [
          {
            title: 'Basic RAG Query',
            description: 'Ask a question about your documents',
            request: {
              query: 'What are the best practices for secure software development?',
              max_results: 5,
              include_citations: true,
            },
            language: 'python',
          },
          {
            title: 'Streaming Query',
            description: 'Execute a streaming RAG query',
            request: {
              query: 'Explain machine learning concepts',
              max_results: 10,
            },
            language: 'javascript',
          },
        ],
      },
      {
        path: '/api/v1/rag/query/stream',
        method: 'POST',
        description: 'Execute a streaming RAG query',
        parameters: [],
        requestBody: {
          query: string,
          max_results?: number,
        },
        responses: [
          {
            code: 200,
            description: 'Streaming response',
          },
        ],
        examples: [
          {
            title: 'Streaming Response',
            description: 'Get real-time streaming response',
            language: 'javascript',
          },
        ],
      },
    ],
    documents: [
      {
        path: '/api/v1/documents/upload',
        method: 'POST',
        description: 'Upload a document for processing',
        parameters: [
          {
            name: 'file',
            type: 'file',
            required: true,
            description: 'Document file to upload',
          },
          {
            name: 'name',
            type: 'string',
            required: false,
            description: 'Document name',
          },
          {
            name: 'tags',
            type: 'array',
            required: false,
            description: 'Document tags',
          },
        ],
        responses: [
          {
            code: 200,
            description: 'Document uploaded successfully',
            schema: {
              document_id: 'string',
              status: 'uploading',
              created_at: 'string',
            },
          },
        ],
        examples: [
          {
            title: 'Upload PDF Document',
            description: 'Upload a PDF document for RAG processing',
            language: 'python',
          },
          {
            title: 'Upload with Tags',
            description: 'Upload document with metadata',
            language: 'javascript',
          },
        ],
      },
      {
        path: '/api/v1/documents/{document_id}',
        method: 'GET',
        description: 'Get document information',
        parameters: [
          {
            name: 'document_id',
            type: 'string',
            required: true,
            description: 'Document ID',
          },
        ],
        responses: [
          {
            code: 200,
            description: 'Document information',
            schema: {
              document_id: 'string',
              name: 'string',
              size: 'number',
              status: 'string',
              created_at: 'string',
              tags: 'array',
            },
          },
        ],
      },
    ],
    payments: [
      {
        path: '/api/v1/payments/methods',
        method: 'GET',
        description: 'List payment methods',
        parameters: [],
        responses: [
          {
            code: 200,
            description: 'List of payment methods',
            schema: {
              methods: 'array',
            },
          },
        ],
      },
      {
        path: '/api/v1/payments/process',
        method: 'POST',
        description: 'Process a payment',
        parameters: [
          {
            name: 'amount_cents',
            type: 'integer',
            required: true,
            description: 'Amount in cents',
          },
          {
            name: 'currency',
            type: 'string',
            required: true,
            description: 'Currency code (ISO 4217)',
          },
          {
            name: 'payment_method_token',
            type: 'string',
            required: true,
            description: 'Tokenized payment method',
          },
        ],
        requestBody: {
          amount_cents: number,
          currency: string,
          payment_method_token: string,
          description?: string,
        },
        responses: [
          {
            code: 200,
            description: 'Payment processed successfully',
            schema: {
              payment_id: 'string',
              status: 'string',
              created_at: 'string',
            },
          },
        ],
      },
    ],
  };

  const handleEndpointPlayground = async () => {
    if (!playground.endpoint) return;

    setPlayground({ ...playground, loading: true, error: null });

    try {
      const headers = JSON.parse(playground.headers || '{}');
      const body = playground.requestBody ? JSON.parse(playground.requestBody) : {};

      const response = await api.request(playground.method, playground.endpoint, {
        headers,
        body,
      });

      setPlayground({
        response: JSON.stringify(response, null, 2),
        loading: false,
        error: null,
      });
    } catch (error) {
      setPlayground({
        loading: false,
        error: error instanceof Error ? error.message : 'Request failed',
        response: '',
      });
    }
  };

  const renderEndpoint = (endpoint: EndpointInfo) => {
    return (
      <Card key={endpoint.path} className="mb-4">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-mono">{endpoint.method} {endpoint.path}</CardTitle>
            <Badge variant="secondary">{endpoint.responses[0]?.code}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-gray-600 mb-2">{endpoint.description}</p>

            {endpoint.parameters.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Parameters:</h4>
                <div className="space-y-1">
                  {endpoint.parameters.map((param, index) => (
                    <div key={index} className="flex items-center space-x-4 text-sm">
                      <code className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">
                        {param.type}
                      </code>
                      <div className="flex-1">
                        <Label htmlFor={`param-${param.name}`} className="text-xs font-medium">
                          {param.name}
                          {param.required && <span className="text-red-500">*</span>}
                        </Label>
                        <div className="text-xs text-gray-500">
                          {param.description}
                          {param.default && (
                            <span className="text-gray-400">Default: {param.default}</span>
                          )}
                        </div>
                      </div>
                      {param.enum && (
                        <Select>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Select option" />
                          </SelectTrigger>
                          <SelectContent>
                            {param.enum.map((option) => (
                              <SelectItem key={option} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {endpoint.examples.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Examples:</h4>
              <Accordion type="single" className="w-full">
                {endpoint.examples.map((example, index) => (
                  <AccordionItem key={index} value={`example-${index}`}>
                    <AccordionTrigger className="text-left text-sm">
                      <div className="flex items-center space-x-2">
                        <Info className="h-4 w-4" />
                        <span>{example.title}</span>
                        <Badge variant="outline" className="text-xs">
                          {example.language}
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4">
                        <p className="text-sm text-gray-600">{example.description}</p>

                        {example.request && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">Request:</span>
                              <CopyButton
                                value={JSON.stringify(example.request, null, 2)}
                                className="h-6 w-6"
                              />
                            </div>
                            <CodeBlock
                              language={example.language}
                              code={JSON.stringify(example.request, null, 2)}
                            />
                          </div>
                        )}

                        {example.response && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">Response:</span>
                              <CopyButton
                                value={JSON.stringify(example.response, null, 2)}
                                className="h-6 w-6"
                              />
                            </div>
                            <CodeBlock
                              language="json"
                              code={JSON.stringify(example.response, null, 2)}
                            />
                          </div>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">API Documentation</h1>
        <p className="text-lg text-gray-600 mb-4">
          Interactive API documentation with live playground for testing endpoints
        </p>

        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            All endpoints require authentication. Use the Developer CLI to configure your API key.
          </AlertDescription>
        </Alert>
      </div>

      <div className="flex items-center space-x-4 mb-6">
        <div className="flex-1">
          <Label htmlFor="endpoint-search" className="text-sm font-medium">
            Search Endpoints
          </Label>
          <Input
            id="endpoint-search"
            placeholder="Search by path or method..."
            value={selectedEndpoint}
            onChange={(e) => setSelectedEndpoint(e.target.value)}
            className="w-full"
          />
        </div>
        <Button
          variant="outline"
          onClick={() => window.location.href = '/docs/api/openapi.json'}
        >
          Download OpenAPI Spec
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="rag">RAG</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="playground">Playground</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {endpoints.overview.map(renderEndpoint)}
          </div>
        </TabsContent>

        <TabsContent value="rag">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {endpoints.rag.map(renderEndpoint)}
          </div>
        </TabsContent>

        <TabsContent value="documents">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {endpoints.documents.map(renderEndpoint)}
          </div>
        </TabsContent>

        <TabsContent value="payments">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {endpoints.payments.map(renderEndpoint)}
          </div>
        </TabsContent>

        <TabsContent value="playground">
          <Card>
            <CardHeader>
              <CardTitle>API Playground</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <Label htmlFor="endpoint-select">Endpoint</Label>
                  <Select
                    id="endpoint-select"
                    value={playground.endpoint}
                    onChange={(e) => {
                      const endpoint = e.target.value;
                      const selected = endpoints.rag.find(ep => ep.path === endpoint) ||
                                     endpoints.documents.find(ep => ep.path === endpoint) ||
                                     endpoints.payments.find(ep => ep.path === endpoint);
                      if (selected) {
                        setPlayground({
                          endpoint: selected.path,
                          method: selected.method,
                          requestBody: JSON.stringify(selected.examples[0]?.request || {}, null, 2),
                        });
                      }
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select an endpoint" />
                    </SelectTrigger>
                    <SelectContent>
                      {endpoints.rag.map((endpoint) => (
                        <SelectItem key={endpoint.path} value={endpoint.path}>
                          {endpoint.method} {endpoint.path}
                        </SelectItem>
                      ))}
                      {endpoints.documents.map((endpoint) => (
                        <SelectItem key={endpoint.path} value={endpoint.path}>
                          {endpoint.method} {endpoint.path}
                        </SelectItem>
                      ))}
                      {endpoints.payments.map((endpoint) => (
                        <SelectItem key={endpoint.path} value={endpoint.path}>
                          {endpoint.method} {endpoint.path}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-4">
                  <Label htmlFor="method-select">Method</Label>
                  <Select
                    id="method-select"
                    value={playground.method}
                    onChange={(e) => setPlayground({ ...playground, method: e.target.value })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GET">GET</SelectItem>
                      <SelectItem value="POST">POST</SelectItem>
                      <SelectItem value="PUT">PUT</SelectItem>
                      <SelectItem value="DELETE">DELETE</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-4">
                  <Label htmlFor="headers">Headers (JSON)</Label>
                  <Textarea
                    id="headers"
                    placeholder='{"Content-Type": "application/json"}'
                    value={playground.headers}
                    onChange={(e) => setPlayground({ ...playground, headers: e.target.value })}
                    className="min-h-24"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <Label htmlFor="request-body">Request Body (JSON)</Label>
                <Textarea
                  id="request-body"
                  placeholder='{"query": "Your question here..."}'
                  value={playground.requestBody}
                  onChange={(e) => setPlayground({ ...playground, requestBody: e.target.value })}
                  className="min-h-32"
                />
              </div>

              <div className="flex items-center space-x-4">
                <Button
                  onClick={handleEndpointPlayground}
                  disabled={!playground.endpoint || playground.loading}
                  className="flex-1"
                >
                  {playground.loading ? (
                    <>
                      <LoadingSpinner className="mr-2" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <PlayCircle className="mr-2 h-4 w-4" />
                      Send Request
                    </>
                  )}
                </Button>

                {playground.response && (
                  <Button
                    variant="outline"
                    onClick={() => setPlayground({ ...playground, response: '' })}
                  >
                    Clear
                  </Button>
                )}
              </div>

              {playground.error && (
                <Alert className="mb-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    {playground.error}
                  </AlertDescription>
                </Alert>
              )}

              {playground.response && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Response:</Label>
                    <CopyButton
                      value={playground.response}
                      className="h-6 w-6"
                    />
                  </div>
                  <CodeBlock language="json" code={playground.response} />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
