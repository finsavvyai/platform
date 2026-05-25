# Qestro MCP Server

Enable Claude and other AI agents to use Qestro testing platform natively via the Model Context Protocol (MCP).

## Features

- **Generate Tests**: AI-powered test generation from URLs or descriptions
- **Run Tests**: Execute tests and get real-time results
- **Analyze Results**: Deep failure analysis with root cause detection
- **Heal Tests**: Auto-fix tests using AI-powered self-healing
- **Project Info**: Get project overview, health metrics, and recent runs

## Installation

### 1. Build the Server

```bash
npm install
npm run build
```

### 2. Configure Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "qestro": {
      "command": "node",
      "args": ["/path/to/qestro/mcp-server/dist/index.js"],
      "env": {
        "QESTRO_API_URL": "http://localhost:3001/api",
        "QESTRO_API_TOKEN": "your_api_token_here"
      }
    }
  }
}
```

Replace:
- `QESTRO_API_URL`: Your Qestro backend API endpoint
- `QESTRO_API_TOKEN`: Your Qestro API token (get from Settings → API Keys)

### 3. Restart Claude Desktop

Close and reopen Claude Desktop to load the MCP server.

## Available Tools

### qestro_generate_tests

Generate test code from a URL or description.

```
URL: https://example.com
Description: Test the login flow with valid credentials
Test Type: e2e
Framework: playwright
```

Returns generated Playwright code and test ID.

### qestro_run_tests

Execute tests and get results.

```
Test ID: test_abc123
Environment: staging
```

Returns run status, pass/fail counts, and duration.

### qestro_analyze_results

Analyze test results and get failure details.

```
Run ID: run_xyz789
```

Returns failure summary, root causes, and healing suggestions.

### qestro_heal_test

Auto-fix a failed test.

```
Test ID: test_abc123
Failure ID: failure_001 (optional)
```

Returns suggested fixes and healed test code.

### qestro_project_info

Get project overview and metrics.

```
Project ID: project_123 (optional, uses default if not specified)
```

Returns test count, pass rate, recent runs, and health score.

## Environment Variables

- `QESTRO_API_URL`: Base URL of Qestro API (default: http://localhost:3001/api)
- `QESTRO_API_TOKEN`: Authentication token for API (required)

## Development

```bash
npm run dev          # Start development server with hot reload
npm run build        # Build TypeScript
npm run lint         # Run linter
npm test             # Run tests
```

## Architecture

The MCP server implements 5 core tools that map to Qestro's test orchestration pipeline:

```
┌─ Generate Tests ─────────┐
│ (URL → AI → Code)        │
├─ Run Tests              │
│ (Execute → Results)      │
├─ Analyze Results        │
│ (Failures → Analysis)    │
├─ Heal Test              │
│ (Failed → AI Fix)        │
└─ Project Info           │
  (Metrics → Dashboard)    │
```

Each tool:
- Validates input with Zod schemas
- Makes authenticated API calls to Qestro backend
- Returns structured results as JSON
- Handles errors gracefully with descriptive messages

## Type Safety

All tools use strict TypeScript with no `any` types:
- Input validation via Zod schemas
- Typed API responses
- Explicit error handling

## API Integration

The server communicates with Qestro backend via REST API:

- `POST /api/tests/generate` - Generate tests
- `POST /api/tests/run` - Run tests
- `GET /api/tests/runs/{runId}` - Get run status
- `GET /api/tests/runs/{runId}/analysis` - Analyze results
- `POST /api/tests/heal` - Heal failed test
- `GET /api/projects/{projectId}` - Get project info

## License

© 2026 Qestro. All rights reserved.
