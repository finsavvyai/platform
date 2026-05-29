# JWT Authentication System for SDLC.ai

This comprehensive JWT Authentication System provides secure, production-ready authentication and authorization for the SDLC.ai platform with the following key features:

## 🚀 Features

### Core Authentication
- **JWT Token Management**: Secure token generation, validation, and refresh
- **Multi-tenant Support**: Isolated authentication per tenant
- **Role-based Access Control (RBAC)**: Fine-grained permissions system
- **Device Fingerprinting**: Enhanced security through device tracking
- **Session Management**: Secure session handling with timeout support

### Security Features
- **mTLS Support**: Mutual TLS for service-to-service communication
- **Certificate Auto-rotation**: Automatic certificate renewal (90-day cycle)
- **Secure Credential Storage**: Encrypted storage with KMS integration
- **Token Blacklisting**: Secure token revocation mechanism
- **Multi-Factor Authentication (MFA)**: TOTP, SMS, and email support
- **Account Lockout**: Brute force protection with configurable thresholds

### Monitoring & Auditing
- **Comprehensive Audit Logging**: All authentication events logged
- **Security Event Tracking**: Real-time security monitoring
- **Performance Metrics**: Authentication performance and usage analytics
- **Failed Login Tracking**: Security monitoring and alerting

## 📋 Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [API Documentation](#api-documentation)
5. [Security Features](#security-features)
6. [Integration Guide](#integration-guide)
7. [Testing](#testing)
8. [Deployment](#deployment)
9. [Troubleshooting](#troubleshooting)

## 🏗️ Architecture Overview

### System Components

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Client App    │    │   Auth Service   │    │   Resource API  │
│                 │    │                  │    │                 │
│ - Web Browser   │◄──►│ - JWT Auth       │◄──►│ - Protected     │
│ - Mobile App    │    │ - User Management│    │   Resources     │
│ - CLI Tool      │    │ - Session Mgmt    │    │ - Business Logic│
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Token Store   │    │   PostgreSQL DB  │    │   Redis Cache   │
│                 │    │                  │    │                 │
│ - Access Tokens │    │ - Users          │    │ - Blacklist     │
│ - Refresh Tokens│    │ - Tenants        │    │ - Sessions      │
│ - API Keys      │    │ - Sessions       │    │ - Rate Limits   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### Technology Stack

- **Go (Golang)**: Core authentication service
- **Python (FastAPI)**: Async middleware and libraries
- **PostgreSQL**: Primary database with Row Level Security
- **Redis**: Token blacklist and session storage
- **JWT**: JSON Web Tokens for stateless authentication
- **mTLS**: Mutual TLS for service communication

## 🛠️ Installation

### Prerequisites

- Go 1.21+ or Python 3.9+
- PostgreSQL 13+
- Redis 6+
- Docker (optional)

### Database Setup

1. **Create database**:
   ```sql
   CREATE DATABASE sdlc_platform;
   CREATE USER sdlc_user WITH PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE sdlc_platform TO sdlc_user;
   ```

2. **Run migrations**:
   ```bash
   # Run core schema migrations
   psql -d sdlc_platform -f database/schema/01_extensions.sql
   psql -d sdlc_platform -f database/schema/02_types_and_functions.sql
   psql -d sdlc_platform -f database/schema/03_core_tables.sql
   psql -d sdlc_platform -f database/schema/04_policy_and_security_tables.sql
   
   # Run authentication system migrations
   psql -d sdlc_platform -f database/migrations/002_authentication_system.sql
   ```

### Go Service Setup

1. **Install dependencies**:
   ```bash
   cd services/gateway
   go mod download
   ```

2. **Generate JWT keys**:
   ```bash
   # Generate RSA key pair
   openssl genrsa -out private.pem 2048
   openssl rsa -in private.pem -pubout -out public.pem
   ```

3. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Run the service**:
   ```bash
   go run cmd/auth-server/main.go
   ```

### Python Setup

1. **Install dependencies**:
   ```bash
   cd services/rag
   pip install -r requirements.txt
   ```

2. **Configure environment**:
   ```bash
   export JWT_SECRET_KEY="your-secret-key"
   export REDIS_URL="redis://localhost:6379"
   export DATABASE_URL="postgresql://user:pass@localhost/sdlc_platform"
   ```

## ⚙️ Configuration

### Environment Variables

#### Database Configuration
```bash
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=sdlc_user
DB_PASSWORD=your_password
DB_NAME=sdlc_platform
DB_SSL_MODE=disable
```

#### Redis Configuration
```bash
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=
REDIS_DB=0
```

#### JWT Configuration
```bash
JWT_ALGORITHM=RS256
JWT_PUBLIC_KEY_PATH=/path/to/public.pem
JWT_PRIVATE_KEY_PATH=/path/to/private.pem
JWT_ACCESS_TOKEN_TTL=1h
JWT_REFRESH_TOKEN_TTL=720h
JWT_ISSUER=sdlc-platform
```

#### Security Configuration
```bash
BCRYPT_COST=12
MAX_LOGIN_ATTEMPTS=5
ACCOUNT_LOCKOUT_DURATION=15m
SESSION_TIMEOUT=24h
MFA_REQUIRED=false
ENABLE_DEVICE_TRACKING=true
ENABLE_AUDIT_LOGGING=true
```

#### mTLS Configuration
```bash
MTLS_ENABLED=false
MTLS_AUTO_ROTATE=true
MTLS_ROTATION_INTERVAL=2160h
MTLS_CERT_DIRECTORY=./certs
```

### Configuration File Example

```yaml
server:
  host: "0.0.0.0"
  port: 8080
  read_timeout: 30
  write_timeout: 30
  idle_timeout: 120

database:
  host: "localhost"
  port: 5432
  username: "sdlc_user"
  password: "your_password"
  database: "sdlc_platform"
  ssl_mode: "disable"
  max_open_conns: 100
  max_idle_conns: 10

jwt:
  algorithm: "RS256"
  public_key_path: "./certs/jwt-public.pem"
  private_key_path: "./certs/jwt-private.pem"
  access_token_ttl: "1h"
  refresh_token_ttl: "720h"
  issuer: "sdlc-platform"

security:
  bcrypt_cost: 12
  max_login_attempts: 5
  account_lockout_duration: "15m"
  session_timeout: "24h"
  password_policy:
    min_length: 8
    require_uppercase: true
    require_lowercase: true
    require_numbers: true
    require_symbols: false
    max_age_days: 90
  mfa_required: false
  enable_device_tracking: true
  enable_audit_logging: true
  security_headers: true
  brute_force_protection: true

mtls:
  enabled: false
  auto_rotate: true
  rotation_interval: "2160h"
  rotation_threshold: 0.8
  cert_directory: "./certs"
  backup_directory: "./certs/backup"
```

## 📚 API Documentation

### Authentication Endpoints

#### Register User
```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "first_name": "John",
  "last_name": "Doe",
  "email": "john.doe@example.com",
  "password": "Password123!",
  "confirm_password": "Password123!",
  "tenant_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response**:
```json
{
  "success": true,
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "email": "john.doe@example.com",
    "role": "user",
    "email_verified": false,
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

#### Login
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "john.doe@example.com",
  "password": "Password123!",
  "device_fingerprint": "device123",
  "remember_me": false
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "email": "john.doe@example.com",
      "role": "user"
    },
    "tokens": {
      "access_token": "eyJhbGciOiJSUzI1NiIs...",
      "refresh_token": "eyJhbGciOiJSUzI1NiIs...",
      "expires_at": "2024-01-01T01:00:00Z",
      "token_type": "Bearer"
    },
    "session_id": "550e8400-e29b-41d4-a716-446655440002",
    "requires_mfa": false
  }
}
```

#### Refresh Token
```http
POST /api/v1/auth/refresh
Content-Type: application/json
Authorization: Bearer <refresh_token>

{
  "refresh_token": "eyJhbGciOiJSUzI1NiIs...",
  "device_fingerprint": "device123"
}
```

#### Logout
```http
POST /api/v1/auth/logout
Content-Type: application/json

{
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJSUzI1NiIs..."
}
```

### Protected Endpoints

#### Get Current User
```http
GET /api/v1/auth/me
Authorization: Bearer <access_token>
```

#### Change Password
```http
POST /api/v1/auth/change-password
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "current_password": "OldPassword123!",
  "new_password": "NewPassword123!",
  "confirm_password": "NewPassword123!"
}
```

### API Key Management

#### Create API Key
```http
POST /api/v1/keys
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "name": "My API Key",
  "permissions": ["documents:read", "documents:write"],
  "expires_at": "2024-12-31T23:59:59Z"
}
```

#### List API Keys
```http
GET /api/v1/keys
Authorization: Bearer <access_token>
```

### Admin Endpoints

#### List Users (Admin)
```http
GET /api/v1/admin/users
Authorization: Bearer <admin_access_token>
```

#### Get Security Events (Admin)
```http
GET /api/v1/admin/security-events
Authorization: Bearer <admin_access_token>
```

## 🔒 Security Features

### JWT Token Security

- **Cryptographically Secure**: Uses RSA-256 or ECDSA signatures
- **Short-lived Access Tokens**: 1-hour default TTL
- **Long-lived Refresh Tokens**: 30-day default TTL
- **Token Rotation**: Automatic refresh with secure token invalidation
- **Device Binding**: Optional device fingerprint verification

### Multi-Factor Authentication

#### Supported MFA Methods
- **TOTP**: Time-based One-Time Password (Google Authenticator)
- **SMS**: SMS-based verification codes
- **Email**: Email-based verification codes

#### MFA Setup Flow
1. User enables MFA in settings
2. System generates secret key
3. User scans QR code with authenticator app
4. User enters verification code to confirm setup
5. Backup codes are generated and displayed

### Account Security

#### Failed Login Protection
- Configurable maximum attempts (default: 5)
- Automatic account lockout
- Configurable lockout duration (default: 15 minutes)
- IP-based rate limiting

#### Password Security
- Argon2ID hashing algorithm
- Configurable password policies
- Password history tracking
- Secure password reset flow

### mTLS for Service Communication

#### Certificate Management
- Automatic certificate generation
- 90-day auto-rotation cycle
- Certificate backup and recovery
- Certificate validation and pinning

#### Configuration Example
```go
config := mtls.MTLSConfig{
    Enabled:           true,
    AutoRotate:        true,
    RotationInterval:  90 * 24 * time.Hour,
    RotationThreshold: 0.8,
    CertDirectory:     "./certs",
    BackupDirectory:   "./certs/backup",
}

manager, err := mtls.NewCertificateManager(config, logger)
```

## 🔌 Integration Guide

### Go Integration

#### Middleware Setup
```go
import (
    "github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/middleware"
    "github.com/sdlc-ai/platform/services/gateway/internal/domain/services"
)

// Initialize JWT service
jwtService := services.NewJWTService(
    signingKey,
    jwa.RS256,
    "sdlc-platform",
    1*time.Hour,
    30*24*time.Hour,
    blacklistService,
    logger,
)

// Create authentication middleware
authMiddleware := middleware.NewAuthMiddleware(
    jwtService,
    logger,
    middleware.DefaultAuthMiddlewareOptions(),
)

// Apply to router
r.Use(authMiddleware.Middleware)
```

#### Protected Route Example
```go
r.Get("/protected", func(w http.ResponseWriter, r *http.Request) {
    authContext, ok := middleware.GetUserContext(r)
    if !ok {
        http.Error(w, "Unauthorized", http.StatusUnauthorized)
        return
    }
    
    // Use authenticated user information
    fmt.Fprintf(w, "Hello, %s!", authContext.Email)
}))
```

#### Role-based Access Control
```go
// Require specific role
r.With(authMiddleware.RoleMiddleware("admin")).Get("/admin", adminHandler)

