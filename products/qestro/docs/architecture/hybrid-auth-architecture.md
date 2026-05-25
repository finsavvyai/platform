# Hybrid Authentication Architecture

## Overview

Qestro uses a hybrid architecture where authentication is handled by a centralized backend service (Express/Node.js), while other features are distributed across Cloudflare's edge network using Workers.

## Architecture Diagram

```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │
       ├─────────────────────────────────────┐
       │                                     │
       ▼                                     ▼
┌──────────────────┐              ┌──────────────────┐
│  Cloudflare      │              │  Backend Auth    │
│  Workers (Edge)  │◄────────────►│  Service         │
│                  │   Validates  │  (Express)       │
│  - Projects      │   JWT tokens │                  │
│  - Recording     │              │  - Registration  │
│  - Test Exec     │              │  - Login         │
│  - Collaboration │              │  - OAuth         │
│  - Real-time     │              │  - Email Verify  │
└──────────────────┘              └──────────────────┘
       │                                     │
       │                                     │
       ▼                                     ▼
┌──────────────────┐              ┌──────────────────┐
│  Cloudflare D1   │              │  PostgreSQL      │
│  (Edge DB)       │              │  (Auth DB)       │
│                  │              │                  │
│  - Projects      │              │  - Users         │
│  - Tests         │              │  - Teams         │
│  - Results       │              │  - OAuth Accts   │
└──────────────────┘              └──────────────────┘
```

## Why Hybrid Architecture?

### Benefits

1. **Leverage Existing Code**: The backend already has a complete, tested authentication system
2. **Centralized Auth**: Single source of truth for user authentication
3. **Edge Performance**: Workers handle high-frequency operations at the edge
4. **Security**: Sensitive auth operations stay in controlled backend environment
5. **Flexibility**: Can migrate auth to Workers later if needed

### Trade-offs

1. **Additional Latency**: Auth requests require backend round-trip
2. **Dependency**: Workers depend on backend availability for auth
3. **Complexity**: Two systems to maintain and deploy

## Authentication Flow

### 1. User Registration

```
User → Workers → Backend Auth Service
                      ↓
                 Create User in PostgreSQL
                      ↓
                 Send Verification Email
                      ↓
                 Return JWT Tokens
                      ↓
Workers ← Cache Session in KV ← Backend
     ↓
   User
```

### 2. User Login

```
User → Workers → Backend Auth Service
                      ↓
                 Validate Credentials
                      ↓
                 Generate JWT Tokens
                      ↓
Workers ← Cache Session in KV ← Backend
     ↓
   User
```

### 3. Protected API Request

```
User → Workers (with JWT token)
         ↓
    Validate JWT
         ↓
    Check KV Cache
         ↓
    [Cache Hit] → Continue
         ↓
    [Cache Miss] → Verify with Backend
                        ↓
                   Cache in KV
                        ↓
                   Continue
```

## Token Management

### JWT Tokens

- **Access Token**: Short-lived (15 minutes), used for API requests
- **Refresh Token**: Long-lived (7 days), used to get new access tokens
- **Issued by**: Backend Auth Service
- **Validated by**: Workers (using JWT_SECRET)

### Session Caching

Workers cache validated sessions in KV for performance:

```typescript
// Cache structure
{
  key: `session:${accessToken}`,
  value: {
    userId: string,
    email: string,
    role: string,
    name: string,
    teamId: string
  },
  ttl: 900 // 15 minutes (matches token expiry)
}
```

## Security Considerations

### Token Validation

Workers validate JWT tokens using:
1. **Signature verification**: Using Web Crypto API
2. **Expiration check**: Ensure token hasn't expired
3. **Type check**: Verify it's an access token (not refresh)
4. **User existence**: Check user still exists in database

### Rate Limiting

Workers implement rate limiting using KV:

```typescript
// Rate limit structure
{
  key: `ratelimit:${userId}`,
  value: requestCount,
  ttl: windowSeconds
}
```

### CORS Protection

Workers enforce CORS policies:
- Allowed origins configured per environment
- Credentials support enabled
- Preflight requests handled

