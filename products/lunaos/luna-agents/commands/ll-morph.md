---
name: ll-morph
displayName: Luna Morph
description: Transform any app between platforms — web to mobile, mobile to desktop, React to Vue, Next.js to Nuxt, REST to GraphQL
version: 1.0.0
category: transformation
agent: luna-design-architect
parameters:
  - name: from
    type: string
    description: Source (path, URL, or description of current state)
    required: true
    prompt: true
  - name: to
    type: string
    description: "Target platform/framework/pattern"
    required: true
    prompt: true
mcp_servers:
  - git
  - fetch
  - playwright
  - zai-mcp-server
  - sequential-thinking
  - ruflo
---

# /morph — Transform Anything Into Anything

The universal translator for code. Change platforms, frameworks, patterns, or paradigms while preserving all business logic.

## Transformations

### Platform Morphs
```bash
/morph ./web-app to "React Native mobile app"
/morph ./web-app to "Electron desktop app"
/morph ./mobile-app to "Progressive Web App"
/morph ./rest-api to "GraphQL API"
/morph ./monolith to "microservices"
/morph ./express-app to "Cloudflare Workers"
```

### Framework Morphs
```bash
/morph ./react-app to "Vue 3 + Nuxt"
/morph ./next-app to "Remix"
/morph ./next-app to "Astro + React islands"
/morph ./cra-app to "Vite + React"
/morph ./express-api to "Hono"
/morph ./prisma-schema to "Drizzle"
/morph ./redux-store to "Zustand"
/morph ./class-components to "functional + hooks"
```

### Pattern Morphs
```bash
/morph ./callbacks to "async/await"
/morph ./rest-endpoints to "tRPC procedures"
/morph ./sql-queries to "Prisma ORM"
/morph ./javascript to "TypeScript strict"
/morph ./css-modules to "Tailwind"
/morph ./jest-tests to "Vitest"
```

### Design Morphs
```bash
/morph ./material-ui to "Apple HIG + shadcn"
/morph ./bootstrap-site to "Tailwind + custom design system"
/morph ./dark-theme to "light + dark with system preference"
/morph https://competitor.com to "our brand + our design system"
```

## How It Works

```
/morph ./src to "Vue 3"
         │
         ▼
   ANALYZE SOURCE
   ├── Parse all components, routes, state, hooks
   ├── Extract business logic (framework-agnostic)
   ├── Map dependencies to equivalents
   └── Identify platform-specific code
         │
         ▼
   PLAN TRANSFORMATION
   ├── 1:1 component mapping (React→Vue SFC)
   ├── State management mapping (Zustand→Pinia)
   ├── Router mapping (Next.js→Nuxt)
   ├── Build system mapping (webpack→Vite)
   └── Test framework mapping (Jest→Vitest)
         │
         ▼
   EXECUTE (ruflo swarm — parallel per module)
   ├── Agent 1: Transform components
   ├── Agent 2: Transform state/stores
   ├── Agent 3: Transform routes/pages
   ├── Agent 4: Transform API layer
   ├── Agent 5: Transform tests
   └── Agent 6: Update configs/build
         │
         ▼
   VERIFY
   ├── TypeScript compiles cleanly
   ├── All tests pass in new framework
   ├── Visual diff matches original
   └── Performance benchmark comparison
```

## In Pipes

```bash
/pipe morph ./app to "React Native" >> hig >> test >> launch staging
/pipe morph ./api to "GraphQL" >> test >> visual-diff >> launch production
/pipe clone https://app.com >> morph to "our stack" >> brand >> ship
```
