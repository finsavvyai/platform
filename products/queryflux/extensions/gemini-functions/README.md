# QueryFlux Gemini Functions

QueryFlux function definitions for Google Gemini and AI Studio integration.

## Overview

This package provides QueryFlux database intelligence capabilities for:
- **Google AI Studio** - Visual function calling interface
- **Gemini API** - Programmatic access via Node.js/Python
- **Firebase Extensions** - Serverless integration

## Features

### 6 Powerful Database Functions

1. **queryflux_execute_query** - Execute SQL with safety checks
2. **queryflux_get_schema** - Database schema introspection
3. **queryflux_natural_language_query** - NLP-to-SQL conversion
4. **queryflux_create_migration** - Generate migrations from natural language
5. **queryflux_seed_test_data** - AI-generated test data
6. **queryflux_explain_query** - Query performance analysis

## Quick Start

### Installation

```bash
npm install @queryflux/gemini-functions
```

### Prerequisites

1. **Gemini API Key** - Get from https://makersuite.google.com/app/apikey
2. **QueryFlux Backend** - Running at http://localhost:8080 or deployed

### Basic Usage

```javascript
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getQueryFluxFunctions, executeQueryFluxFunction } from '@queryflux/gemini-functions';

const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Load QueryFlux functions
const functions = getQueryFluxFunctions();

// Create model with functions
const model = genai.getGenerativeModel({
  model: 'gemini-pro',
  tools: [{ functionDeclarations: functions }],
});

// Start chat
const chat = model.startChat();

// Ask Gemini to use QueryFlux
const result = await chat.sendMessage(
  'Using QueryFlux, show me the database schema for db-prod'
);

// Handle function calls
if (result.response.functionCalls) {
  for (const call of result.response.functionCalls) {
    const functionResult = await executeQueryFluxFunction(call.name, call.args);

    // Send result back to Gemini
    await chat.sendMessage([{
      functionResponse: {
        name: call.name,
        response: functionResult,
      },
    }]);
  }
}
```

## Google AI Studio Usage

### 1. Import Functions

In Google AI Studio:
1. Click "Tools" → "Functions"
2. Click "Import from JSON"
3. Upload `functions.json` from this package
4. All 6 QueryFlux functions will be available

### 2. Use in Prompts

```
User: "Using QueryFlux, show me the database schema"
Gemini: [Calls queryflux_get_schema]
User: "Execute: SELECT * FROM users LIMIT 10"
Gemini: [Calls queryflux_execute_query]
```

### 3. Function Execution

AI Studio will show the function call, you can:
- Preview arguments
- Execute manually
- See results
- Continue conversation

## Examples

### Example 1: Get Database Schema

```javascript
const result = await chat.sendMessage(
  'Using QueryFlux, get the schema for database db-prod'
);

// Gemini calls: queryflux_get_schema({ database_id: 'db-prod' })
// Returns: { tables: [...], table_count: 5 }
```

### Example 2: Execute SQL Query

```javascript
const result = await chat.sendMessage(
  'Using QueryFlux, execute: SELECT * FROM users WHERE active = true LIMIT 10'
);

// Gemini calls: queryflux_execute_query({
//   database_id: 'db-prod',
//   sql: 'SELECT * FROM users WHERE active = true LIMIT 10'
// })
// Returns: { rows: [...], row_count: 10, execution_ms: 2.5 }
```

### Example 3: Natural Language to SQL

```javascript
const result = await chat.sendMessage(
  'Using QueryFlux, convert to SQL: "Show me users who signed up last week"'
);

// Gemini calls: queryflux_natural_language_query({
//   database_id: 'db-prod',
//   question: 'Show me users who signed up last week'
// })
// Returns: { sql: 'SELECT * FROM ...', confidence: 0.95 }
```

### Example 4: Create Migration

```javascript
const result = await chat.sendMessage(
  'Using QueryFlux, create a migration to add an index on users.email'
);

// Gemini calls: queryflux_create_migration({
//   database_id: 'db-prod',
//   description: 'add an index on users.email'
// })
// Returns: { up_migration: 'CREATE INDEX ...', down_migration: 'DROP INDEX ...' }
```

### Example 5: Generate Test Data

```javascript
const result = await chat.sendMessage(
  'Using QueryFlux, generate 10 realistic test users (preview only)'
);

// Gemini calls: queryflux_seed_test_data({
//   database_id: 'db-dev',
//   table_name: 'users',
//   row_count: 10,
//   data_type: 'realistic',
//   execute: false
// })
// Returns: { sql: 'INSERT INTO users ...', executed: false }
```

### Example 6: Explain Query Performance

```javascript
const result = await chat.sendMessage(
  'Using QueryFlux, analyze this query: SELECT * FROM users WHERE email LIKE "%@example.com"'
);

// Gemini calls: queryflux_explain_query({
//   database_id: 'db-prod',
//   query: 'SELECT * FROM users WHERE email LIKE "%@example.com"'
// })
// Returns: { execution_plan: '...', optimization_suggestions: [...] }
```

## Run Example Script

```bash
# Set environment variables
cp .env.example .env
# Edit .env with your GEMINI_API_KEY

# Install dependencies
npm install

# Run example
npm run example
```

## Configuration

### Environment Variables

```env
# Required
GEMINI_API_KEY=your-gemini-api-key

# Optional
QUERYFLUX_API_URL=http://localhost:8080  # Default: http://localhost:8080
DATABASE_ID=db-dev                        # Default: db-dev
```

## API Reference

### `getQueryFluxFunctions()`

Returns array of function declarations for Gemini.

**Returns**: `FunctionDeclaration[]`

### `executeQueryFluxFunction(name, args)`

Executes a QueryFlux function and returns the result.

**Parameters**:
- `name` (string) - Function name (e.g., 'queryflux_execute_query')
- `args` (object) - Function arguments

**Returns**: `Promise<any>` - Function result

## Function Definitions

All functions are defined in `functions.json`. Import this file in:
- Google AI Studio (visual interface)
- Gemini API (programmatic)
- Firebase Extensions (serverless)
- Custom applications

## Architecture

```
┌──────────────┐
│   Gemini     │
│  AI Studio   │
└──────┬───────┘
       │ Function Calling
┌──────▼───────┐
│ QueryFlux    │
│ Functions    │ (This Package)
└──────┬───────┘
       │ HTTP
┌──────▼───────┐
│ QueryFlux    │
│ Go Backend   │
└──────┬───────┘
       │
┌──────▼───────┐
│ PostgreSQL   │
│  Database    │
└──────────────┘
```

## Deployment

### npm Registry

```bash
npm publish --access public
```

### Google Cloud Marketplace

Submit `functions.json` to Google Cloud Marketplace for discoverability.

### Firebase Extensions

Package as Firebase Extension for serverless deployment.

## Troubleshooting

### "Function not found"

Ensure `QUERYFLUX_API_URL` points to a running QueryFlux backend.

```bash
curl http://localhost:8080/health
```

### "Invalid API key"

Get a valid Gemini API key from https://makersuite.google.com/app/apikey

### "Connection refused"

Start the QueryFlux backend:

```bash
cd ../queryflux-backend
go run cmd/api/main.go
```

## Support

- **Documentation**: https://queryflux.dev/docs/gemini
- **Issues**: https://github.com/queryflux/queryflux/issues
- **Discord**: https://discord.gg/queryflux

## License

MIT

---

**Part of the QueryFlux ecosystem** - AI-powered database intelligence for Google Gemini and AI Studio.
