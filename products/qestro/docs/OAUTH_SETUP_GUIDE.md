# OAuth Authentication Setup Guide

This guide will help you set up GitHub and Azure AD OAuth authentication for the Questro platform.

## GitHub OAuth Setup

### 1. Create GitHub OAuth App

1. Go to GitHub Settings → Developer settings → OAuth Apps
2. Click "New OAuth App"
3. Fill in the application details:
   - **Application name**: Questro (Your Company Name)
   - **Homepage URL**: `https://qestro.app`
   - **Authorization callback URL**: `https://qestro.app/auth/github/callback`
4. Click "Register application"
5. Copy the **Client ID** and generate a **Client Secret**

### 2. Update Environment Variables

Add to your backend `.env` file:

```bash
# GitHub OAuth - Get from github.com/settings/applications
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
GITHUB_REDIRECT_URI=https://qestro.app/auth/github/callback
```

### 3. GitHub OAuth Permissions

The Questro app requests the following scopes:
- `user:email` - Access to user's email addresses (verified emails only)

## Azure AD / Microsoft 365 OAuth Setup

### 1. Register Azure AD Application

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** → **App registrations**
3. Click **New registration**
4. Fill in the application details:
   - **Name**: Questro (Your Company Name)
   - **Supported account types**: 
     - Choose "Accounts in any organizational directory and personal Microsoft accounts"
   - **Redirect URI**: `https://qestro.app/auth/azure/callback` (Web)
5. Click **Register**

### 2. Configure Azure AD App

1. After registration, note the **Application (client) ID** and **Directory (tenant) ID**
2. Go to **Authentication** settings:
   - Ensure **Implicit grant** is **disabled** (we use authorization code flow)
   - **Allow public client flows**: **No**
3. Go to **Certificates & secrets**:
   - Click **New client secret**
   - Add a description and choose expiration period
   - Copy the **Value** of the secret immediately (it won't be shown again)

### 3. Update Environment Variables

Add to your backend `.env` file:

```bash
# Azure AD OAuth - Get from azure.active.directory.com
AZURE_CLIENT_ID=your-azure-app-client-id
AZURE_CLIENT_SECRET=your-azure-app-client-secret
AZURE_TENANT_ID=your-azure-tenant-id
AZURE_REDIRECT_URI=https://qestro.app/auth/azure/callback
```

### 4. Azure AD API Permissions

The Questro app requests the following Microsoft Graph permissions:
- `openid` - Sign user in
- `profile` - Access user's basic profile
- `email` - Access user's email address

## Testing OAuth Integration

### 1. Backend Testing

Test the OAuth endpoints:

```bash
# Get available OAuth providers
curl https://your-backend-url/api/oauth/providers

# Get GitHub OAuth URL
curl "https://your-backend-url/api/oauth/url?provider=github"
```

### 2. Frontend Testing

1. Navigate to `https://qestro.app/login`
2. You should see "Or continue with" section with GitHub and Microsoft buttons
3. Click on either button to test the OAuth flow

### 3. Production Considerations

For production deployment:

1. **Environment Variables**: Ensure all OAuth secrets are properly configured
2. **HTTPS Required**: OAuth requires HTTPS in production
3. **Redirect URLs**: Must exactly match the registered URLs
4. **Domain Verification**: Consider verifying your domain with providers

## Security Best Practices

### 1. State Management
- Each OAuth flow generates a cryptographically secure random state
- State verification prevents CSRF attacks
- States are temporary and single-use

### 2. Token Storage
- Access tokens are stored securely in the database
- Refresh tokens enable long-term access without re-authentication
- Tokens are encrypted at rest

### 3. Error Handling
- Comprehensive error messages for debugging
- Graceful fallback for OAuth failures
- User-friendly error reporting

### 4. Account Linking
- Users can link multiple OAuth providers to one account
- Email matching prevents duplicate accounts
- Existing accounts can be upgraded with OAuth access

## Troubleshooting

### Common Issues

1. **Redirect URI Mismatch**
   - Ensure redirect URIs exactly match registered URLs
   - Check for trailing slashes and protocol (http vs https)

2. **Invalid Client Credentials**
   - Verify client ID and secret are correct
   - Check for extra spaces or special characters

3. **CORS Issues**
   - Ensure backend allows frontend origin
   - Check CORS configuration

4. **State Parameter Errors**
   - States must be generated and verified consistently
   - Check state storage mechanism

### Debug Mode

Enable debug logging in backend:

```bash
LOG_LEVEL=debug
```

This will provide detailed OAuth flow information in logs.

## Next Steps

Once OAuth is configured:

1. **User Profile Enhancement**: Add profile picture and social links
2. **Team Invitations**: Use OAuth connections for team collaboration
3. **Single Sign-On**: Extend to enterprise SSO providers
4. **Account Recovery**: Use OAuth for password recovery options

## Support

For OAuth integration issues:

1. Check the browser console for JavaScript errors
2. Review backend logs for OAuth flow details
3. Verify environment variables are correctly set
4. Ensure redirect URIs match exactly with provider settings

The OAuth integration provides a seamless authentication experience while maintaining security and user privacy.