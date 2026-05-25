---
name: ll-auth
displayName: Luna Auth Builder
description: Build complete Auth.js authentication with social providers, setup guides, and LinkedIn company page
version: 1.0.0
category: authentication
agent: luna-auth
parameters:
  - name: scope
    type: string
    description: Project or feature scope for authentication setup
    required: true
    prompt: true
  - name: providers
    type: string
    description: Comma-separated OAuth providers (google,github,microsoft,linkedin,apple,discord,twitter)
    required: false
    prompt: true
workflow:
  - analyze_codebase_and_framework
  - generate_auth_configuration
  - implement_social_providers
  - create_rbac_and_middleware
  - generate_provider_setup_guide
  - generate_linkedin_company_page
  - generate_logo_prompt
  - create_auth_report
output:
  - .luna/{current-project}/auth/
  - .luna/{current-project}/auth/auth-setup-guide.html
  - .luna/{current-project}/auth/linkedin-company-page.md
  - .luna/{current-project}/auth/auth-report.md
prerequisites:
  - .luna/{current-project}/requirements.md
  - .luna/{current-project}/design.md
---

# Luna Auth Builder

Build a complete Auth.js (NextAuth v5) authentication system with social OAuth providers, comprehensive HTML setup guides, LinkedIn company page content, and brand-matched logo prompts.

## What This Command Does

1. **Analyzes your codebase** to detect framework (Next.js, SvelteKit, Express, etc.) and existing auth patterns
2. **Generates full Auth.js configuration** with selected social providers:
   - Google OAuth 2.0
   - GitHub OAuth App
   - Microsoft Entra ID (Azure AD)
   - LinkedIn OpenID Connect
   - Apple Sign-In
   - Discord OAuth2
   - Twitter/X OAuth 2.0
   - Custom credentials (email/password)
3. **Implements RBAC** with role-based access control, protected routes, and middleware
4. **Creates a standalone HTML setup guide** with step-by-step instructions for each provider's developer console, including screenshots placeholders, callback URLs, and env var configuration
5. **Generates LinkedIn company page** content with description, tagline, about section, and product showcase text
6. **Creates a logo generation prompt** that matches your brand identity for use with AI image generators (DALL-E, Midjourney, etc.)

## Prerequisites

Requires in your current project:
- `.luna/{current-project}/requirements.md`
- `.luna/{current-project}/design.md`

If missing, run:
```bash
/luna-requirements
/luna-design
```

## Usage Instructions

When you run this command:
- **Scope**: Press ENTER for project-level or type feature name
- **Providers**: Enter comma-separated list (e.g., `google,github,microsoft,linkedin`) or press ENTER for all

## Execution Steps

1. **Codebase Analysis**: Detects framework, database, existing auth patterns, and package manager
2. **Auth.js Setup**: Generates `auth.ts` config, provider configs, Prisma adapter schema, env template
3. **Social Providers**: Configures each selected OAuth provider with proper scopes and profile mapping
4. **RBAC & Middleware**: Creates role enum, permission matrix, auth middleware, protected route helpers
5. **React/UI Components**: Generates sign-in page, sign-out button, session provider, avatar component
6. **HTML Setup Guide**: Creates a beautiful standalone HTML page with:
   - Google Cloud Console setup (OAuth consent screen, credentials)
   - GitHub Developer Settings (OAuth App creation)
   - Microsoft Entra ID (App registration, redirect URIs)
   - LinkedIn Developer Portal (app creation, OpenID Connect)
   - Apple Developer (Services ID, Sign-In configuration)
   - Discord Developer Portal (application setup)
   - Twitter/X Developer Portal (OAuth 2.0 setup)
   - Environment variable reference table
   - Callback URL reference for each provider
   - Troubleshooting section
7. **LinkedIn Company Page**: Generates ready-to-paste content:
   - Company name, tagline, industry, size
   - About section (2000 char max)
   - Product description
   - Specialties and hashtags
8. **Logo Prompt**: Creates an AI image generation prompt matching your brand for company logo
9. **Auth Report**: Summary of everything generated with next steps

## Output Files

Creates in your current project:
```
.luna/{current-project}/auth/
  src/
    auth.ts                    # Auth.js configuration
    auth.config.ts             # Provider configs
    middleware.ts              # Auth middleware
    lib/
      rbac.ts                  # Role-based access control
      auth-helpers.ts          # Server-side auth utilities
    components/
      auth-provider.tsx        # Session provider wrapper
      sign-in-form.tsx         # Sign-in page with social buttons
      user-avatar.tsx          # Authenticated user avatar
      protected-route.tsx      # Client-side route protection
    prisma/
      auth-schema.prisma       # User, Account, Session models
  .env.auth.example            # Environment variable template
  auth-setup-guide.html        # Standalone HTML setup guide
  linkedin-company-page.md     # LinkedIn company page content
  logo-prompt.md               # AI logo generation prompt
  auth-report.md               # Implementation summary
```

## Next Steps in Workflow

After auth setup:
```bash
/luna-execute     # Integrate generated auth files into your project
/luna-test        # Validate auth flows with integration tests
/luna-deploy      # Deploy with OAuth callback URLs configured
```

## Tips

- Run with all providers first, then remove unused ones from config
- The HTML guide can be shared with team members who need to set up developer accounts
- LinkedIn company page content is optimized for SEO and discoverability
- Logo prompt is tuned for consistent brand identity across platforms
- Always set `AUTH_SECRET` with `npx auth secret` before deploying
- Test OAuth flows in development with `AUTH_URL=http://localhost:3000`
