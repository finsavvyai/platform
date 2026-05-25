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
