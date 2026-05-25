# SSO/SAML Quick Start Guide

## Overview

This SSO system provides enterprise-grade authentication supporting:
- **Azure Active Directory** (Azure AD / Entra)
- **Okta**
- **Google Workspace**
- **Generic SAML 2.0**
- **Generic OpenID Connect (OIDC)**

## 5-Minute Setup

### 1. Install Dependencies

```bash
cd backend
npm install fast-xml-parser jsonwebtoken
```

### 2. Register Routes

In `backend/src/index.production.ts`, add:

```typescript
import { ssoRouter } from './routes/sso.routes.js';

app.use('/api/sso', ssoRouter);
```

### 3. Set Environment Variables

```env
JWT_SECRET=your-super-secret-key
JWT_REFRESH_SECRET=your-refresh-secret-key
APP_URL=https://api.qestro.example.com
FRONTEND_URL=https://app.qestro.example.com
```

### 4. Run Migrations

```bash
npm run db:migrate
```

This creates the `sso_configs` and `sso_sessions` tables.

## Testing the Setup

### 1. List Available Providers

```bash
curl http://localhost:3000/api/sso/providers
```

Response:
```json
{
  "success": true,
  "data": [
    {
      "type": "azure_ad",
      "displayName": "Azure Active Directory",
      "authMethod": "oidc",
      "requiredFields": [...]
    }
  ]
}
```

### 2. Configure Azure AD (Example)

```bash
curl -X POST http://localhost:3000/api/sso/configure \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "providerType": "azure_ad",
    "clientId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "clientSecret": "your-client-secret",
    "tokenUrl": "https://login.microsoftonline.com/<tenant>/oauth2/v2.0/token",
    "userInfoUrl": "https://graph.microsoft.com/oidc/userinfo"
  }'
```

### 3. Initiate SSO Flow

Users navigate to:
```
https://app.qestro.example.com/login?provider=azure_ad
```

Or via API:
```bash
curl -X GET "http://localhost:3000/api/sso/initiate/azure_ad?org_id=default"
```

This redirects to Azure AD login.

### 4. Handle Callback

After successful authentication, IdP redirects to:
```
https://api.qestro.example.com/api/sso/callback/oidc?code=...&state=...
```

The system:
1. Exchanges code for tokens
2. Validates ID token
3. Fetches user info
4. Creates/links user account
5. Redirects to frontend with JWT tokens

## Architecture

```
User Login Request
       ↓
   [Frontend]
       ↓
GET /api/sso/initiate/:provider
       ↓
   [SSOManager]
       ↓
   [OIDC/SAML]
       ↓
Redirect to Identity Provider
       ↓
    [User Login]
       ↓
Redirect to Callback URL
       ↓
POST /api/sso/callback/...
       ↓
   [SSOManager]
       ↓
Auto-provision/Link User
       ↓
Generate JWT Tokens
       ↓
Return to Frontend
```

## Configuration Structure

Each provider needs:

### OIDC Providers (Azure AD, Okta, Google)
- `clientId`: OAuth application ID
- `clientSecret`: OAuth secret
- `authorizationUrl`: Provider's authorization endpoint
- `tokenUrl`: Token endpoint
- `userInfoUrl`: User info endpoint

### SAML Providers
- `entryPoint`: IdP SSO URL
- `issuer`: Your app's entity ID
- `cert`: IdP's certificate for validation

## Group-Based Role Assignment

Map identity provider groups to Qestro roles:

```typescript
{
  groupMappings: {
    "azure-ad-admin-group-id": "admin",
    "azure-ad-user-group-id": "user"
  }
}
```

Users automatically get the appropriate role when provisioned.

## Frontend Integration

### 1. Login Button

```typescript
const handleSSOLogin = (provider: string) => {
  window.location.href = `/api/sso/initiate/${provider}`;
};

<button onClick={() => handleSSOLogin('azure_ad')}>
  Sign in with Azure AD
</button>
```

### 2. Callback Handler

Frontend callback page (`/auth/sso-callback`):

