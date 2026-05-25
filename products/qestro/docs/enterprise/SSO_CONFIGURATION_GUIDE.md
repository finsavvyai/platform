# Enterprise SSO Configuration Guide

## Overview
This guide provides templates and configuration steps for integrating Qestro with enterprise identity providers via SSO/SAML.

---

## Supported Providers

| Provider | Protocol | Status |
|----------|----------|--------|
| **Azure AD** | OIDC / SAML 2.0 | ✅ Fully Supported |
| **Okta** | OIDC / SAML 2.0 | ✅ Fully Supported |
| **Google Workspace** | OIDC | ✅ Fully Supported |
| **OneLogin** | SAML 2.0 | ✅ Fully Supported |
| **Ping Identity** | SAML 2.0 | ✅ Supported |
| **Auth0** | OIDC | ✅ Supported |
| **Custom SAML 2.0** | SAML 2.0 | ✅ Supported |

---

## Azure AD Configuration

### 1. Register Qestro in Azure Portal

```plaintext
App Registration Settings:
├── Name: Qestro Enterprise
├── Supported Account Types: Accounts in this organizational directory only
├── Redirect URI (Web): https://app.qestro.ai/auth/callback/azure
└── Platform Configuration: Web
```

### 2. API Permissions

| Permission | Type | Description |
|------------|------|-------------|
| `openid` | Delegated | Sign in users |
| `profile` | Delegated | View user's basic profile |
| `email` | Delegated | View user's email address |
| `User.Read` | Delegated | Sign in and read user profile |
| `GroupMember.Read.All` | Delegated | Read group memberships |

### 3. Create Client Secret

```json
{
  "name": "Qestro Production",
  "expires": "24 months"
}
```

### 4. Qestro Configuration

```env
# .env.production
AZURE_AD_CLIENT_ID=<Application (client) ID>
AZURE_AD_CLIENT_SECRET=<Client secret value>
AZURE_AD_TENANT_ID=<Directory (tenant) ID>
AZURE_AD_REDIRECT_URI=https://app.qestro.ai/auth/callback/azure
```

### 5. Group to Role Mapping

```json
{
  "groupMappings": [
    {
      "azureGroupId": "d3f8b2a4-1234-5678-abcd-ef1234567890",
      "azureGroupName": "Qestro Admins",
      "qestroRole": "admin"
    },
    {
      "azureGroupId": "a1b2c3d4-5678-9012-efgh-ij3456789012",
      "azureGroupName": "QA Team",
      "qestroRole": "member"
    },
    {
      "azureGroupId": "x9y8z7w6-0987-6543-klmn-op2109876543",
      "azureGroupName": "Stakeholders",
      "qestroRole": "viewer"
    }
  ],
  "defaultRole": "member",
  "jitProvisioning": true
}
```

---

## Okta Configuration

### 1. Create OIDC Application

```plaintext
Application Settings:
├── Application Type: OIDC - OpenID Connect
├── Application Name: Qestro Enterprise
├── Grant Types: Authorization Code, Refresh Token
├── Sign-in Redirect URIs: https://app.qestro.ai/auth/callback/okta
├── Sign-out Redirect URIs: https://app.qestro.ai/logout
└── Assignments: Limit access to selected groups (recommended)
```

### 2. Qestro Configuration

```env
# .env.production
OKTA_DOMAIN=https://your-company.okta.com
OKTA_CLIENT_ID=<Client ID>
OKTA_CLIENT_SECRET=<Client Secret>
OKTA_REDIRECT_URI=https://app.qestro.ai/auth/callback/okta
```

### 3. Attribute Mapping

```json
{
  "attributes": {
    "email": "email",
    "firstName": "given_name",
    "lastName": "family_name",
    "groups": "groups",
    "department": "department"
  }
}
```

---

## Google Workspace Configuration

### 1. Create OAuth 2.0 Credentials

```plaintext
Google Cloud Console:
├── APIs & Services > Credentials
├── Create Credentials > OAuth client ID
├── Application type: Web application
├── Name: Qestro Enterprise
├── Authorized redirect URIs: https://app.qestro.ai/auth/callback/google
└── Download JSON credentials
```

### 2. Enable APIs

- Google+ API
- Admin SDK API (for group sync)

### 3. Qestro Configuration

```env
# .env.production
GOOGLE_CLIENT_ID=<client_id>.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<client_secret>
GOOGLE_REDIRECT_URI=https://app.qestro.ai/auth/callback/google
GOOGLE_HD=yourcompany.com  # Hosted domain restriction
```

---

## Generic SAML 2.0 Configuration

### 1. Qestro Service Provider Metadata

```xml
<?xml version="1.0" encoding="UTF-8"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata"
                  entityID="https://app.qestro.ai/saml/metadata">
  <SPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</NameIDFormat>
    <AssertionConsumerService 
      Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
      Location="https://app.qestro.ai/saml/acs"
      index="1"/>
    <SingleLogoutService
      Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
      Location="https://app.qestro.ai/saml/logout"/>
  </SPSSODescriptor>
</EntityDescriptor>
```

### 2. Required Attributes

| Attribute | SAML Claim | Required |
|-----------|------------|----------|
| Email | `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress` | ✅ |
| First Name | `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname` | ✅ |
| Last Name | `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname` | ✅ |
| Groups | `http://schemas.xmlsoap.org/claims/Group` | Optional |
| Employee ID | `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/employeeid` | Optional |

### 3. Qestro SAML Configuration

```env
# .env.production
SAML_ENTRY_POINT=https://idp.yourcompany.com/saml2/sso
SAML_ISSUER=https://app.qestro.ai/saml/metadata
SAML_CALLBACK_URL=https://app.qestro.ai/saml/acs
SAML_CERT_PATH=/etc/qestro/saml/idp-cert.pem
SAML_PRIVATE_KEY_PATH=/etc/qestro/saml/sp-key.pem
```

---

## Security Best Practices

### IP Restrictions
```json
{
  "allowedIpRanges": [
    "10.0.0.0/8",
    "172.16.0.0/12",
    "192.168.0.0/16",
    "203.0.113.0/24"  // Company VPN
  ],
  "allowedCountries": ["US", "IL", "GB", "DE"]
}
```

### Session Configuration
```json
{
  "sessionDuration": 28800,
  "idleTimeout": 3600,
  "forceReauth": true,
  "mfaRequired": true,
  "singleSessionPerUser": false
}
```

### Audit Logging
All SSO events are logged to the audit trail:
- Login attempts (success/failure)
- Group membership changes
- Role assignments
- Session creation/termination

---

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| `redirect_uri_mismatch` | Verify exact redirect URI in IdP matches Qestro config |
| `invalid_grant` | Check clock sync between Qestro and IdP servers |
| `access_denied` | Verify user is assigned to the application in IdP |
| `group_claim_missing` | Enable group claims in IdP app configuration |

### Debug Mode
```env
# Enable SSO debugging (development only)
SSO_DEBUG=true
SSO_LOG_LEVEL=debug
```

---

## Support Contact

For enterprise SSO configuration assistance:
- **Email**: enterprise-support@qestro.ai
- **Slack**: #qestro-enterprise-sso
- **Documentation**: https://docs.qestro.ai/enterprise/sso

---

*Last Updated: February 2026*
