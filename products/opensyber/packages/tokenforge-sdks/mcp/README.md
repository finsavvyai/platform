# @opensyber/tokenforge-mcp

TokenForge MCP Server — device-bound session security for AI agents. Any MCP-compatible agent gets cryptographic request signing without installing an SDK.

## Setup

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "tokenforge": {
      "command": "npx",
      "args": ["@opensyber/tokenforge-mcp"],
      "env": {
        "TOKENFORGE_API_KEY": "tf_your_api_key"
      }
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "tokenforge": {
      "command": "npx",
      "args": ["@opensyber/tokenforge-mcp"],
      "env": {
        "TOKENFORGE_API_KEY": "tf_your_api_key"
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add tokenforge -- npx @opensyber/tokenforge-mcp
```

Set the environment variable:
```bash
export TOKENFORGE_API_KEY=tf_your_api_key
```

## Tools

| Tool | Description |
|------|-------------|
| `tokenforge_bind` | Bind the agent to a session with an ECDSA device key. Call once at start. |
| `tokenforge_sign` | Get X-TF-* headers to add to an outbound HTTP request. |
| `tokenforge_status` | Check if the agent is device-bound and get the device ID. |

## How It Works

1. Agent calls `tokenforge_bind` with a session ID
2. MCP server generates an ECDSA P-256 keypair in memory
3. Public key is registered with the TokenForge API
4. For every outbound request, agent calls `tokenforge_sign`
5. MCP server returns signed headers (X-TF-Signature, X-TF-Nonce, etc.)
6. Agent includes these headers in the request
7. Server-side middleware verifies via TokenForge API

## Use Cases

- **AI coding agents** (Cursor, Claude Code) making API calls to protected endpoints
- **Autonomous agents** (LangChain, CrewAI) accessing customer APIs
- **CI/CD pipelines** that need device-bound authentication
- **Automated testing** with cryptographic session binding

## Example Agent Conversation

```
Agent: I need to call the protected API at api.example.com.
       Let me bind my session first.

[calls tokenforge_bind with sessionId: "agent_session_123"]
→ Bound. Device ID: dk_a1b2c3d4

Agent: Now let me sign the request.

[calls tokenforge_sign with sessionId: "agent_session_123"]
→ Add these headers:
  X-TF-Signature: MEUCIQDk...
  X-TF-Nonce: a8f3e2b1...
  X-TF-Timestamp: 1711234567
  X-TF-Device-ID: dk_a1b2c3d4

Agent: [makes API call with signed headers]
→ 200 OK — request verified
```

## Get Your API Key

Sign up free at [tokenforge.opensyber.cloud](https://tokenforge.opensyber.cloud). Free tier: 1,000 verifications/month.