// Require specific permissions
r.With(authMiddleware.PermissionMiddleware("users:write")).Post("/users", createUserHandler)
```

### Python/FastAPI Integration

#### Async Middleware Setup
```python
from fastapi import FastAPI, Depends
from app.middleware.auth import AsyncAuthenticationMiddleware, JWTService, AuthConfig

app = FastAPI()

# Initialize auth components
config = AuthConfig(
    jwt_secret_key="your-secret-key",
    redis_url="redis://localhost:6379",
    audit_logging_enabled=True,
)

jwt_service = JWTService(config)

# Add middleware
app.add_middleware(AsyncAuthenticationMiddleware, config=config, jwt_service=jwt_service)

@app.on_event("startup")
async def startup_event():
    await jwt_service.initialize()
```

#### Protected Route Example
```python
from fastapi import Depends, HTTPException
from app.middleware.auth import get_current_user, require_permissions

@app.get("/protected")
@require_permissions("documents:read")
async def protected_route(
    current_user: AuthContext = Depends(get_current_user),
):
    return {"message": f"Hello, {current_user.email}!"}

@app.get("/admin")
@require_permissions("admin:*")
async def admin_route(
    current_user: AuthContext = Depends(get_current_user),
):
    return {"message": "Admin access granted"}
```

### Client Integration

#### JavaScript/TypeScript Client
```typescript
class AuthClient {
    constructor(private baseURL: string, private storage: Storage) {}