```typescript
const { searchParams } = new URL(window.location);
const accessToken = searchParams.get('access_token');
const refreshToken = searchParams.get('refresh_token');

// Store tokens
localStorage.setItem('accessToken', accessToken);
localStorage.setItem('refreshToken', refreshToken);

// Redirect to dashboard
window.location.href = '/dashboard';
```

## Common Issues & Solutions

### "Invalid authorization URL"
- Check `authorizationUrl` is set correctly
- Verify provider template has correct URL pattern
- For Okta, replace `{orgUrl}` with your Okta domain

### "Client ID not in audience list"
- Ensure `clientId` matches IdP configuration
- Verify token validation isn't too strict

### "User not found and auto-provisioning disabled"
- Check `autoProvision: true` in config
- Or manually create users before SSO setup

### "State parameter mismatch"
- Clear browser cookies
- Check for concurrent login attempts
- Verify redirect URL matches config

### "SAML signature validation failed"
- Verify IdP certificate is in PEM format
- Check certificate hasn't expired
- Ensure SAML response includes signature

## Advanced: Custom Provider Setup

For a custom OIDC provider:

```bash
curl -X POST http://localhost:3000/api/sso/configure \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "providerType": "oidc_generic",
    "clientId": "your-client-id",
    "clientSecret": "your-client-secret",
    "authorizationUrl": "https://custom-provider.com/oauth/authorize",
    "tokenUrl": "https://custom-provider.com/oauth/token",
    "userInfoUrl": "https://custom-provider.com/oauth/userinfo",
    "scopes": ["openid", "profile", "email"],
    "autoProvision": true,
    "autoAssignRole": "user"
  }'
```

## Production Deployment

### Security Checklist

- [ ] Use strong JWT_SECRET (minimum 32 characters)
- [ ] Enable HTTPS (APP_URL must be https://)
- [ ] Set REDIS_URL for session storage
- [ ] Configure rate limiting on callback endpoints
- [ ] Enable audit logging
- [ ] Set up certificate rotation for SAML
- [ ] Monitor token exchange failures

### Database

```sql
-- Check SSO configuration
SELECT * FROM sso_configs;

-- View active SSO sessions
SELECT * FROM sso_sessions WHERE expires_at > NOW();

-- Monitor linked OAuth accounts
SELECT * FROM oauth_accounts WHERE provider IN ('azure_ad', 'okta', 'google');
```

## File Structure

```
backend/src/
├── services/sso/
│   ├── types.ts                 # Type definitions
│   ├── SAMLProvider.ts          # SAML 2.0 handler
│   ├── OIDCProvider.ts          # OpenID Connect handler
│   ├── SSOManager.ts            # Orchestration logic
│   ├── ProviderRegistry.ts      # Provider templates
│   ├── index.ts                 # Exports
│   ├── config.example.ts        # Configuration examples
│   ├── IMPLEMENTATION.md        # Detailed guide
│   ├── QUICKSTART.md           # This file
│   └── __tests__/              # Unit tests
├── routes/
│   └── sso.routes.ts           # API endpoints
└── schema/
    └── index.ts                # Database schema (ssoConfigs, ssoSessions)
```

## Next Steps

1. Choose your identity provider (Azure AD, Okta, Google, etc.)
2. Create an OAuth/SAML application
3. Configure SSO via POST /api/sso/configure
4. Update frontend login flow
5. Test with a user account
6. Monitor logs and metrics

## Support & Resources

- SAML 2.0 Spec: https://en.wikipedia.org/wiki/SAML_2.0
- OpenID Connect: https://openid.net/connect/
- Azure AD: https://learn.microsoft.com/en-us/azure/
- Okta: https://developer.okta.com/
- Google: https://developers.google.com/identity

## Testing

```bash
# Run unit tests
npm test -- backend/src/services/sso

# Run integration tests
npm test -- backend/src/routes/__tests__/sso.routes.test.ts

# Test coverage
npm run test:coverage -- backend/src/services/sso
```

Expected coverage: >85% for SSO module.
