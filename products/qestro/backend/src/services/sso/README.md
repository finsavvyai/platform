# Qestro SSO/SAML Enterprise Authentication System

Complete, production-ready Single Sign-On (SSO) implementation supporting enterprise identity providers.

## Overview

This module provides enterprise-grade SSO authentication for Qestro, enabling seamless integration with:

- **Azure Active Directory** (Entra ID)
- **Okta**
- **Google Workspace**
- **Generic SAML 2.0** providers
- **Generic OpenID Connect (OIDC)** providers

## Quick Start

See `QUICKSTART.md` for a 5-minute setup guide.

## Installation

```bash
cd backend
npm install fast-xml-parser jsonwebtoken
```

Register routes in `src/index.production.ts`:

```typescript
import { ssoRouter } from './routes/sso.routes.js';
app.use('/api/sso', ssoRouter);
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend App                         │
│                (Login → /api/sso/initiate/:provider)        │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│                       Express Routes                        │
│                    (sso.routes.ts)                          │
├─────────────────────────────────────────────────────────────┤
│ GET /providers        POST /configure      GET /initiate    │
│ POST /callback/saml   GET /callback/oidc   GET /status      │
│ DELETE /configure                                           │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│                       SSOManager                            │
│              (Orchestration & User Provisioning)           │
├─────────────────────────────────────────────────────────────┤
│ • initiateSSO()          • handleCallback()                 │
│ • linkSSOAccount()       • autoProvisionUser()              │
│ • mapGroupsToRole()      • getProviderConfig()              │
└────────────────────────────┬────────────────────────────────┘
                      ┌──────┴──────┐
                      │             │
          ┌───────────▼─┐   ┌───────▼────────┐
          │ SAMLProvider│   │  OIDCProvider  │
          ├─────────────┤   ├────────────────┤
          │ • Generate  │   │ • Authorization│
          │   AuthnReq  │   │   Code Flow    │
          │ • Validate  │   │ • PKCE Support │
          │   Response  │   │ • Token Exchange
          │ • Parse     │   │ • UserInfo     │
          │   Assertion │   │   Endpoint     │
          └─────────────┘   └────────────────┘
                      │             │
                      └──────┬──────┘
                             │
              ┌──────────────▼──────────────┐
              │   ProviderRegistry         │
              │ (Templates & Validation)   │
              ├────────────────────────────┤
              │ • Azure AD Template        │
              │ • Okta Template            │
              │ • Google Template          │
              │ • SAML Generic Template    │
              │ • OIDC Generic Template    │
              └────────────────────────────┘
                             │
              ┌──────────────▼──────────────┐
              │    Database (Drizzle)      │
              ├────────────────────────────┤
              │ sso_configs Table          │
              │ sso_sessions Table         │
              │ users Table                │
              │ oauth_accounts Table       │
              └────────────────────────────┘
```

## Components

### Core Services

**1. SAMLProvider** (`SAMLProvider.ts`)
- SAML 2.0 protocol implementation
- AuthnRequest generation
- Response validation & assertion parsing
- XML signature verification
- Attribute extraction

**2. OIDCProvider** (`OIDCProvider.ts`)
- OpenID Connect protocol implementation
- Authorization code flow with PKCE
- ID token validation
- UserInfo endpoint integration
- Token refresh support

**3. SSOManager** (`SSOManager.ts`)
- SSO flow orchestration
- User account linking
- Automatic user provisioning
- Group-to-role mapping
- Session management

**4. ProviderRegistry** (`ProviderRegistry.ts`)
- Provider templates (Azure AD, Okta, Google, generic)
- Configuration validation
- Required fields validation
- URL variable resolution

**5. Types** (`types.ts`)
- Type definitions for all SSO operations
- Provider configuration schema
- SAML/OIDC token structures
- User profile interface

### API Routes

**6. SSO Routes** (`sso.routes.ts`)
```
GET    /api/sso/providers
POST   /api/sso/configure (admin)
GET    /api/sso/initiate/:provider
POST   /api/sso/callback/saml
GET    /api/sso/callback/oidc
GET    /api/sso/status/:orgId
DELETE /api/sso/configure/:orgId (admin)
```

## Database Schema

### sso_configs Table
Stores SSO provider configurations per organization

```sql
CREATE TABLE sso_configs (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL,
  provider_type VARCHAR NOT NULL,
  enabled BOOLEAN DEFAULT true,

  -- OIDC Fields
  client_id VARCHAR,
  client_secret TEXT,
  authorization_url VARCHAR,
  token_url VARCHAR,
  user_info_url VARCHAR,

  -- SAML Fields
  entry_point VARCHAR,
  issuer VARCHAR,
  cert TEXT,
  private_key TEXT,

  -- Mapping
  group_mappings JSONB,
  auto_provision BOOLEAN DEFAULT true,
  auto_assign_role VARCHAR,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### sso_sessions Table
Tracks active SSO sessions

```sql
CREATE TABLE sso_sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  organization_id UUID NOT NULL,
  provider_type VARCHAR NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  id_token TEXT,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## Configuration Examples

### Azure Active Directory

```typescript
const config = {
  providerType: 'azure_ad',
  clientId: '<app-id>',
  clientSecret: '<secret>',
  tokenUrl: 'https://login.microsoftonline.com/<tenant>/oauth2/v2.0/token',
  userInfoUrl: 'https://graph.microsoft.com/oidc/userinfo',
  groupMappings: {
    '<admin-group-id>': 'admin',
    '<user-group-id>': 'user',
  },
};
```

