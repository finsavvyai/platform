---
name: ll-graph-rag
displayName: Luna Graph RAG
description: Knowledge graph RAG — builds a code graph with community detection for 30-60% better retrieval than flat vector search
version: 1.0.0
category: search
agent: luna-graph-rag
parameters:
  - name: query
    type: string
    description: Natural language query to search the knowledge graph
    required: true
    prompt: true
  - name: depth
    type: number
    description: "Graph traversal depth: 1 (direct), 2 (neighbors), 3 (extended network)"
    required: false
    default: 2
    enum: [1, 2, 3]
workflow:
  - ensure_graph_built
  - parse_query_entities
  - traverse_graph
  - community_detection
  - rank_subgraph
  - generate_answer
output: []
prerequisites: []
---

# Luna Graph RAG

Knowledge graph RAG inspired by RuVector. Builds a knowledge graph from your codebase — files, functions, imports, types, and their relationships — then uses multi-hop traversal for 30-60% better retrieval than flat vector search.

## What This Command Does

1. **Ensure Graph Built** — builds or updates the knowledge graph from your codebase (cached)
2. **Parse Query Entities** — extracts entities and relationships from your natural language query
3. **Traverse Graph** — walks the graph from matched entities to the requested depth
4. **Community Detection** — identifies clusters of related code (Louvain algorithm)
5. **Rank Subgraph** — scores nodes by relevance to the query using PageRank + semantic similarity
6. **Generate Answer** — produces a natural language answer with graph-backed references

## Usage

```
/graph-rag "find all functions that affect billing and use the DB"
/graph-rag "what code paths lead to sending an email notification" --depth 3
/graph-rag "which components depend on the useAuth hook" --depth 1
/graph-rag "trace the data flow from webhook receipt to run completion"
```

## Graph Node Types

| Node Type | What's Indexed | Example |
|-----------|---------------|---------|
| **File** | Path, exports, size, last modified | `src/services/billing.ts` |
| **Function** | Name, params, return type, complexity | `calculateInvoice(org, period)` |
| **Type** | Name, fields, used-by | `interface Subscription` |
| **Route** | Method, path, handler, middleware | `POST /api/workflows` |
| **Component** | Name, props, hooks used | `<WorkflowEditor />` |
| **Table** | Name, columns, relations | `workflow_schedules` |

## Graph Edge Types

| Edge | Meaning | Example |
|------|---------|---------|
| **imports** | File imports from another | `billing.ts -> db.ts` |
| **calls** | Function invokes another | `createRun -> executeStep` |
| **implements** | Function implements a type | `BillingService -> IBilling` |
| **uses_table** | Function queries a table | `getSubscription -> subscriptions` |
| **renders** | Component renders another | `Dashboard -> BillingCard` |
| **depends_on** | Module depends on module | `routes/billing -> services/billing` |

## Depth Levels

| Depth | Scope | Best For |
|-------|-------|----------|
| **1** | Direct connections only | "What does this function call?" |
| **2** | Neighbors of neighbors | "What's related to billing?" (default) |
| **3** | Extended network | "Trace the full data flow end-to-end" |

## Community Detection

The graph automatically detects code communities — clusters of files and functions that work together.

```
Community: "Billing Subsystem"
  Members: billing.ts, subscriptions.ts, invoices.ts,
           BillingCard.tsx, PricingPage.tsx, billing.test.ts
  Cohesion: 0.87
```

Communities help answer broad questions like "show me everything related to billing" without manually listing files.

## Comparison with Flat Vector Search

| Feature | Flat Vector (RAG) | Graph RAG |
|---------|-------------------|-----------|
| Retrieval accuracy | Good for single-hop | 30-60% better for multi-hop |
| Relationship awareness | None | Full dependency graph |
| Community detection | None | Automatic clustering |
| "How does X affect Y" | Poor | Excellent (path finding) |
| Cold start speed | Fast (embed + search) | Slower (graph build first) |
| Index size | ~2MB per 1K files | ~5MB per 1K files |

## Graph Storage

- Graph stored in `.luna/graph/` as adjacency list JSON
- Incremental updates on file changes (no full rebuild)
- Graph build takes ~10s for 1K files, ~30s for 5K files
- Query execution: <500ms for depth 1-2, ~1s for depth 3

