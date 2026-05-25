---
name: ll-flowdocs
displayName: Luna Flow & Skills Documentation
description: Document all user flows, interaction patterns, and skills with Mermaid diagrams
version: 1.0.0
category: documentation
agent: luna-flow-documenter
parameters:
  - name: scope
    type: string
    description: Project or feature scope for flow documentation
    required: true
    prompt: true
workflow:
  - discover_user_flows_and_state_machines
  - trace_interaction_patterns
  - catalogue_skills_and_agents
  - generate_mermaid_diagrams
  - generate_flowdocs_document
output:
  - .luna/{current-project}/flowdocs.md
prerequisites:
  - source_code
---

# Luna Flow & Skills Documentation

Documents all user flows, interaction patterns, agent skills, and state machines from your codebase with Mermaid sequence and state diagrams.

## What This Command Does

This command analyses event handlers, state machines, multi-step processes, and agent skills in your code, then produces comprehensive flow documentation with visual diagrams.

## Prerequisites

Requires in your current project:
- Source code

For richer output, also provide:
- `.luna/{current-project}/requirements.md`
- `.luna/{current-project}/design.md`

## Usage Instructions

When you run this command, you'll be prompted for the scope:
- Press **ENTER** for full-project flow documentation
- Type **feature-name** for feature-specific flows

## Execution Steps

1. **Flow Discovery**: Finds all user-facing workflows and multi-step processes
2. **Interaction Tracing**: Maps buttons and actions to their effects and API calls
3. **Skills Catalogue**: Documents each agent skill with trigger, input, and output
4. **Diagram Generation**: Creates Mermaid sequence and state diagrams
5. **Document Generation**: Produces `flowdocs.md` with complete flow registry

## Output Files

Creates in your current project:
- `.luna/{current-project}/flowdocs.md`

Includes:
- Flow catalogue with entry points, steps, and exit conditions
- Mermaid sequence diagrams for key interactions
- State diagrams for multi-step processes
- Skills registry with examples
- Interaction matrix (action → effect → API call)
- Error flow diagrams
- Permission map (role → allowed flows)

## Next Steps in Workflow

After flow documentation:
```
/luna-onboarding   # Generate onboarding guide from flows
/luna-test         # Generate test cases from documented flows
```

## Tips

- Mermaid diagrams render directly in GitHub, Notion, and most documentation tools
- Flow docs are excellent source material for QA test plans
- Re-run after adding new features to keep documentation current