    async login(email: string, password: string) {
        const response = await fetch(`${this.baseURL}/api/v1/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        if (data.success) {
            this.storage.setItem('access_token', data.data.tokens.access_token);
            this.storage.setItem('refresh_token', data.data.tokens.refresh_token);
        }
        return data;
    }

    async refreshToken() {
        const refreshToken = this.storage.getItem('refresh_token');
        const response = await fetch(`${this.baseURL}/api/v1/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: refreshToken })
        });
        
        const data = await response.json();
        if (data.success) {
            this.storage.setItem('access_token', data.tokens.access_token);
            this.storage.setItem('refresh_token', data.tokens.refresh_token);
        }
        return data;
    }

    getAuthHeaders() {
        const token = this.storage.getItem('access_token');
        return token ? { 'Authorization': `Bearer ${token}` } : {};
    }
}
```

## 🧪 Testing

### Unit Tests

#### Running Tests
```bash
# Go tests
cd services/gateway
go test ./...

# Python tests
cd services/rag
pytest tests/
```

#### Test Coverage
```bash
# Go test coverage
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out

# Python test coverage
pytest --cov=app tests/
```

### Integration Tests

#### Authentication Flow Test
```go
func TestAuthenticationFlow(t *testing.T) {
    // Register user
    regReq := &RegistrationRequest{
        FirstName:       "Test",
        LastName:        "User",
        Email:           "test@example.com",
        Password:        "Password123!",
        ConfirmPassword: "Password123!",
    }
    
    user, err := authService.RegisterUser(ctx, regReq)
    require.NoError(t, err)
    require.NotNil(t, user)
    
    // Login
    authReq := &AuthenticationRequest{
        Email:    "test@example.com",
        Password: "Password123!",
    }
    
    authResp, err := authService.Authenticate(ctx, authReq)
    require.NoError(t, err)
    require.NotNil(t, authResp)
    require.NotNil(t, authResp.TokenPair)
    
    // Validate token
    tokenInfo, err := jwtService.ValidateToken(ctx, authResp.TokenPair.AccessToken, "access")
    require.NoError(t, err)
    require.Equal(t, user.ID, tokenInfo.UserID)
    
    // Refresh token
    newTokens, err := authService.RefreshToken(ctx, authResp.TokenPair.RefreshToken, "")
    require.NoError(t, err)
    require.NotEqual(t, authResp.TokenPair.AccessToken, newTokens.AccessToken)
    
    // Logout
    err = authService.Logout(ctx, authResp.TokenPair.AccessToken, authResp.TokenPair.RefreshToken, user.ID)
    require.NoError(t, err)
}
```

### Load Testing

#### Using k6
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
    stages: [
        { duration: '2m', target: 100 },
        { duration: '5m', target: 100 },
        { duration: '2m', target: 0 },
    ],
};

export default function() {
    const payload = JSON.stringify({
        email: `test${__VU}@example.com`,
        password: 'Password123!',
    });
    
    const params = {
        headers: {
            'Content-Type': 'application/json',
        },
    };
    
    let response = http.post('http://localhost:8080/api/v1/auth/login', payload, params);
    check(response, {
        'login status is 200': (r) => r.status === 200,
        'login response time < 500ms': (r) => r.timings.duration < 500,
    });
    
    sleep(1);
}
```

