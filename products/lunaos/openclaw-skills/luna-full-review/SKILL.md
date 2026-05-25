---
name: luna-full-review
description: Run a multi-agent review chain — code review → security audit → performance analysis → documentation check
homepage: https://agents.lunaos.ai
---

# Luna Full Review Chain

When the user wants a comprehensive, multi-perspective review of their code, use this skill. It runs a chain of specialized agents for a 360-degree analysis.

## How to use

1. Gather all the code the user wants reviewed.

2. Run the full review chain via LunaOS:

```bash
curl -s -X POST https://api.lunaos.ai/chains/execute \
  -H "Authorization: Bearer $LUNAOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "preset": "full-review",
    "context": "<the code to review>",
    "provider": "deepseek"
  }'
```

3. The response contains results from multiple agents. Parse the SSE stream — each agent's output is separated by `event: agent-start` events.

4. Present the combined results organized by agent:

   ### 🔍 Code Review
   Quality issues, bugs, anti-patterns

   ### 🔒 Security Audit
   Vulnerabilities, OWASP compliance

   ### ⚡ Performance
   Bottlenecks, optimization opportunities

   ### 📝 Documentation
   Missing docs, unclear APIs, naming issues

5. End with a summary score and top-3 priority actions.

## Environment Variables

- `LUNAOS_API_KEY`: Your LunaOS API key

## When to use

- User says "full review" or "comprehensive review"
- User wants multiple perspectives on their code
- Pre-production review or PR review
- User asks "is this code ready for production?"

## When NOT to use

- Quick code check (use luna-code-review instead — it's faster)
- Non-code review requests
