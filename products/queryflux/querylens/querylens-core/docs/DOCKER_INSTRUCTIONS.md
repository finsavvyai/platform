# Docker Instructions for QueryLens

## Issue Identified
The quick start script fails because the `pom.xml` is located in the `build/` directory, not the project root. Scripts run from the wrong directory.

## Docker Setup Options

### Option 1: PostgreSQL with Docker Compose (Recommended)

1. **Start PostgreSQL database**:
```bash
cd deployment
docker-compose up -d
```

2. **Build and run the application**:
```bash
cd ../build
mvn clean compile
mvn spring-boot:run -Dspring.profiles.active=postgresql
```

3. **Access the application**:
   - Web UI: http://localhost:8080
   - H2 Console: http://localhost:8080/h2-console (if using H2)

4. **Stop the services**:
```bash
cd deployment
docker-compose down
```

### Option 2: Complete Docker Application (Requires Dockerfile)

Currently, there's only a PostgreSQL Dockerfile. To run the entire application in Docker, you would need:

1. **Create application Dockerfile**:
```dockerfile
FROM openjdk:21-jdk-slim

WORKDIR /app

# Copy Maven files
COPY build/pom.xml .
COPY build/src ./src

# Install Maven
RUN apt-get update && apt-get install -y maven

# Build application
RUN mvn clean package -DskipTests

# Expose port
EXPOSE 8080

# Run application
CMD ["java", "-jar", "target/querylens-core-0.1.0-SNAPSHOT.jar"]
```

2. **Update docker-compose.yml**:
```yaml
version: "3.8"

services:
  postgres:
    image: postgres:14
    container_name: querylens-postgres
    environment:
      POSTGRES_DB: querylens
      POSTGRES_USER: querylens
      POSTGRES_PASSWORD: querylens
    ports:
      - "5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data
    restart: unless-stopped

  querylens:
    build: 
      context: ..
      dockerfile: deployment/Dockerfile
    container_name: querylens-app
    ports:
      - "8080:8080"
    environment:
      - SPRING_PROFILES_ACTIVE=postgresql
      - SPRING_DATASOURCE_URL=jdbc:postgresql://postgres:5432/querylens
      - SPRING_DATASOURCE_USERNAME=querylens
      - SPRING_DATASOURCE_PASSWORD=querylens
    depends_on:
      - postgres
    restart: unless-stopped

volumes:
  postgres-data:
```

### Option 3: Fix Quick Start Script

To fix the existing quick start issue:

**Update `scripts/setup/quick-start.sh`**:
```bash
# Change line 43 from:
mvn clean compile -q

# To:
cd build && mvn clean compile -q && cd ..

# Change line 68 from:
mvn spring-boot:run

# To:
cd build && mvn spring-boot:run
```

## Current Working Commands

### Using H2 (In-memory database)
```bash
cd build
mvn clean compile
mvn spring-boot:run
```

### Using PostgreSQL
```bash
# Start PostgreSQL
cd deployment
docker-compose up -d

# Run application
cd ../build
mvn spring-boot:run -Dspring.profiles.active=postgresql
```

### Using DuckDB
```bash
cd build
mvn spring-boot:run -Dspring.profiles.active=duckdb
```

## Testing the Setup

### API Test
```bash
curl -X POST "http://localhost:8080/api/query/execute" \
  -H "Content-Type: application/json" \
  -d '{"text": "Find all active cards", "datasourceId": 1}'
```

### Run Full Test Suite
```bash
cd scripts/tests
./final-test.sh
```

## Troubleshooting

### Port 8080 in Use
```bash
# Kill existing process
lsof -ti:8080 | xargs kill -9
```

### PostgreSQL Connection Issues
```bash
# Check PostgreSQL status
docker ps | grep postgres

# View PostgreSQL logs
docker logs querylens-postgres
```

### Build Issues
```bash
# Ensure you're in the build directory
cd build
mvn clean install -DskipTests
```

## Quick Summary

**Issue**: pom.xml is in `build/` directory, not project root
**Solution**: Always run Maven commands from the `build/` directory
**Docker**: Use `docker-compose up -d` for PostgreSQL, then run app from `build/` directory