## 🚀 Deployment

### Docker Deployment

#### Dockerfile
```dockerfile
FROM golang:1.21-alpine AS builder

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o auth-server cmd/auth-server/main.go

FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/

COPY --from=builder /app/auth-server .
COPY --from=builder /app/certs ./certs

EXPOSE 8080
CMD ["./auth-server"]
```

#### Docker Compose
```yaml
version: '3.8'

services:
  auth-server:
    build: .
    ports:
      - "8080:8080"
    environment:
      - DB_HOST=postgres
      - REDIS_URL=redis://redis:6379
      - JWT_PUBLIC_KEY_PATH=/certs/jwt-public.pem
      - JWT_PRIVATE_KEY_PATH=/certs/jwt-private.pem
    volumes:
      - ./certs:/certs
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:13
    environment:
      - POSTGRES_DB=sdlc_platform
      - POSTGRES_USER=sdlc_user
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/schema:/docker-entrypoint-initdb.d

  redis:
    image: redis:6-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

### Kubernetes Deployment

#### Deployment Manifest
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: auth-server
spec:
  replicas: 3
  selector:
    matchLabels:
      app: auth-server
  template:
    metadata:
      labels:
        app: auth-server
    spec:
      containers:
      - name: auth-server
        image: sdlc/auth-server:latest
        ports:
        - containerPort: 8080
        env:
        - name: DB_HOST
          value: "postgres-service"
        - name: REDIS_URL
          value: "redis://redis-service:6379"
        - name: JWT_PUBLIC_KEY_PATH
          value: "/certs/jwt-public.pem"
        - name: JWT_PRIVATE_KEY_PATH
          value: "/certs/jwt-private.pem"
        volumeMounts:
        - name: certs
          mountPath: /certs
          readOnly: true
        resources:
          requests:
            memory: "64Mi"
            cpu: "50m"
          limits:
            memory: "128Mi"
            cpu: "100m"
      volumes:
      - name: certs
        secret:
          secretName: jwt-certs
```

