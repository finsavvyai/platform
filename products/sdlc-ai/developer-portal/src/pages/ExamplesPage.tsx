import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Code, Play, Database, FileText, Zap, Globe } from 'lucide-react'

export const ExamplesPage: React.FC = () => {
  const examples = [
    {
      category: "Quick Start",
      icon: Zap,
      color: "text-blue-500",
      examples: [
        {
          title: "Basic RAG Query",
          language: "Python",
          code: `from sdlc import SDLCClient

client = SDLCClient(api_key="your-key")
response = await client.rag.query("What is AI?")
print(response.answer)`,
          description: "Simple RAG query with semantic search"
        },
        {
          title: "Document Upload",
          language: "TypeScript",
          code: `import { SDLCClient } from '@sdlc-ai/sdk'

const client = new SDLCClient({ apiKey: 'your-key' })
const doc = await client.documents.upload({
  title: 'ML Guide',
  content: 'Machine learning is...'
})`,
          description: "Upload and index a new document"
        }
      ]
    },
    {
      category: "Web Applications",
      icon: Globe,
      color: "text-green-500",
      examples: [
        {
          title: "React Chat Interface",
          language: "TypeScript",
          code: `import { useState, useCallback } from 'react'
import { SDLCClient } from '@sdlc-ai/sdk'

export function ChatInterface() {
  const [messages, setMessages] = useState([])
  const client = new SDLCClient({ apiKey: 'your-key' })

  const sendMessage = useCallback(async (message) => {
    const response = await client.rag.query(message)
    setMessages(prev => [...prev, { user: message, bot: response.answer }])
  }, [])

  return (
    <div>
      {messages.map((msg, i) => (
        <div key={i}>
          <p>User: {msg.user}</p>
          <p>Bot: {msg.bot}</p>
        </div>
      ))}
    </div>
  )
}`,
          description: "Real-time chat interface with RAG"
        },
        {
          title: "FastAPI Backend",
          language: "Python",
          code: `from fastapi import FastAPI
from sdlc import SDLCClient

app = FastAPI()
client = SDLCClient(api_key="your-key")

@app.post("/query")
async def query_documents(request: dict):
    response = await client.rag.query(
        request["query"],
        max_results=request.get("max_results", 10)
    )
    return {"answer": response.answer, "sources": response.sources}

@app.post("/upload")
async def upload_document(request: dict):
    doc = await client.documents.upload(
        title=request["title"],
        content=request["content"]
    )
    return {"id": doc.id, "status": "uploaded"}`,
          description: "REST API backend with RAG endpoints"
        }
      ]
    },
    {
      category: "Enterprise Integration",
      icon: Database,
      color: "text-purple-500",
      examples: [
        {
          title: "Enterprise SSO Integration",
          language: "Go",
          code: `package main

import (
    "context"
    "github.com/sdlc-ai/sdk-go"
    "github.com/clerkinc/clerk-sdk-go/v2"
)

type EnterpriseServer struct {
    sdlcClient *sdlc.Client
    clerkClient *clerk.Client
}

func (s *EnterpriseServer) HandleQuery(ctx context.Context, userToken string, query string) (*sdlc.RAGResponse, error) {
    // Verify user with enterprise SSO
    user, err := s.clerkClient.VerifyToken(userToken)
    if err != nil {
        return nil, err
    }

    // Make RAG request with user context
    response, err := s.sdlcClient.RAG().QueryWithContext(ctx, &sdlc.QueryRequest{
        Query: query,
        UserID: user.ID,
        TenantID: user.OrganizationID,
        Context: map[string]interface{}{
            "role": user.PublicMetadata["role"],
            "department": user.PublicMetadata["department"],
        },
    })

    return response, err
}`,
          description: "Enterprise SSO with role-based access"
        },
        {
          title: "Batch Document Processing",
          language: "Python",
          code: `import asyncio
from sdlc import SDLCClient

async def process_document_batch(documents, batch_size=10):
    client = SDLCClient(api_key="your-key")

    # Process documents in batches
    for i in range(0, len(documents), batch_size):
        batch = documents[i:i + batch_size]

        # Create tasks for concurrent upload
        tasks = [
            client.documents.upload(
                title=doc["title"],
                content=doc["content"],
                metadata=doc.get("metadata", {})
            )
            for doc in batch
        ]

        # Wait for batch completion
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Handle results
        for j, result in enumerate(results):
            if isinstance(result, Exception):
                print(f"Error uploading document {i+j}: {result}")
            else:
                print(f"Uploaded document {i+j}: {result.id}")

# Usage
documents = [
    {"title": f"Doc {i}", "content": f"Content for document {i}"}
    for i in range(100)
]

asyncio.run(process_document_batch(documents))`,
          description: "Concurrent batch processing with error handling"
        }
      ]
    }
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold mb-4">Code Examples</h1>
        <p className="text-xl text-muted-foreground">
          Real-world examples and implementation patterns for different use cases
        </p>
      </div>

      {examples.map((category) => (
        <div key={category.category} className="space-y-6">
          <div className="flex items-center gap-3">
            <category.icon className={`w-6 h-6 ${category.color}`} />
            <h2 className="text-2xl font-bold">{category.category}</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {category.examples.map((example, index) => (
              <Card key={index} className="card-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{example.title}</CardTitle>
                    <Badge variant="secondary">{example.language}</Badge>
                  </div>
                  <CardDescription>{example.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="relative">
                    <pre className="text-sm bg-muted p-4 rounded-lg overflow-x-auto">
                      <code className="font-mono">{example.code}</code>
                    </pre>
                    <button
                      onClick={() => navigator.clipboard.writeText(example.code)}
                      className="absolute top-2 right-2 p-2 bg-background border rounded-md hover:bg-muted transition-colors"
                    >
                      <Code className="w-4 h-4" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}

      {/* Additional Resources */}
      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle>Additional Resources</CardTitle>
          <CardDescription>
            More resources to help you build with SDLC.ai
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <FileText className="w-8 h-8 mx-auto mb-3 text-blue-500" />
              <h3 className="font-semibold mb-2">Full Documentation</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Complete API reference and guides
              </p>
              <Badge variant="outline" className="cursor-pointer">
                View Docs
              </Badge>
            </div>

            <div className="text-center">
              <Play className="w-8 h-8 mx-auto mb-3 text-green-500" />
              <h3 className="font-semibold mb-2">Interactive Playground</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Test API endpoints in your browser
              </p>
              <Badge variant="outline" className="cursor-pointer">
                Try Now
              </Badge>
            </div>

            <div className="text-center">
              <Database className="w-8 h-8 mx-auto mb-3 text-purple-500" />
              <h3 className="font-semibold mb-2">GitHub Repository</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Source code and examples
              </p>
              <Badge variant="outline" className="cursor-pointer">
                View on GitHub
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
