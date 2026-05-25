# SSO/SAML Implementation Guide

Enterprise-grade Single Sign-On (SSO) authentication system for Qestro, supporting Azure AD, Okta, Google Workspace, and generic SAML 2.0 and OpenID Connect (OIDC) providers.

## Architecture Overview

### Components

1. **SAMLProvider** (`SAMLProvider.ts`)
   - SAML 2.0 authentication
   - AuthnRequest generation
   - Response validation and assertion parsing
   - XML signature verification

2. **OIDCProvider** (`OIDCProvider.ts`)
   - OpenID Connect (OIDC) flows
   - Authorization code exchange with PKCE
   - ID token validation
   - UserInfo endpoint integration

3. **SSOManager** (`SSOManager.ts`)
   - SSO flow orchestration
   - User provisioning and linking
   - Group-to-role mapping
   - Session management

4. **ProviderRegistry** (`ProviderRegistry.ts`)
   - Provider templates (Azure AD, Okta, Google)
   - Configuration validation
   - URL variable resolution

5. **Routes** (`sso.routes.ts`)
   - REST API endpoints
   - Callback handlers (SAML, OIDC)
   - Configuration management

## Setup Instructions

### 1. Install Dependencies

```bash
npm install fast-xml-parser jsonwebtoken
```

### 2. Database Schema

The system uses two new tables:

- **sso_configs**: SSO provider configurations
- **sso_sessions**: Active SSO sessions

Tables are already defined in `backend/src/schema/index.ts`

### 3. Environment Variables

Add to `.env`:

```env
# JWT Configuration
JWT_SECRET=<your-secret-key>
JWT_REFRESH_SECRET=<your-refresh-secret-key>

# Application URLs
APP_URL=https://qestro.example.com
FRONTEND_URL=https://app.qestro.example.com

# Optional: Redis for session storage
REDIS_URL=redis://localhost:6379
```

### 4. Register Routes

In `backend/src/index.production.ts`:

```typescript
import { ssoRouter } from './routes/sso.routes.js';

app.use('/api/sso', ssoRouter);
```

## Usage Examples

### Azure AD Configuration

```typescript
const config = {
  organizationId: 'org-123',
  providerType: 'azure_ad',
  clientId: '<client-id>',
  clientSecret: '<client-secret>',
  tokenUrl: 'https://login.microsoftonline.com/<tenant-id>/oauth2/v2.0/token',
  userInfoUrl: 'https://graph.microsoft.com/oidc/userinfo',
  groupMappings: {
    'admin-group': 'admin',
    'developer-group': 'user',
  },
  autoProvision: true,
  autoAssignRole: 'user',
};

// Configure via API
await fetch('/api/sso/configure', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(config),
});
```

### Okta Configuration

```typescript
const config = {
  organizationId: 'org-123',
  providerType: 'okta',
  clientId: '<client-id>',
  clientSecret: '<client-secret>',
  tokenUrl: 'https://acme.okta.com/oauth2/v1/token',
  userInfoUrl: 'https://acme.okta.com/oauth2/v1/userinfo',
  authorizationUrl: 'https://acme.okta.com/oauth2/v1/authorize',
};
```

### Generic SAML Configuration

```typescript
const config = {
  organizationId: 'org-123',
  providerType: 'saml_generic',
  entryPoint: 'https://idp.example.com/sso',
  issuer: 'https://qestro.example.com',
  cert: '<identity-provider-certificate>',
  identifierFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
};
```

## API Endpoints

