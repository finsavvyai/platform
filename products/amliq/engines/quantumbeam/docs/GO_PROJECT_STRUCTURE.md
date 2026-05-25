# QuantumBeam Go Project Structure

This document describes the Go project structure for QuantumBeam.io, following Go best practices and conventions.

## Project Overview

The QuantumBeam project uses a clean architecture approach with clear separation of concerns. The project is organized into multiple microservices, each with its own entry point in the `cmd` directory.

## Directory Structure

```
quantumbeam/
├── cmd/                     # Application entry points
│   ├── hello-server/       # Hello World API service
│   ├── api-server/         # Main API server
│   └── migrate/            # Database migration tool
├── internal/               # Private application code
│   ├── auth/              # Authentication logic
│   ├── billing/           # Billing services
│   ├── config/            # Configuration management
│   ├── database/          # Database utilities
│   ├── fraud/             # Fraud detection
│   ├── middleware/        # HTTP middleware
│   ├── models/            # Data models
│   └── monitoring/        # Monitoring and metrics
├── pkg/                   # Public library code
│   └── api/              # Reusable API components
│       ├── hello.go      # Hello API handlers
│       └── hello_test.go # Tests for hello API
├── api/                   # API definitions (OpenAPI, protobuf)
├── web/                   # Web UI assets
├── deployments/           # Deployment configurations
│   ├── docker/           # Docker configurations
│   ├── k8s/              # Kubernetes manifests
│   └── helm/             # Helm charts
├── scripts/              # Utility scripts
│   ├── build/            # Build scripts
│   ├── deploy/           # Deployment scripts
│   ├── test/             # Test scripts
│   └── maintenance/      # Maintenance scripts
├── tests/                # Integration and E2E tests
│   ├── unit/             # Unit tests
│   ├── integration/      # Integration tests
│   ├── performance/      # Performance tests
│   └── security/         # Security tests
├── config/               # Configuration files
├── migrations/           # Database migrations
├── docs/                 # Documentation
├── docker-compose.yml    # Docker Compose configuration
├── docker-compose.hello.yml # Hello service Docker Compose
├── Dockerfile           # Production Dockerfile
├── Dockerfile.hello     # Hello service Dockerfile
├── go.mod               # Go module definition
├── go.sum               # Go module checksums
├── Makefile             # Build automation
└── README.md            # Project README
```

## Key Components

### 1. cmd/ Directory
Contains the main entry points for all applications. Each subdirectory represents a separate executable.

- **hello-server**: Simple Hello World API demonstrating the basic structure
- **api-server**: Main production API server with all services
- **migrate**: Database migration utility

### 2. internal/ Directory
Contains private application code that should not be imported by other projects. This is where the business logic lives.

### 3. pkg/ Directory
Contains public library code that can be reused across different services or even by external projects.

### 4. API Design

The Hello World API provides the following endpoints:

- `GET /` - Returns a welcome message
- `GET /hello` - Returns Hello World message
- `GET /health` - Health check endpoint
- `GET /v1/hello` - Versioned API endpoint
- `GET /v1/health` - Versioned health check

### 5. Docker Integration

The project includes Docker support with:
- Multi-stage builds for optimized production images
- Non-root user execution for security
- Health checks for container orchestration
- Docker Compose configurations for local development

## Running the Application

### Local Development

1. Build the application:
```bash
go build -o bin/hello-server ./cmd/hello-server
```

2. Run the application:
```bash
./bin/hello-server
```

3. Test the endpoints:
```bash
curl http://localhost:8080
curl http://localhost:8080/health
curl http://localhost:8080/v1/hello
```

### Docker Development

1. Build with Docker:
```bash
docker build -f Dockerfile.hello -t quantumbeam-hello .
```

2. Run with Docker Compose:
```bash
docker-compose -f docker-compose.hello.yml up
```

3. Scale the service:
```bash
docker-compose -f docker-compose.hello.yml scale hello-api=3
```

## Testing

Run unit tests:
```bash
go test ./pkg/api/...
```

Run all tests with coverage:
```bash
go test -v -race -coverprofile=coverage.out ./...
go tool cover -html=coverage.out -o coverage.html
```

## Best Practices Followed

1. **Clean Architecture**: Clear separation between layers
2. **Domain-Driven Design**: Business logic isolated from infrastructure
3. **Dependency Injection**: Services are injected, not hard-coded
4. **Configuration Management**: Environment-based configuration
5. **Security**: Non-root containers, input validation
6. **Observability**: Structured logging, health checks
7. **Testing**: Unit tests with high coverage
8. **CI/CD Ready**: Dockerized, automated builds

## Next Steps

1. Add authentication middleware
2. Implement structured logging
3. Add metrics collection
4. Set up tracing
5. Add API documentation (OpenAPI/Swagger)
6. Implement rate limiting
7. Add request/response validation
8. Set up automated testing in CI/CD