---
name: ll-onboarding
displayName: Luna Onboarding Guide Builder
description: Generate an onboarding guide — setup steps, first-use walkthrough, progressive disclosure, role-based paths
version: 1.0.0
category: documentation
agent: luna-onboarding-builder
parameters:
  - name: scope
    type: string
    description: Project or audience scope for onboarding guide
    required: true
    prompt: true
workflow:
  - analyse_setup_requirements
  - trace_first_use_experience
  - define_progressive_disclosure_path
  - identify_common_gotchas
  - generate_onboarding_document
output:
  - .luna/{current-project}/onboarding.md
prerequisites:
  - source_code
  - .luna/{current-project}/requirements.md (optional)
---

# Luna Onboarding Guide Builder

Generates a comprehensive onboarding guide from your codebase covering setup, first-use walkthrough, feature discovery, and role-based paths.

## What This Command Does

This command analyses your project's installation requirements, initial configuration, key features, and common pitfalls, then produces role-based onboarding guides with step-by-step instructions.

## Prerequisites

Requires in your current project:
- Source code

Optional for richer output:
- `.luna/{current-project}/requirements.md`
- `.luna/{current-project}/design.md`

## Usage Instructions

When you run this command, you'll be prompted for the scope:
- Press **ENTER** for full-project onboarding
- Type **developer** / **admin** / **user** for role-specific guides

## Execution Steps

1. **Setup Analysis**: Identifies tools, env vars, dependencies, and services needed
2. **First-Use Trace**: Maps the initial user experience step-by-step
3. **Progressive Disclosure**: Defines feature discovery order by importance
4. **Gotcha Detection**: Finds common first-time mistakes from the codebase
5. **Guide Generation**: Produces `onboarding.md` with checklists and paths

## Output Files

Creates in your current project:
- `.luna/{current-project}/onboarding.md`

Includes:
- Quick Start Guide (zero-to-running)
- Environment setup checklist
- First-use walkthrough with screenshot placeholders
- Feature discovery path (progressive disclosure)
- Common gotchas and solutions
- Role-based guides (developer / admin / end-user)
- Interactive onboarding checklist

## Next Steps in Workflow

After onboarding guide:
```
/luna-docs         # Full project documentation
/luna-flowdocs     # Detailed flow documentation
```

## Tips

- Onboarding guides reduce support burden and improve adoption
- Include the guide in your repo's CONTRIBUTING.md or docs/ directory
- Test the guide with a fresh environment to verify completeness
