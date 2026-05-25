---
name: luna-onboarding
description: Generate an onboarding guide for your application — setup steps, first-use walkthrough, progressive disclosure, and getting-started tutorials
homepage: https://agents.lunaos.ai
---

# Luna Onboarding Guide Builder

When the user wants to generate a comprehensive onboarding guide for developers or end-users of their application, use this skill.

## How to use

1. Analyze the target codebase for:
   - Installation and setup requirements (env vars, dependencies, services)
   - First-run experience and initial configuration
   - Key features in order of importance
   - Progressive disclosure — what to show first vs later
   - Common first-time user mistakes
   - Role-based onboarding paths (developer, admin, end-user)

2. Send to the LunaOS Onboarding Builder agent:

```bash
curl -s -X POST https://api.lunaos.ai/agents/execute \
  -H "Authorization: Bearer $LUNAOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "agent": "onboarding-builder",
    "context": "<setup and feature data>",
    "useRag": true
  }'
```

3. The agent generates:
   - **Quick Start Guide** — zero-to-running in minimum steps
   - **Environment Setup** — required tools, env vars, and services
   - **First-Use Walkthrough** — step-by-step with screenshots placeholders
   - **Feature Discovery Path** — progressive disclosure sequence
   - **Common Gotchas** — frequent mistakes and their solutions
   - **Role-Based Guides** — separate paths for developer / admin / end-user
   - **Checklist** — interactive onboarding checklist for new users

4. Save the output to `.luna/{project}/onboarding.md`.

## Environment Variables

- `LUNAOS_API_KEY`: Your LunaOS API key

## When to use

- User says "create an onboarding guide" or "write a getting started"
- User wants to improve new-user experience
- Preparing for team onboarding or product launch
- User needs developer setup documentation

## When NOT to use

- Full project documentation (use luna-docs-generator)
- Architecture documentation (use luna-hld)
