# Contributing to SDLC.ai Go SDK

Thank you for your interest in contributing to the SDLC.ai Go SDK! This document provides guidelines and information for contributors.

## 🚀 Getting Started

### Prerequisites

- Go 1.21 or later
- Git
- GitHub account

### Development Setup

1. **Fork the Repository**
   ```bash
   # Fork the repository on GitHub
   git clone https://github.com/YOUR_USERNAME/sdln-sdk-go.git
   cd sdln-sdk-go
   ```

2. **Add Upstream Remote**
   ```bash
   git remote add upstream https://github.com/SDLC/sdln-sdk-go.git
   ```

3. **Create a Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

4. **Install Dependencies**
   ```bash
   go mod download
   ```

5. **Run Tests**
   ```bash
   go test ./...
   ```

## 📋 Development Guidelines

### Code Style

We follow the official Go conventions and use `golangci-lint` for code quality:

```bash
# Install golangci-lint
go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest

# Run linter
golangci-lint run
```

### Code Organization

- Follow the existing package structure
- Use meaningful names for functions, variables, and types
- Keep functions small and focused
- Use interfaces for public APIs
- Document all public functions and types

### Testing

- Write comprehensive tests for all new functionality
- Use table-driven tests for multiple scenarios
- Include both unit and integration tests
- Maintain at least 80% test coverage

```go
func TestUserService_Create(t *testing.T) {
    tests := []struct {
        name    string
        request *sdln.CreateUserRequest
        want    *sdln.User
        wantErr bool
        err     error
    }{
        {
            name: "valid user creation",
            request: &sdln.CreateUserRequest{
                Email:     "test@example.com",
                FirstName: "Test",
                LastName:  "User",
                Role:      "user",
                TenantID:  "tenant-123",
                IsActive:  true,
            },
            want: &sdln.User{
                Email:     "test@example.com",
                FirstName: "Test",
                LastName:  "User",
                Role:      "user",
                TenantID:  "tenant-123",
                IsActive:  true,
            },
            wantErr: false,
        },
        // Add more test cases
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            // Test implementation
        })
    }
}
```

## 🏗️ Project Structure

```
sdln-sdk-go/
├── pkg/
│   ├── sdln/              # Core SDK package
│   │   ├── client.go      # Main client implementation
│   │   ├── config.go      # Configuration management
│   │   ├── types.go       # Common types and interfaces
│   │   ├── errors.go      # Error types and handling
│   │   ├── interfaces.go  # Service interfaces
│   │   ├── base_service.go # Base service implementation
│   │   └── *_service.go   # Individual service implementations
│   ├── auth/              # Authentication package
│   ├── middleware/        # Middleware package
│   ├── retry/             # Retry mechanism package
│   └── http_wrappers/    # HTTP utilities package
├── examples/              # Usage examples
├── docs/                  # Documentation
├── test/                  # Test utilities
├── scripts/               # Build and deployment scripts
├── go.mod                 # Go module file
├── go.sum                 # Go checksums
├── README.md              # Project README
├── LICENSE                # License file
├── CHANGELOG.md           # Changelog
└── CONTRIBUTING.md        # This file
```

## 🔄 Pull Request Process

### Before Submitting

1. **Run Tests**
   ```bash
   go test ./...
   ```

2. **Run Linter**
   ```bash
   golangci-lint run
   ```

3. **Check Formatting**
   ```bash
   go fmt ./...
   go vet ./...
   ```

4. **Update Documentation**
   - Update relevant godoc comments
   - Update README.md if needed
   - Update CHANGELOG.md for significant changes

### Pull Request Requirements

- **Clear Title**: Use a descriptive title for your PR
- **Description**: Provide a clear description of changes
- **Tests**: Include tests for new functionality
- **Documentation**: Update documentation as needed
- **Breaking Changes**: Clearly mark any breaking changes
- **Commits**: Use conventional commit messages

### Commit Message Format

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
feat: add new feature
fix: resolve issue with user creation
docs: update API documentation
style: improve code formatting
refactor: improve error handling
test: add tests for vector service
chore: update dependencies
```

## 🧪 Testing

### Running Tests

```bash
# Run all tests
go test ./...

# Run tests with coverage
go test -cover ./...

# Run specific package tests
go test ./pkg/sdln

# Run tests with race detection
go test -race ./...

