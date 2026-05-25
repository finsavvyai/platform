import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { Code, Database, FileText, Users, Search } from 'lucide-react'

export const ApiReferencePage: React.FC = () => {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold mb-4">API Reference</h1>
        <p className="text-xl text-muted-foreground">
          Complete API documentation with all endpoints, parameters, and response formats
        </p>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="rag">RAG API</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>API Overview</CardTitle>
              <CardDescription>Base URLs and authentication for the SDLC.ai API</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-3">Base URLs</h3>
                <div className="grid gap-2">
                  <div className="flex items-center justify-between p-3 bg-muted rounded">
                    <span>Production</span>
                    <code>https://api.sdlc.ai</code>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-muted rounded">
                    <span>Staging</span>
                    <code>https://staging-api.sdlc.ai</code>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-muted rounded">
                    <span>Development</span>
                    <code>http://localhost:8080</code>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-3">Authentication</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Include your API key in the Authorization header:
                </p>
                <code className="text-sm bg-muted p-3 rounded block">
                  Authorization: Bearer YOUR_API_KEY
                </code>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rag" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="w-5 h-5" />
                RAG API
              </CardTitle>
              <CardDescription>Retrieval-augmented generation endpoints</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h3 className="font-semibold">POST /v1/rag/query</h3>
                <p className="text-sm text-muted-foreground">
                  Execute a RAG query with semantic search and context-aware generation
                </p>

                <div>
                  <h4 className="font-medium mb-2">Request Body</h4>
                  <pre className="text-sm bg-muted p-4 rounded overflow-x-auto">
                    <code>{`{
  "query": "What is machine learning?",
  "context": {
    "max_results": 10,
    "similarity_threshold": 0.7,
    "filters": {
      "type": "tutorial",
      "tags": ["AI", "ML"]
    }
  },
  "options": {
    "stream": false,
    "temperature": 0.7,
    "max_tokens": 1000
  }
}`}</code>
                  </pre>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Response</h4>
                  <pre className="text-sm bg-muted p-4 rounded overflow-x-auto">
                    <code>{`{
  "id": "req_123456789",
  "query": "What is machine learning?",
  "answer": "Machine learning is a subset of artificial intelligence...",
  "sources": [
    {
      "id": "doc_001",
      "title": "Introduction to Machine Learning",
      "score": 0.89,
      "snippet": "Machine learning enables computers to learn..."
    }
  ],
  "usage": {
    "tokens_used": 150,
    "search_time": 45,
    "generation_time": 230
  }
}`}</code>
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Documents API
              </CardTitle>
              <CardDescription>Document management and search endpoints</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h3 className="font-semibold">POST /v1/documents</h3>
                <p className="text-sm text-muted-foreground">Upload and index new documents</p>

                <div>
                  <h4 className="font-medium mb-2">Request Body</h4>
                  <pre className="text-sm bg-muted p-4 rounded overflow-x-auto">
                    <code>{`{
  "title": "Machine Learning Guide",
  "content": "Machine learning is a subset of AI...",
  "metadata": {
    "type": "guide",
    "tags": ["AI", "ML", "tutorial"],
    "author": "John Doe",
    "created_at": "2024-01-15T10:00:00Z"
  }
}`}</code>
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Users API
              </CardTitle>
              <CardDescription>User management and profile endpoints</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h3 className="font-semibold">GET /v1/users/me</h3>
                <p className="text-sm text-muted-foreground">Get current user information</p>

                <div>
                  <h4 className="font-medium mb-2">Response</h4>
                  <pre className="text-sm bg-muted p-4 rounded overflow-x-auto">
                    <code>{`{
  "id": "user_123456",
  "email": "john.doe@example.com",
  "name": "John Doe",
  "role": "developer",
  "tenant_id": "tenant_001",
  "created_at": "2024-01-01T00:00:00Z",
  "usage": {
    "api_calls": 1250,
    "documents_uploaded": 45,
    "last_active": "2024-01-15T14:30:00Z"
  }
}`}</code>
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
