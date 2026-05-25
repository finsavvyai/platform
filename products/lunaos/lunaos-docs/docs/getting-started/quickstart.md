# Quickstart

Get LunaOS running in under 2 minutes.

## Prerequisites

- **Node.js** 18+ (we recommend using [Volta](https://volta.sh/) or [nvm](https://github.com/nvm-sh/nvm))
- A LunaOS account — [Sign up free](https://agents.lunaos.ai/signup)

## Step 1: Install the CLI

```bash
npm install -g luna-agents
```

Verify the installation:

```bash
luna --version
# luna-agents v0.2.0
```

## Step 2: Authenticate

```bash
luna login
```

This opens your browser for authentication. After login, the CLI stores your token locally.

Alternatively, use an **API key**:

```bash
# Generate a key from the dashboard or API
curl -X POST https://api.lunaos.ai/api-keys \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"name": "my-cli-key"}'

# Set it in the CLI
export LUNAOS_API_KEY="lnos_live_..."
```

## Step 3: Run Your First Agent

```bash
luna run code-review --context "
function getUserById(id) {
  const query = 'SELECT * FROM users WHERE id = ' + id;
  return db.execute(query);
}
"
```

**Expected output:**

```
🔍 Code Review Agent — Analyzing...

## Security Issues

### 🔴 Critical: SQL Injection Vulnerability
**Line 2**: String concatenation in SQL query allows injection attacks.

**Fix:**
\`\`\`javascript
function getUserById(id) {
  const query = 'SELECT * FROM users WHERE id = ?';
  return db.execute(query, [id]);
}
\`\`\`

### 🟡 Warning: No Input Validation
The `id` parameter is not validated before use.

**Fix:** Add type checking and sanitization.

---
📊 Execution: 1.2s | Tokens: 847 | Cost: $0.0003
```

## Step 4: Try More Agents

```bash
# Generate tests for a file
luna run testing-validation --context "$(cat src/auth.ts)"

# Write documentation
luna run documentation --context "$(cat src/api/routes.ts)"

# Analyze requirements
luna run requirements-analyzer --context "Build a real-time chat application"
```

## Step 5: Use Agent Chains

Chain multiple agents together for complex workflows:

```bash
luna chain run code-review-pipeline --context "$(cat src/main.ts)"
```

Or define custom chains:

```json
{
  "name": "Full Review",
  "steps": [
    { "agent": "code-review", "passOutput": true },
    { "agent": "testing-validation", "passOutput": true },
    { "agent": "documentation" }
  ]
}
```

## Using the REST API Directly

If you prefer to integrate programmatically:

```bash
# Get a token
TOKEN=$(curl -s -X POST https://api.lunaos.ai/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"your-password"}' \
  | jq -r '.token')

# Run an agent (SSE stream)
curl -N -X POST https://api.lunaos.ai/agents/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "agent": "code-review",
    "context": "your code here",
    "provider": "deepseek",
    "model": "deepseek-chat"
  }'
```

## What's Next?

- **[Command Catalog →](/agents/)** — Browse all 140+ commands with examples
- **[API Reference →](/api/)** — Full REST API documentation
- **[Configuration →](/getting-started/configuration)** — Customize your setup
