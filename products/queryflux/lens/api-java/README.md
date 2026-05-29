# QueryLens API

NLP-to-SQL Engine powered by OpenAI GPT-4 - converts natural language questions to SQL queries.

## Features

- Natural language to SQL conversion using GPT-4
- Schema-aware query generation
- Confidence scoring
- Spring Boot 3.2 + Java 21 virtual threads
- RESTful API

## Quick Start

### Prerequisites

- Java 21
- Maven 3.9+
- OpenAI API key

### Setup

```bash
# Copy environment variables
cp .env.example .env

# Add your OpenAI API key to .env
export OPENAI_API_KEY=sk-your-key-here

# Build
mvn clean install

# Run
mvn spring-boot:run
```

## API Endpoints

### Generate SQL from Natural Language

```bash
POST http://localhost:8090/api/v1/nlp/query
Content-Type: application/json

{
  "question": "Show me all users who registered in the last 7 days",
  "schema": "CREATE TABLE users (id SERIAL PRIMARY KEY, email VARCHAR(255), created_at TIMESTAMP);"
}
```

Response:
```json
{
  "sql": "SELECT * FROM users WHERE created_at >= NOW() - INTERVAL '7 days' ORDER BY created_at DESC LIMIT 100;",
  "confidence": 0.9,
  "explanation": "Generated using gpt-4"
}
```

### Health Check

```bash
GET http://localhost:8090/api/v1/nlp/health
```

## Integration with QueryFlux

QueryLens API is designed to be called by:
1. **QueryFlux Backend** (Go API) - for web interface
2. **QueryFlux MCP Server** - for AI agent integration (Claude, Cursor)

## Testing

```bash
mvn test
```

## Architecture

- **Controller Layer**: REST endpoints
- **Service Layer**: OpenAI integration, SQL generation logic
- **DTO Layer**: Request/response objects
- **Config Layer**: CORS, application configuration

## Environment Variables

- `OPENAI_API_KEY`: OpenAI API key (required)
- `OPENAI_MODEL`: GPT model to use (default: gpt-4)

## Performance

- Target: < 2s response time for SQL generation
- Uses virtual threads for efficient concurrent request handling
- Connection pooling for OpenAI API calls