### Okta

```typescript
const config = {
  providerType: 'okta',
  clientId: '<client-id>',
  clientSecret: '<client-secret>',
  tokenUrl: 'https://acme.okta.com/oauth2/v1/token',
  userInfoUrl: 'https://acme.okta.com/oauth2/v1/userinfo',
  authorizationUrl: 'https://acme.okta.com/oauth2/v1/authorize',
};
```

### Generic SAML

```typescript
const config = {
  providerType: 'saml_generic',
  entryPoint: 'https://idp.example.com/sso',
  issuer: 'https://qestro.example.com',
  cert: '<idp-certificate>',
};
```

See `config.example.ts` for complete configuration examples.

## Security Features

- **PKCE**: Code challenge for authorization flows
- **CSRF Protection**: State parameter validation
- **JWT Validation**: Token expiration, issuer, audience checks
- **Signature Verification**: SAML response validation
- **Secure Cookies**: httpOnly, SameSite attributes
- **Nonce Validation**: Replay attack prevention
- **Rate Limiting**: Recommended for callback endpoints

## Testing

### Unit Tests

```bash
# Test individual providers
npm test -- backend/src/services/sso/__tests__/SAMLProvider.test.ts
npm test -- backend/src/services/sso/__tests__/OIDCProvider.test.ts
npm test -- backend/src/services/sso/__tests__/ProviderRegistry.test.ts

# Test routes
npm test -- backend/src/routes/__tests__/sso.routes.test.ts

# Full coverage
npm run test:coverage -- backend/src/services/sso
```

### Test Coverage
- SAMLProvider: Request generation, response parsing, validation
- OIDCProvider: Authorization flow, token exchange, validation
- ProviderRegistry: Template retrieval, config validation
- Routes: Endpoint behavior, error handling

Target: >85% coverage

## API Documentation

See `IMPLEMENTATION.md` for detailed API documentation, including:
- Request/response formats
- Error codes and handling
- Authentication requirements
- Rate limiting guidelines

## Troubleshooting

See `IMPLEMENTATION.md` for detailed troubleshooting guide covering:
- SAML signature validation issues
- OIDC token exchange failures
- User provisioning problems
- State parameter mismatches
- Certificate validation errors

## Advanced Features (Planned)

- Session state storage in Redis
- Token refresh automation
- Email verification integration
- Attribute-based access control (ABAC)
- Multi-provider linking
- Just-in-time (JIT) provisioning enhancements
- Audit logging
- Device trust validation

## Production Deployment

### Pre-Deployment Checklist

- [ ] All dependencies installed
- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] SSL/TLS certificates configured
- [ ] Rate limiting enabled on callbacks
- [ ] JWT secrets sufficiently random
- [ ] Logging configured
- [ ] Monitoring/alerting setup
- [ ] Security audit completed
- [ ] Backup strategy in place

### Required Environment Variables

```env
JWT_SECRET=<strong-random-secret>
JWT_REFRESH_SECRET=<strong-random-secret>
APP_URL=https://api.qestro.example.com
FRONTEND_URL=https://app.qestro.example.com
REDIS_URL=redis://localhost:6379 (optional, for state storage)
```

### Deployment Steps

1. Install dependencies: `npm install`
2. Update configuration in .env
3. Run database migrations
4. Register routes in index.production.ts
5. Configure at least one SSO provider
6. Test complete flow
7. Deploy to staging
8. Run security audit
9. Deploy to production

## File Structure

```
backend/src/services/sso/
├── types.ts                      # Type definitions (125 lines)
├── SAMLProvider.ts               # SAML implementation (199 lines)
├── OIDCProvider.ts               # OIDC implementation (240 lines)
├── ProviderRegistry.ts           # Provider templates (226 lines)
├── SSOManager.ts                 # Orchestration (286 lines)
├── index.ts                      # Module exports (10 lines)
├── config.example.ts             # Configuration examples (200+ lines)
├── IMPLEMENTATION.md             # Detailed guide (400+ lines)
├── QUICKSTART.md                 # Quick start (300+ lines)
├── README.md                     # This file
└── __tests__/
    ├── SAMLProvider.test.ts      # SAML tests (120 lines)
    ├── OIDCProvider.test.ts      # OIDC tests (100 lines)
    └── ProviderRegistry.test.ts  # Registry tests (100 lines)

backend/src/routes/
└── sso.routes.ts                 # API endpoints (280 lines)

backend/src/schema/
└── index.ts                      # Updated with SSO tables
```

## Support

For issues or questions:

1. Check `QUICKSTART.md` for quick solutions
2. Review `IMPLEMENTATION.md` for detailed guidance
3. See `config.example.ts` for configuration patterns
4. Refer to provider-specific documentation
5. Review test files for usage examples

## Standards Compliance

- SAML 2.0 Specification
- OpenID Connect Core Specification
- OAuth 2.0 Authorization Code Flow
- PKCE (RFC 7636)
- JWT (RFC 7519)

## License

Proprietary - Qestro Inc.

## Version History

**v1.0.0** (Current)
- Initial release with Azure AD, Okta, Google, generic SAML/OIDC support
- SAML 2.0 and OpenID Connect implementations
- User provisioning and group mapping
- Comprehensive test coverage
- Production-ready security
