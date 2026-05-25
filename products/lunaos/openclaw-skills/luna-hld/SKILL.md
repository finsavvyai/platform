---
name: luna-hld
description: Generate a high-level design document from existing code — architecture diagrams, component breakdown, data flow, tech stack rationale
homepage: https://agents.lunaos.ai
---

# Luna High-Level Design Builder

When the user wants a high-level design (HLD) document generated from their existing codebase rather than writing it from scratch, use this skill.

## How to use

1. Analyze the target codebase for:
   - Architecture patterns (monolith, microservices, serverless)
   - Major components and their responsibilities
   - Data flow between components
   - External integrations and third-party services
   - Database schemas and data models
   - Deployment topology

2. Send to the LunaOS HLD Builder agent:

```bash
curl -s -X POST https://api.lunaos.ai/agents/execute \
  -H "Authorization: Bearer $LUNAOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "agent": "hld-builder",
    "context": "<architecture analysis data>",
    "useRag": true
  }'
```

3. The agent generates:
   - **System Context Diagram** — Mermaid C4 context showing the system and its actors
   - **Component Diagram** — major components, their APIs, and relationships
   - **Data Flow Diagram** — how data moves through the system
   - **Tech Stack Summary** — technologies used with version and rationale
   - **Integration Map** — external services, APIs, and webhooks
   - **Data Model Overview** — key entities and relationships (ER diagram)
   - **Deployment Architecture** — infrastructure, hosting, and CI/CD pipeline
   - **Non-Functional Requirements** — inferred scalability, security, and performance characteristics

4. Save the output to `.luna/{project}/hld.md`.

## Environment Variables

- `LUNAOS_API_KEY`: Your LunaOS API key

## When to use

- User says "generate an HLD" or "document the architecture"
- User needs a system design overview from existing code
- Onboarding stakeholders who need to understand the system
- Preparing for an architecture review or audit

## When NOT to use

- Designing a new system from requirements (use luna-architect)
- Low-level implementation details (use luna-codemap)
