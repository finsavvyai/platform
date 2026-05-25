# QueryFlux NL→SQL Service

Natural Language to SQL conversion engine powered by Java Spring Boot.

**Migrated from:** querylens-core

## Features

- 🗣️ Natural Language Processing - Convert English to SQL
- 🎯 Smart Entity Detection - Recognizes tables, columns, conditions
- 🗄️ Multi-Database Support - H2, PostgreSQL, DuckDB
- 🔌 REST API - Full programmatic access
- 📊 Dashboard Interface - Manage common queries
- 🧪 Mock Mode - Works without real data

## Tech Stack

- Java 17+
- Spring Boot
- Maven
- H2 Database (embedded)
- NLP libraries

## Quick Start

```bash
# Build the service
cd build && mvn clean install && cd ..

# Run the service
mvn spring-boot:run

# Or use quick start script
./scripts/setup/quick-start.sh
```

## API Endpoints

- **POST /api/query/natural** - Convert natural language to SQL
- **POST /api/query/execute** - Execute SQL query
- **GET /api/schema** - Get database schema
- **GET /health** - Health check

## Access Points

- Web UI: http://localhost:8080
- H2 Console: http://localhost:8080/h2-console
- API Base: http://localhost:8080/api

## Integration with QueryFlux

This service provides the NL→SQL backend for QueryFlux's AI features:
- Natural language query conversion
- Entity detection and parsing
- Query optimization suggestions
- Schema-aware query generation

## Documentation

See the main QueryFlux README and docs/querylens/ for complete documentation.
