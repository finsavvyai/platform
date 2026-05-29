# QueryFlux Backend

Go backend API for QueryFlux - Universal Database Adapter with AI-Native Capabilities.

## Architecture

Hexagonal (Clean) Architecture:
- **cmd/api**: Application entry point
- **internal/domain**: Business entities and logic
- **internal/port**: Interfaces (ports)
- **internal/adapter**: Implementations (database, HTTP)
- **internal/service**: Use cases and business logic
- **pkg**: Shared utilities (logger, config)

## Quick Start

```bash
# Install dependencies
go mod download

# Copy environment variables
cp .env.example .env

# Run the server
go run cmd/api/main.go
```

## API Endpoints

### Execute Query
```bash
POST /api/v1/query/execute
{
  "database_id": "db-123",
  "sql": "SELECT * FROM users LIMIT 10",
  "dry_run": false
}
```

### Get Schema
```bash
POST /api/v1/schema
{
  "database_id": "db-123"
}
```

### Health Check
```bash
GET /health
```

## Testing

```bash
go test ./... -v -cover
```

## Build

```bash
go build -o bin/queryflux cmd/api/main.go
```