### GET /api/sso/providers
List available SSO provider templates

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "type": "azure_ad",
      "displayName": "Azure Active Directory",
      "authMethod": "oidc",
      "requiredFields": ["clientId", "clientSecret", "tokenUrl", "userInfoUrl"]
    }
  ]
}
```

### POST /api/sso/configure
Configure SSO for organization (admin only)

**Request:**
```json
{
  "providerType": "azure_ad",
  "clientId": "...",
  "clientSecret": "...",
  "tokenUrl": "...",
  "userInfoUrl": "..."
}
```

### GET /api/sso/initiate/:provider
Start SSO flow (redirects to IdP)

**Query Parameters:**
- `org_id`: Organization ID

**Response:** HTTP 302 redirect to identity provider

### POST /api/sso/callback/saml
SAML assertion callback endpoint

**Request Body:**
```json
{
  "SAMLResponse": "<base64-encoded-assertion>",
  "RelayState": "..."
}
```

**Response:** HTTP 302 redirect to frontend with tokens

### GET /api/sso/callback/oidc
OIDC authorization code callback

**Query Parameters:**
- `code`: Authorization code
- `state`: CSRF protection state
- `error`: Error code (if present)
- `error_description`: Error description

### GET /api/sso/status/:orgId
Check SSO status for organization

**Response:**
```json
{
  "success": true,
  "enabled": true,
  "providerType": "azure_ad",
  "autoProvisionEnabled": true
}
```

### DELETE /api/sso/configure/:orgId
Remove SSO configuration (admin only)

## Security Considerations

### 1. CSRF Protection
- State parameter in OIDC flow
- Secure httpOnly cookies
- SameSite cookie attribute

### 2. Token Security
- JWT tokens use strong algorithms (HS256/RS256)
- Tokens expire after 15 minutes (access) and 7 days (refresh)
- PKCE code challenge for OIDC

### 3. Certificate Validation
- SAML assertions validated using IdP certificate
- XML signature verification
- Issuer and InResponseTo validation

### 4. User Provisioning
- Optional auto-provisioning with configurable defaults
- Group-based role assignment
- Email verification via SSO provider

## Testing

Run the test suite:

```bash
npm test -- backend/src/services/sso
```

Test coverage includes:

- SAML request generation
- SAML response validation
- OIDC authorization flow
- PKCE code challenge
- Provider registry validation
- Token validation and claims extraction
- User provisioning logic

## Troubleshooting

### SAML Signature Validation Failed
- Verify IdP certificate is correct
- Check certificate encoding (PEM format)
- Ensure assertion includes signature element

### OIDC Token Exchange Failed
- Verify clientId and clientSecret match IdP configuration
- Check tokenUrl is accessible
- Validate redirect_uri matches IdP configuration

### User Not Found / Auto-provisioning Disabled
- Check `autoProvision` is true in SSO config
- Verify email claim is present in assertion/token
- Check user role mappings if applicable

### State Parameter Mismatch
- Clear browser cookies
- Verify callback URL matches configuration
- Check for concurrent SSO requests

## Advanced Features (For Future Implementation)

### 1. Session State Storage
Currently uses in-memory state. For production:

```typescript
// Use Redis for state storage
redis.set(`sso_state:${state}`, JSON.stringify(data), 'EX', 600)
redis.get(`sso_state:${state}`)
```

### 2. Refresh Token Rotation
Implement automatic token refresh:

```typescript
if (tokenExpiresIn < 300) {
  const newTokens = await oidcProvider.refreshAccessToken(...)
  await updateSession(newTokens)
}
```

### 3. JIT (Just-In-Time) User Provisioning
Map additional claims to user attributes:

```typescript
{
  customAttributes: {
    department: 'extensionAttribute1',
    manager: 'manager_email'
  }
}
```

### 4. Attribute-Based Access Control (ABAC)
Extend role mapping to support attribute combinations:

```typescript
{
  groupMappings: {
    'IT Department AND Senior': 'admin',
    'IT Department': 'user'
  }
}
```

## Production Deployment

### 1. SSL/TLS Certificate
- Use HTTPS in production
- Set `secure: true` in cookie options
- Validate certificate in SAML validation

### 2. Rate Limiting
- Implement rate limiting on callback endpoints
- Prevent brute-force attempts
- Monitor for suspicious patterns

### 3. Audit Logging
- Log all SSO authentication attempts
- Record user provisioning events
- Track configuration changes

### 4. Monitoring
- Monitor token exchange failures
- Alert on certificate expiration
- Track SAML/OIDC error rates

## Support

For additional configuration requirements or custom provider support, see the ProviderRegistry class for pattern examples.
