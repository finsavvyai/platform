# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

QueryLens is a Spring Boot microservice that converts natural language queries into SQL and executes them against various databases. It serves as a bridge between users asking questions in plain English and structured database queries.

## Development Commands

### Build and Run
- **Build**: `mvn clean install`
- **Run locally**: `mvn spring-boot:run`
- **Run with PostgreSQL**: `docker-compose up` (starts PostgreSQL), then `mvn spring-boot:run`

### Testing
- **Unit tests**: `mvn test`
- **API integration tests**: `./test-api.sh`
- **Advanced functionality tests**: `./advanced-test.sh`
- **NLP query tests**: `./test-nlp-queries.sh`
- **Complete test suite**: `./final-test.sh`

### Profiles
- **H2 (default)**: In-memory database for development
- **PostgreSQL**: `mvn spring-boot:run -Dspring.profiles.active=postgresql`
- **DuckDB**: `mvn spring-boot:run -Dspring.profiles.active=duckdb`

## Architecture

### Core Components
- **API Controllers** (`api/`): REST endpoints for datasources and queries
- **Query Service** (`service/QueryService.java`): Core SQL generation logic based on NLP analysis
- **NLP Client** (`service/NlpClient.java`): Communicates with external NLP service at localhost:5000, with fallback pattern matching
- **Datasource Service** (`service/DatasourceService.java`): Manages database connections dynamically

### Key Models
- **NaturalQuery**: Represents incoming natural language requests
- **NlpAnalysis**: Contains query intent, entities, and suggested table/columns
- **QueryResult**: Structured response with SQL, results, and execution metadata
- **Datasource**: Database connection configuration

### Query Processing Flow
1. Natural language input received via REST API
2. NLP analysis determines query intent (aggregation, filtering, trending, etc.)
3. QueryService generates appropriate SQL based on intent and target schema
4. SQL executed against configured datasource
5. Results returned with metadata and generated SQL

### Database Support
The service supports multiple database types through dynamic datasource management:
- PostgreSQL (production)
- H2 (development/testing)
- DuckDB (analytics)

### NLP Integration
- **Primary**: External NLP service expected at `http://localhost:5000`
- **Fallback**: Built-in pattern matching for basic query types when external service unavailable
- **Query Intents**: COUNT, SUM, AVERAGE, MAX, MIN, TREND, FILTER, GROUP_BY, JOIN, BASIC_SELECT

## Configuration

- **application.yml**: Multi-profile configuration with database settings
- **schema.sql**: Database schema initialization
- **Profiles**: h2, postgresql, duckdb with appropriate connection settings

## Testing Strategy

The project uses comprehensive shell-based API testing rather than traditional unit tests. Each test script validates different aspects:
- Basic CRUD operations on datasources
- Query execution with various natural language inputs
- Error handling and edge cases
- Multi-database compatibility

When adding new features, update the relevant test scripts and ensure all existing tests continue to pass.