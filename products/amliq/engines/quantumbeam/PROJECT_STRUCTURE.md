# QuantumBeam Project Structure

This document outlines the project structure and organization following the design principles specified in the requirements.

## Design Principles

- **File Size Limit**: Maximum 400 lines per file for maintainability
- **Single Responsibility**: Each file/module has one clear purpose
- **Test-Driven Development**: All code written with tests first
- **Zero-Sync Testing**: Test folders mirror source structure (Java-style)

## Directory Structure

```
quantumbeam/
├── cmd/                          # Application entry points
│   ├── api-server/              # Main API server
│   │   └── main.go              # Server entry point (<400 lines)
│   └── migrate/                 # Database migration tool
│       └── main.go              # Migration runner (<400 lines)
├── internal/                    # Private application code
│   ├── interfaces/              # Core service interfaces
│   │   ├── authentication.go   # Auth service interfaces (<400 lines)
│   │   ├── billing.go          # Billing service interfaces (<400 lines)
│   │   └── fraud_detection.go  # Fraud detection interfaces (<400 lines)
│   └── models/                  # Data models and validation
│       ├── api_key.go          # API key model (<400 lines)
│       ├── api_key_test.go     # API key tests (<400 lines)
│       ├── errors.go           # Model validation errors (<400 lines)
│       ├── fraud_result.go     # Fraud result model (<400 lines)
│       ├── fraud_result_test.go # Fraud result tests (<400 lines)
│       ├── transaction.go      # Transaction model (<400 lines)
│       ├── transaction_test.go # Transaction tests (<400 lines)
│       ├── user.go            # User model (<400 lines)
│       └── user_test.go       # User tests (<400 lines)
├── migrations/                  # Database migration scripts
│   ├── 001_create_users_table.sql
│   ├── 002_create_api_keys_table.sql
│   ├── 003_create_transactions_table.sql
│   └── 004_create_fraud_results_table.sql
├── .github/workflows/          # CI/CD pipeline configuration
│   └── ci.yml                  # GitHub Actions workflow
├── docker-compose.yml          # Development environment setup
├── Dockerfile                  # Container configuration
├── Makefile                    # Development commands
├── go.mod                      # Go module definition
├── go.sum                      # Go module checksums
└── .golangci.yml              # Linter configuration
```

## Core Interfaces

### Fraud Detection Service
- **Primary**: Classical ML fraud detection (Random Forest / Gradient Boosting, graph-based ring detection)
- **Secondary**: Experimental quantum-simulator prototype (`services/quantum/`, local simulator only — not in the scoring path)
- **Features**: Real-time analysis, batch processing, fraud ring detection

### Authentication Service
- **JWT Authentication**: Token generation, validation, refresh
- **API Key Management**: Generation, validation, rotation, usage tracking
- **SSO Integration**: SAML 2.0 and OpenID Connect support

### Billing Service
- **Subscription Management**: LemonSqueezy integration
- **Usage Tracking**: Real-time API usage monitoring
- **Cost Analytics**: Usage analytics and cost projections

## Data Models

### Core Models
- **TransactionData**: Financial transaction with validation
- **FraudResult**: Fraud detection results with model metrics
- **User**: System user with role-based access
- **APIKey**: API authentication with usage tracking

### Validation Features
- **Input Validation**: Comprehensive validation tags
- **Custom Validation**: Business logic validation methods
- **Error Handling**: Structured error types and messages

## Development Workflow

### Test-Driven Development (TDD)
1. **Red**: Write failing test first
2. **Green**: Implement minimal code to pass
3. **Refactor**: Improve code while keeping tests green

### Testing Structure
- **Unit Tests**: Co-located with source files (`*_test.go`)
- **Integration Tests**: Separate test directories
- **Coverage**: 100% coverage requirement for business logic

### Development Commands
```bash
# Start development environment
make dev

# Run tests with coverage
make test

# Run tests in watch mode (TDD)
make test-watch

# Run linter
make lint

# Format code
make fmt

# Run all checks (CI)
make check
```

## Database Schema

### Tables
- **users**: User accounts and profiles
- **api_keys**: API authentication keys
- **transactions**: Financial transaction data
- **fraud_results**: Fraud detection results

### Features
- **Partitioning**: Transactions table partitioned by month
- **Indexing**: Optimized indexes for query performance
- **Constraints**: Data integrity and validation constraints
- **Triggers**: Automatic timestamp updates

## CI/CD Pipeline

### GitHub Actions Workflow
- **Testing**: Unit and integration tests
- **Linting**: Code quality checks
- **Security**: Vulnerability scanning
- **Coverage**: Code coverage reporting
- **Build**: Docker image creation

### Quality Gates
- All tests must pass
- Linter must pass with no warnings
- Security scan must pass
- Code coverage must meet threshold

## Next Steps

This foundation provides:
1. ✅ Go module with required dependencies
2. ✅ Docker Compose development environment
3. ✅ CI/CD pipeline configuration
4. ✅ Core data models with validation
5. ✅ Database migration system
6. ✅ Service interfaces for all major components
7. ✅ Comprehensive test structure

The project is now ready for implementing the specific service logic in subsequent tasks, following the established patterns and maintaining the <400 line file limit.