## Deployment

### Backend Auth Service

Deploy to your preferred platform:
- **Recommended**: Railway, Render, or Fly.io
- **Requirements**: Node.js 18+, PostgreSQL
- **Environment**: Set JWT_SECRET, database credentials

```bash
# Deploy backend
cd backend
npm run build
npm run deploy
```

### Cloudflare Workers

Deploy to Cloudflare's edge network:

```bash
# Deploy workers
npm run deploy:workers:prod
```

### Environment Variables

**Backend (.env)**:
```env
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret
DATABASE_URL=postgresql://...
FRONTEND_URL=https://qestro.app
```

**Workers (wrangler.toml)**:
```toml
[env.production.vars]
BACKEND_AUTH_URL = "https://backend.qestro.app"
JWT_SECRET = "same-as-backend"  # Set via wrangler secret
```

## Migration Path

If you want to migrate auth to Workers later:

### Phase 1: Current (Hybrid)
- Backend handles all auth
- Workers proxy auth requests
- Workers validate tokens

### Phase 2: Gradual Migration
- Move token validation to Workers
- Keep user management in backend
- Sync user data to D1

### Phase 3: Full Edge Auth
- Move all auth to Workers
- Use D1 for user storage
- Deprecate backend auth service

## API Endpoints

### Auth Endpoints (Proxied to Backend)

```
POST   /api/auth/register       - User registration
POST   /api/auth/login          - User login
POST   /api/auth/logout         - User logout
POST   /api/auth/refresh        - Refresh access token
GET    /api/auth/verify/:token  - Email verification
POST   /api/auth/forgot-password - Request password reset
POST   /api/auth/reset-password  - Reset password
GET    /api/auth/profile        - Get user profile
PUT    /api/auth/profile        - Update user profile
```

### OAuth Endpoints (Proxied to Backend)

```
GET    /api/oauth/github         - Initiate GitHub OAuth
GET    /api/oauth/github/callback - GitHub OAuth callback
GET    /api/oauth/azure          - Initiate Azure AD OAuth
GET    /api/oauth/azure/callback - Azure AD OAuth callback
```

### Protected Endpoints (Workers)

```
GET    /api/projects            - List projects (requires auth)
POST   /api/projects            - Create project (requires auth + rate limit)
GET    /api/projects/:id        - Get project (requires auth)
PUT    /api/projects/:id        - Update project (requires auth)
DELETE /api/projects/:id        - Delete project (requires auth + admin role)
```

## Monitoring

### Backend Metrics
- Authentication success/failure rates
- Token generation latency
- Database query performance
- Email delivery status

### Workers Metrics
- Token validation latency
- KV cache hit rate
- Rate limit violations
- Edge request distribution

## Troubleshooting

### Common Issues

**1. "Invalid token" errors**
- Check JWT_SECRET matches between backend and workers
- Verify token hasn't expired
- Check user still exists in database

**2. "Backend unavailable" errors**
- Verify BACKEND_AUTH_URL is correct
- Check backend service is running
- Review backend logs for errors

**3. "Rate limit exceeded" errors**
- Check KV namespace is configured
- Verify rate limit settings
- Review user request patterns

**4. CORS errors**
- Verify origin is in CORS_ALLOWED_ORIGINS
- Check credentials are included in requests
- Review preflight request handling

## Best Practices

1. **Always use HTTPS** for auth endpoints
2. **Rotate JWT secrets** regularly
3. **Monitor auth metrics** for anomalies
4. **Cache aggressively** to reduce backend load
5. **Implement circuit breakers** for backend failures
6. **Log auth events** for security auditing
7. **Use rate limiting** to prevent abuse
8. **Keep tokens short-lived** (15 min access, 7 day refresh)

## Future Enhancements

1. **Multi-factor authentication (MFA)**
2. **Biometric authentication**
3. **Session management dashboard**
4. **Anomaly detection**
5. **Geographic restrictions**
6. **Device fingerprinting**
7. **Passwordless authentication**
8. **Social login (Google, Apple)**