# Run benchmarks
go test -bench=. ./...
```

### Writing Tests

#### Unit Tests

Test individual functions and methods in isolation:

```go
func TestNewClient(t *testing.T) {
    config := &sdln.Config{
        BaseURL: "https://api.sdlc.cc",
        Timeout: 30 * time.Second,
    }

    client, err := sdln.NewClient(config, auth.WithAPIKey("test-key"))
    assert.NoError(t, err)
    assert.NotNil(t, client)
    assert.Equal(t, config, client.GetConfig())
}
```

#### Integration Tests

Test interactions between components:

```go
func TestClient_UsersIntegration(t *testing.T) {
    // Set up test server
    server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        // Mock implementation
    }))
    defer server.Close()

    config := &sdln.Config{
        BaseURL: server.URL,
    }

    client, err := sdln.NewClient(config, auth.WithAPIKey("test-key"))
    assert.NoError(t, err)

    // Test integration
    users, err := client.Users.List(context.Background(), &sdln.ListOptions{})
    assert.NoError(t, err)
    assert.NotNil(t, users)
}
```

#### Example Tests

Ensure examples work correctly:

```go
func ExampleNewClient() {
    // This is an example function that doubles the input
    result := double(2)
    fmt.Println(result)
    // Output: 4
}
```

## 📚 Documentation

### Godoc Comments

Document all public APIs with godoc comments:

```go
// UserService handles user-related operations including CRUD operations,
// bulk operations, and user activity tracking.
//
// Example:
//
//     client, err := sdln.NewClient(config, auth.WithAPIKey("key"))
//     if err != nil {
//         log.Fatal(err)
//     }
//
//     users, err := client.Users.List(ctx, &sdln.ListOptions{Page: 1, PageSize: 10})
//     if err != nil {
//         log.Fatal(err)
//     }
type UserService struct {
    *BaseService
}

// Create creates a new user with the provided request.
// The user will be created in the tenant specified in the request.
//
// Parameters:
//   - ctx: Context for the request
//   - req: User creation request with all required fields
//
// Returns:
//   - *User: The created user
//   - error: Any error encountered during creation
//
// Example:
//
//     user, err := client.Users.Create(ctx, &sdln.CreateUserRequest{
//         Email:     "john@example.com",
//         FirstName: "John",
//         LastName:  "Doe",
//         Role:      "user",
//         TenantID:  "tenant-123",
//         IsActive:  true,
//     })
func (s *UserService) Create(ctx context.Context, req *sdln.CreateUserRequest) (*sdln.User, error) {
    // Implementation
}
```

## 🐛 Architecture Guidelines

### Service Design

- Each service should implement the corresponding interface
- Use the `BaseService` for common functionality
- Follow consistent patterns across all services
- Include proper error handling and validation

### Error Handling

- Use structured error types
- Provide context in error messages
- Handle retry logic appropriately
- Document all possible error conditions

### Performance Considerations

- Use connection pooling for HTTP clients
- Implement proper caching where appropriate
- Avoid unnecessary allocations in hot paths
- Use goroutines efficiently

## 🔄 Release Process

### Versioning

We follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html):

- **MAJOR**: Breaking changes or new major features
- **MINOR**: New features in a backwards compatible manner
- **PATCH**: Bug fixes and minor improvements

### Release Checklist

Before creating a release:

- [ ] All tests pass
- [ ] Code coverage is maintained
- [ ] Documentation is updated
- [ ] CHANGELOG.md is updated
- [ ] Version number is updated
- [ ] Git tag is created
- [ ] Release notes are prepared

## 🤝 Community

### Code Review

All changes require code review before merging:

- **Functionality**: Does the code work as intended?
- **Performance**: Is the code efficient?
- **Security**: Are there any security concerns?
- **Style**: Does the code follow Go conventions?
- **Tests**: Are tests comprehensive?
- **Documentation**: Is the code well documented?

### Issue Reporting

When reporting issues:

- Use the GitHub issue tracker
- Provide a clear and descriptive title
- Include steps to reproduce
- Include environment information
- Provide expected vs actual behavior

### Feature Requests

When requesting features:

- Use the GitHub issue tracker with "enhancement" label
- Provide a clear description of the feature
- Explain the use case and motivation
- Consider implementation complexity

## 📞 Getting Help

- **Documentation**: Check the [README](./README.md) and [API docs](https://pkg.go.dev/github.com/SDLC/sdln-sdk-go)
- **Issues**: [Open an issue](https://github.com/SDLC/sdln-sdk-go/issues)
- **Discussions**: [GitHub Discussions](https://github.com/SDLC/sdln-sdk-go/discussions)
- **Email**: support@sdlc.cc

## 📄 License

By contributing to this project, you agree that your contributions will be licensed under the MIT License.