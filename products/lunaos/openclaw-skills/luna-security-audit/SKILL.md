---
name: luna-security-audit
description: Run a comprehensive security audit using LunaOS's 365 Security agent — OWASP, injection, auth, secrets scanning
homepage: https://agents.lunaos.ai
---

# Luna Security Audit

When the user asks for a security review, vulnerability scan, or security best practices, use this skill.

## How to use

1. Gather the code or configuration the user wants audited.

2. Send to the LunaOS Security agent:

```bash
curl -s -X POST https://api.lunaos.ai/agents/execute \
  -H "Authorization: Bearer $LUNAOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "agent": "365-security",
    "context": "<the code or config to audit>",
    "useRag": true
  }'
```

3. Parse the SSE response stream. Concatenate `text` from `chunk` events.

4. Present findings by threat level:
   - 🔴 **Critical** — SQL injection, XSS, secrets in code, auth bypass
   - 🟡 **High** — CSRF, insecure defaults, missing rate limiting
   - 🟢 **Medium** — Missing headers, weak validation, logging sensitive data

5. For each vulnerability, include: the risk, proof of concept, and remediation.

## Environment Variables

- `LUNAOS_API_KEY`: Your LunaOS API key

## When to use

- User says "security review" or "security audit"
- User asks about vulnerabilities
- User wants to check for OWASP issues
- User asks about hardening their app
- Before deploying to production

## When NOT to use

- General security questions (answer directly)
- Password help or account security