### Production Considerations

#### Security Headers
```go
func securityHeaders(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        w.Header().Set("X-Content-Type-Options", "nosniff")
        w.Header().Set("X-Frame-Options", "DENY")
        w.Header().Set("X-XSS-Protection", "1; mode=block")
        w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
        w.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        next.ServeHTTP(w, r)
    })
}
```

#### Rate Limiting
```go
func rateLimitMiddleware(requestsPerMinute int) func(http.Handler) http.Handler {
    limiter := rate.NewLimiter(rate.Every(time.Minute/requestsPerMinute), requestsPerMinute)
    
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            if !limiter.Allow() {
                http.Error(w, "Too many requests", http.StatusTooManyRequests)
                return
            }
            next.ServeHTTP(w, r)
        })
    }
}
```

#### Health Checks
```go
func (s *Server) healthCheckHandler(w http.ResponseWriter, r *http.Request) {
    // Check database
    if err := s.db.Exec("SELECT 1").Error; err != nil {
        w.WriteHeader(http.StatusServiceUnavailable)
        return
    }
    
    // Check Redis
    if err := s.redisClient.Ping().Err(); err != nil {
        w.WriteHeader(http.StatusServiceUnavailable)
        return
    }
    
    w.WriteHeader(http.StatusOK)
    json.NewEncoder(w).Encode(map[string]string{
        "status": "healthy",
    })
}
```

## 🔧 Troubleshooting

### Common Issues

#### JWT Token Validation Failures
```bash
# Check token content
echo "eyJhbGciOiJSUzI1NiIs..." | base64 -d | jq .

# Verify key format
openssl rsa -in private.pem -check
openssl rsa -pubin -in public.pem -check
```

#### Database Connection Issues
```bash
# Test PostgreSQL connection
psql -h localhost -U sdlc_user -d sdlc_platform -c "SELECT 1;"

# Check migrations
psql -h localhost -U sdlc_user -d sdlc_platform -c "\dt"
```

#### Redis Connection Issues
```bash
# Test Redis connection
redis-cli ping

# Check blacklist entries
redis-cli keys "auth:blacklist:*"
```

### Debug Mode

#### Enable Debug Logging
```yaml
logging:
  level: "debug"
  format: "json"
  output: "stdout"
```

#### Authentication Debugging
```go
// Add debug middleware
func debugMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        log.Printf("Request: %s %s", r.Method, r.URL.Path)
        log.Printf("Headers: %+v", r.Header)
        next.ServeHTTP(w, r)
    })
}
```

### Performance Monitoring

#### Metrics Collection
```go
import "github.com/prometheus/client_golang/prometheus"

var (
    authRequestsTotal = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Name: "auth_requests_total",
            Help: "Total number of authentication requests",
        },
        []string{"method", "status"},
    )
    
    authDuration = prometheus.NewHistogramVec(
        prometheus.HistogramOpts{
            Name: "auth_duration_seconds",
            Help: "Authentication request duration",
        },
        []string{"method"},
    )
)

func init() {
    prometheus.MustRegister(authRequestsTotal)
    prometheus.MustRegister(authDuration)
}
```

## 📝 License

This JWT Authentication System is part of the SDLC.ai platform and is subject to the project's license terms.

## 🤝 Contributing

Please refer to the [CONTRIBUTING.md](../../CONTRIBUTING.md) file for guidelines on contributing to this authentication system.

## 📞 Support

For support and questions:
- Create an issue in the project repository
- Check the troubleshooting section above
- Review the test files for usage examples