#!/bin/bash
# Consolidation Script: querylens → QueryFlux

set -e  # Exit on error

SOURCE="/Users/shaharsolomon/dev/projects/03_Enterprize_application/querylens/querylens-core"
TARGET="/Users/shaharsolomon/dev/projects/03_Enterprize_application/queryflux"

echo "🚀 Starting querylens Consolidation into QueryFlux..."
echo "Source: $SOURCE"
echo "Target: $TARGET"
echo ""

# Check if source exists
if [ ! -d "$SOURCE" ]; then
    echo "❌ Error: Source directory not found: $SOURCE"
    exit 1
fi

# Create target directories
echo "📁 Creating target directory structure..."
mkdir -p "$TARGET"/backend/{nlp-service,java}

# Copy Java NL→SQL Service
echo "☕ Copying Java NL→SQL service..."
if [ -d "$SOURCE/src" ]; then
    cp -r "$SOURCE/src" "$TARGET/backend/nlp-service/" 2>/dev/null || echo "⚠️  src directory not found"
fi

# Copy Maven build configuration
echo "📦 Copying Maven configuration..."
if [ -d "$SOURCE/build" ]; then
    cp -r "$SOURCE/build" "$TARGET/backend/nlp-service/" 2>/dev/null || echo "⚠️  build directory not found"
fi

# Copy scripts
echo "📜 Copying scripts..."
if [ -d "$SOURCE/scripts" ]; then
    cp -r "$SOURCE/scripts" "$TARGET/backend/nlp-service/" 2>/dev/null || echo "⚠️  scripts directory not found"
fi

# Copy SQL files and data
echo "🗄️  Copying SQL files..."
if [ -d "$SOURCE/sql" ]; then
    cp -r "$SOURCE/sql" "$TARGET/backend/nlp-service/" 2>/dev/null || echo "⚠️  sql directory not found"
fi

# Copy configuration
echo "⚙️  Copying configuration files..."
if [ -d "$SOURCE/config" ]; then
    cp -r "$SOURCE/config" "$TARGET/backend/nlp-service/" 2>/dev/null || echo "⚠️  config directory not found"
fi

# Copy deployment files
echo "🐳 Copying deployment configurations..."
if [ -d "$SOURCE/deployment" ]; then
    cp -r "$SOURCE/deployment" "$TARGET/backend/nlp-service/" 2>/dev/null || echo "⚠️  deployment directory not found"
fi

# Copy documentation
echo "📚 Copying documentation..."
if [ -d "$SOURCE/docs" ]; then
    mkdir -p "$TARGET/docs/querylens"
    cp -r "$SOURCE/docs"/* "$TARGET/docs/querylens/" 2>/dev/null || echo "⚠️  docs not found"
fi

# Copy README
[ -f "$SOURCE/README.md" ] && cp "$SOURCE/README.md" "$TARGET/backend/nlp-service/README.original.md" || echo "⚠️  README.md not found"

# Create new README for NLP service
cat > "$TARGET/backend/nlp-service/README.md" << 'EOF'
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
EOF

# Create integration guide
cat > "$TARGET/backend/nlp-service/INTEGRATION.md" << 'EOF'
# Integrating NL→SQL Service with QueryFlux

## Architecture

```
QueryFlux Frontend (React)
    ↓
QueryFlux API (Node.js)
    ↓
NL→SQL Service (Java Spring Boot) ← This service
    ↓
Database Connections
```

## Setup

1. **Start NL→SQL Service**
   ```bash
   cd backend/nlp-service
   mvn spring-boot:run
   ```

2. **Configure QueryFlux to use NL→SQL Service**
   ```typescript
   // In QueryFlux frontend config
   const NLP_SERVICE_URL = 'http://localhost:8080';
   ```

3. **Use in QueryFlux**
   ```typescript
   // Convert natural language to SQL
   const response = await fetch(`${NLP_SERVICE_URL}/api/query/natural`, {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       query: "Show me all users who signed up last month",
       schema: databaseSchema
     })
   });
   
   const { sql } = await response.json();
   ```

## API Integration Points

### 1. Natural Language Query
**Endpoint:** `POST /api/query/natural`
**Use in:** AI Query Assistant, Voice Commands

### 2. Entity Detection
**Endpoint:** `POST /api/query/analyze`
**Use in:** Query Autocomplete, Schema Suggestions

### 3. Query Optimization
**Endpoint:** `POST /api/query/optimize`
**Use in:** Query Performance Analyzer

## Configuration

Edit `config/application.properties`:
```properties
# Server configuration
server.port=8080

# Database configuration
spring.datasource.url=jdbc:h2:mem:testdb
spring.datasource.driverClassName=org.h2.Driver

# NLP configuration
nlp.model.path=models/
nlp.confidence.threshold=0.7
```

## Testing

```bash
# Test NL→SQL conversion
curl -X POST http://localhost:8080/api/query/natural \
  -H "Content-Type: application/json" \
  -d '{"query": "show all users", "schema": {...}}'

# Test entity detection
curl -X POST http://localhost:8080/api/query/analyze \
  -H "Content-Type: application/json" \
  -d '{"query": "users from last month"}'
```

## Deployment

The NL→SQL service can be deployed:
- As a microservice alongside QueryFlux
- In the same container (monolith)
- As a serverless function

See `deployment/` for Docker and Kubernetes configurations.
EOF

echo ""
echo "✅ querylens consolidation complete!"
echo ""
echo "📊 Migration Summary:"
echo "  - Java NL→SQL service: Copied to backend/nlp-service/"
echo "  - Maven configuration: Copied"
echo "  - Scripts and utilities: Copied"
echo "  - SQL files: Copied"
echo "  - Documentation: Copied to docs/querylens/"
echo "  - Integration guide: Created"
echo ""
echo "📍 Files migrated to: $TARGET"
echo ""
