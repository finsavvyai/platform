# AMLIQ MCP Server Setup

## Overview
AMLIQ provides an MCP (Model Context Protocol) server that lets AI agents
perform sanctions screening, case management, risk assessment, and ongoing
monitoring through natural language.

## Quick Start

### 1. Add to your Claude Desktop config
Copy `mcp-config.json` to your Claude Desktop MCP settings, or add:

```json
{
  "mcpServers": {
    "aegis": {
      "command": "go",
      "args": ["run", "./cmd/mcp/main.go"],
      "env": {
        "AMLIQ_API_URL": "http://localhost:8080",
        "AMLIQ_API_KEY": "your-api-key"
      }
    }
  }
}
```

### 2. Available Tools

| Tool | Description |
|------|-------------|
| screen_entity | Screen a name against sanctions lists |
| get_screening | Retrieve screening results |
| list_cases | List compliance cases |
| get_case | Get case details with comments |
| assign_case | Assign case to an analyst |
| resolve_case | Resolve a case |
| calculate_risk | Compute composite risk score |
| create_monitor | Set up ongoing monitoring |
| list_monitors | List active monitors |

### 3. Example Agent Prompts

- "Screen John Smith against sanctions lists"
- "Show me all open compliance cases"
- "Calculate the risk score for entity ent_123 from Iran"
- "Set up daily monitoring for Acme Corp"
- "Resolve case case_456 as false positive"
