---
name: ll-nexa
displayName: Luna Nexa AI
description: Nexa-powered semantic code analysis — AI review, bug detection, architecture recommendations
version: 1.0.0
category: ai
agent: luna-rag-enhanced
parameters:
  - name: action
    type: string
    description: Action (review, bugs, explain, recommend, chat, debt)
    required: true
    prompt: true
  - name: target
    type: string
    description: File path, directory, or question
    required: true
    prompt: true
workflow:
  - connect_nexa_rag_server
  - index_codebase_embeddings
  - execute_ai_action
  - generate_nexa_report
output:
  - .luna/{current-project}/nexa-report.md
prerequisites: []
---

# Luna Nexa AI

Semantic code intelligence powered by Nexa embeddings + ChromaDB + LangChain.

## What This Command Does

Connects to the Nexa RAG MCP server for AI-powered code analysis using vector embeddings and LangChain chains.

## Actions

| Action | What It Does |
|--------|-------------|
| `review` | AI code review with semantic understanding of patterns |
| `bugs` | Bug detection — finds potential issues across codebase |
| `explain` | Explain code in natural language with context |
| `recommend` | Architecture recommendations based on codebase analysis |
| `chat` | Conversational codebase Q&A with memory |
| `debt` | Tech debt detection and prioritized cleanup plan |
| `test-gen` | Auto-generate tests from code analysis |
| `doc-gen` | Auto-generate documentation from code |

## Usage

```
/nexa review src/services/           # AI code review
/nexa bugs src/                      # Find potential bugs
/nexa explain src/auth/middleware.ts  # Explain code
/nexa recommend                      # Architecture recommendations
/nexa chat "how does billing work?"  # Codebase Q&A
/nexa debt                           # Tech debt analysis
/nexa test-gen src/services/auth.ts  # Generate tests
/nexa doc-gen src/routes/            # Generate docs
```

## Architecture

```
Your code -> Nexa Embeddings (bge-base-en-v1.5)
  -> ChromaDB vector store
  -> LangChain semantic search
  -> AI analysis chain
  -> Structured report
```

## Features

- Semantic code search (not just text matching)
- Cross-file relationship understanding
- Conversation memory for follow-up questions
- Supports 15+ AI tools via MCP protocol
- Indexes up to 1,000 files (free) / unlimited (pro)
