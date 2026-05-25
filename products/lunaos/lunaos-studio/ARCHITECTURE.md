# Architecture — LunaOS Studio

## Overview

LunaOS Studio is a browser-based visual workflow builder for AI agent pipelines. It communicates with the LunaOS Engine API (`api.lunaos.ai`) for execution and is deployed as a static SPA on Netlify/Cloudflare Pages.

## System Diagram

```
┌─────────────────────────────────┐
│         Browser (SPA)           │
│  ┌───────────────────────────┐  │
│  │  React 18 + Vite          │  │
│  │  ┌─────────────────────┐  │  │
│  │  │  StudioBuilder      │  │  │
│  │  │  ├─ Toolbar         │  │  │
│  │  │  ├─ NodePalette     │  │  │
│  │  │  ├─ WorkflowCanvas  │  │  │
│  │  │  ├─ NodeConfig      │  │  │
│  │  │  └─ TemplateLibrary │  │  │
│  │  └─────────────────────┘  │  │
│  │  lib/                      │  │
│  │  ├─ node-registry.ts       │  │
│  │  ├─ pipeline-serializer.ts │  │
│  │  ├─ workflow-runner.ts     │  │
│  │  ├─ datadog.ts             │  │
│  │  └─ health.ts              │  │
│  └───────────────────────────┘  │
└──────────────┬──────────────────┘
               │ HTTPS / SSE
               ▼
┌──────────────────────────────────┐
│  LunaOS Engine (Cloudflare Worker)│
│  api.lunaos.ai/chains/execute    │
└──────────────────────────────────┘
```

## Key Modules

### `src/lib/node-registry.ts`
Registry of all available node types (Agent, Trigger, Condition, Output).
Each node declares its `inputs`, `outputs`, and `defaultConfig`.

### `src/lib/pipeline-serializer.ts`
Converts the ReactFlow graph state (`nodes + edges`) to/from `PipelineJSON`
— the canonical format sent to the Engine API.

### `src/lib/workflow-runner.ts`
Sends `PipelineJSON` to `POST /chains/execute` and streams SSE events back.
Fires callbacks for `onNodeStart`, `onNodeComplete`, `onError`.

### `src/hooks/useWorkflowStore.ts`
Zustand store — single source of truth for the active workflow.

### `src/lib/datadog.ts`
DataDog RUM wrapper. Loaded via CDN (`window.DD_RUM`).
Tracks workflow metrics and custom RUM actions.

### `src/lib/health.ts`
Client-side health checks (API connectivity, storage, WebGL, SW).
Exposed as `window.__health()` for smoke tests.

## Data Flow

```
User drags node  →  WorkflowCanvas  →  useWorkflowStore (Zustand)
User clicks Run  →  workflow-runner.ts  →  POST api.lunaos.ai/chains/execute
                                          ←  SSE stream (node events)
                 →  useWorkflowStore (update node statuses)
                 →  Metrics.workflowExecuted() (DataDog)
```

## State Management

- **Zustand** (`useWorkflowStore`) — workflow graph, execution state, UI selection.
- No Redux; no Context API for app state.
- Component-local state (`useState`) only for transient UI (modals, tooltips).

## Security

- CSP blocks inline scripts and external origins except `api.lunaos.ai`.
- Auth token stored in `localStorage`; sent as `Authorization: Bearer` header.
- All user inputs sanitized via **DOMPurify** before rendering.
- HTTPS enforced; HSTS `max-age=31536000` on all responses.

## Performance Budget

| Metric | Target |
|--------|--------|
| FCP | < 1.5 s |
| LCP | < 2.5 s |
| CLS | < 0.1 |
| TTI | < 3.5 s |
| Bundle (gzip) | < 200 KB |

Code splitting: vendor, workflow-engine, editor chunks loaded lazily.
