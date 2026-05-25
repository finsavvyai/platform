# QueryFlux Backend

Go backend API for QueryFlux database management platform.

## Architecture

This project follows clean architecture principles with the following structure:

- `cmd/server/` - Application entry point
- `internal/config/` - Configuration management
- `internal/container/` - Dependency injection
- `internal/domain/` - Domain entities and repository interfaces
- `internal/services/` - Business logic services
- `internal/infrastructure/` - Database and external service implementations
- `internal/server/` - HTTP server and routing

## Getting Started

### Prerequisites

- Go 1.21 or higher
- PostgreSQL database
- Redis server

### Environment Variables

```bash
# Server configuration
PORT=8080
HOST=0.0.0.0
LOG_LEVEL=info
ENVIRONMENT=development

# Database configuration
DATABASE_URL=postgres://localhost:5432/queryflux?sslmode=disable
REDIS_URL=redis://localhost:6379

# JWT configuration
JWT_SECRET=your-secret-key
JWT_EXPIRATION=24

# AI Service configuration (optional)
OPENAI_API_KEY=your-openai-key
CLAUDE_API_KEY=your-claude-key

# External services (optional)
LEMONSQUEEZY_API_KEY=your-lemonsqueezy-key
LEMONSQUEEZY_STORE_ID=your-store-id
```

### Running the Application

1. Install dependencies:
```bash
go mod tidy
```

2. Run tests:
```bash
go test ./...
```

3. Start the server:
```bash
go run cmd/server/main.go
```

The server will start on `http://localhost:8080` by default.

## API Endpoints

### Health Check
- `GET /health` - Health check endpoint

### Authentication
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/logout` - User logout
- `POST /api/v1/auth/refresh` - Refresh JWT token

### Users
- `GET /api/v1/users/profile` - Get user profile
- `PUT /api/v1/users/profile` - Update user profile

### Connections
- `GET /api/v1/connections` - List database connections
- `POST /api/v1/connections` - Create new connection
- `GET /api/v1/connections/:id` - Get connection details
- `PUT /api/v1/connections/:id` - Update connection
- `DELETE /api/v1/connections/:id` - Delete connection
- `POST /api/v1/connections/:id/test` - Test connection

### Queries
- `GET /api/v1/queries` - List queries
- `POST /api/v1/queries` - Execute query
- `GET /api/v1/queries/:id` - Get query details
- `DELETE /api/v1/queries/:id` - Delete query
- `GET /api/v1/queries/history` - Get query history

### Metrics
- `GET /api/v1/metrics/connections/:id` - Get connection metrics
- `GET /api/v1/metrics/connections/:id/history` - Get metrics history

### Alerts
- `GET /api/v1/alerts` - List alerts
- `GET /api/v1/alerts/:id` - Get alert details
- `PUT /api/v1/alerts/:id/resolve` - Resolve alert
- `PUT /api/v1/alerts/:id/mute` - Mute alert

## Testing

Run all tests:
```bash
go test ./...
```

Run tests with coverage:
```bash
go test -cover ./...
```

Run tests with verbose output:
```bash
go test -v ./...
```

## Development

This is the initial implementation with core domain entities, repository interfaces, and service stubs. The following components are implemented:

### Completed
- ✅ Domain entities (User, Connection, Query, DatabaseMetrics, Alert)
- ✅ Repository interfaces
- ✅ Service interfaces
- ✅ Dependency injection container
- ✅ Configuration management
- ✅ HTTP server structure
- ✅ Comprehensive unit tests for domain entities
- ✅ Service layer tests with mocks

### TODO (Future Tasks)
- Database adapters for PostgreSQL, MySQL, MongoDB, Redis
- Repository implementations
- Authentication and JWT handling
- Query execution engine
- Real-time WebSocket support
- AI service integration
- Monitoring and alerting
- Payment integration
- SSO authentication

## Project Status

This represents **Task 1** of the electron-desktop-conversion implementation plan:
- Go backend project structure with clean architecture ✅
- Domain entities and repository interfaces ✅
- Dependency injection container and configuration management ✅
- Structured logging with logrus and environment-based configuration ✅
- Comprehensive unit tests for domain entities and interfaces ✅