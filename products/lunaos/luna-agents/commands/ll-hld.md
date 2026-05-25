---
name: ll-hld
displayName: Luna High-Level Design Builder
description: Generate a high-level design document from existing code — architecture, components, data flow, deployment
version: 1.0.0
category: design
agent: luna-hld-builder
parameters:
  - name: scope
    type: string
    description: Project or service scope for HLD generation
    required: true
    prompt: true
workflow:
  - analyse_architecture_patterns
  - identify_components_and_boundaries
  - map_data_flow_and_integrations
  - document_deployment_topology
  - generate_hld_document
output:
  - .luna/{current-project}/hld.md
prerequisites:
  - source_code
---

# Luna High-Level Design Builder

Generates a high-level design (HLD) document from your existing codebase — architecture diagrams, component breakdown, data flow, tech stack rationale, and deployment architecture.

## What This Command Does

This command analyses your project's architecture patterns, component boundaries, integrations, and deployment setup, then produces a comprehensive HLD document with Mermaid C4 diagrams.

## Prerequisites

Requires in your current project:
- Source code

For richer output, also provide:
- `.luna/{current-project}/requirements.md`
- `.luna/{current-project}/design.md`

## Usage Instructions

When you run this command, you'll be prompted for the scope:
- Press **ENTER** for full-project HLD
- Type **service-name** for service-specific HLD

## Execution Steps

1. **Architecture Analysis**: Identifies patterns (monolith, microservices, serverless)
2. **Component Mapping**: Documents major components and their responsibilities
3. **Data Flow**: Maps how data moves between components and external services
4. **Deployment Topology**: Documents infrastructure, hosting, and CI/CD
5. **HLD Generation**: Produces `hld.md` with Mermaid C4 diagrams

## Output Files

Creates in your current project:
- `.luna/{current-project}/hld.md`

Includes:
- System context diagram (Mermaid C4)
- Component diagram with APIs and relationships
- Data flow diagram
- Tech stack summary with rationale
- Integration map (external services, webhooks)
- ER diagram of key entities
- Deployment architecture
- Non-functional requirements analysis

## Next Steps in Workflow

After HLD generation:
```
/luna-flowdocs    # Document detailed user flows
/luna-codemap     # Generate code-level structure map
```

## Tips

- Great for onboarding stakeholders or preparing architecture reviews
- Combine with `/luna-routemap` for a complete system picture
- Review generated diagrams for accuracy — inferred architecture may need fine-tuning
