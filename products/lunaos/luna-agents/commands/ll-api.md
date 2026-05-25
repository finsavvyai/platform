---
name: ll-api
displayName: Luna API Generator
description: Generate a complete API from a description — routes, validation, auth, tests, docs, deployment config
version: 1.0.0
category: creation
agent: luna-api-generator
parameters:
  - name: spec
    type: string
    description: API description in plain English, or path to OpenAPI spec
    required: true
    prompt: true
  - name: framework
    type: string
    description: "Framework: hono (default), express, fastify, nest, flask, fastapi"
    required: false
    default: hono
  - name: deploy
    type: string
    description: "Deploy target: cloudflare (default), vercel, aws-lambda, docker"
    required: false
    default: cloudflare
mcp_servers:
  - sequential-thinking
  - memory
  - git
  - fetch
---

# /api — From Description to Production API

Describe your API in English. Luna generates everything: routes, middleware, validation, auth, database schema, tests, docs, and deployment config.

## What Gets Generated

```
/api "User management API with auth, profiles, team invites, and admin panel"
                    │
                    ▼
┌─────────────────────────────────────────────┐
│  SCHEMA                                      │
│  ├── Prisma/Drizzle data model               │
│  ├── Zod validation schemas                  │
│  ├── TypeScript interfaces                   │
│  └── Database migration files                │
├─────────────────────────────────────────────┤
│  ROUTES                                      │
│  ├── CRUD endpoints for each entity          │
│  ├── Auth routes (register, login, refresh)  │
│  ├── Admin routes (users, roles, audit)      │
│  ├── Webhook endpoints                       │
│  └── Health check endpoint                   │
├─────────────────────────────────────────────┤
│  MIDDLEWARE                                  │
│  ├── JWT auth + API key auth                 │
│  ├── Role-based access control (RBAC)        │
│  ├── Rate limiting                           │
│  ├── CORS configuration                      │
│  ├── Request logging with correlation IDs    │
│  └── Error handling with structured responses│
├─────────────────────────────────────────────┤
│  TESTS                                       │
│  ├── Unit tests for every service            │
│  ├── Integration tests for every route       │
│  ├── Auth flow tests                         │
│  ├── Rate limit tests                        │
│  └── 90%+ coverage                           │
├─────────────────────────────────────────────┤
│  DOCS                                        │
│  ├── OpenAPI 3.1 spec                        │
│  ├── Interactive Swagger UI                  │
│  ├── Postman collection                      │
│  └── cURL examples for every endpoint        │
├─────────────────────────────────────────────┤
│  DEPLOY                                      │
│  ├── wrangler.toml (Cloudflare)              │
│  ├── Dockerfile                              │
│  ├── CI/CD pipeline                          │
│  └── Environment configuration               │
└─────────────────────────────────────────────┘
```

## Usage

```bash
/api "E-commerce API with products, cart, checkout, and order tracking"
/api "Real-time chat API with rooms, messages, typing indicators, and file sharing"
/api ./openapi.yaml --framework fastify --deploy docker
/api "Webhook relay service that receives, queues, and retries webhook deliveries"
```

## In Pipes

```bash
/pipe api "my API" >> test >> guard >> launch staging >> docs
/pipe idea "my product" >> api "$idea.api_spec" >> go *5 >> test >> ship
/pipe api "my API" >> morph to "GraphQL" >> test >> deploy
```
