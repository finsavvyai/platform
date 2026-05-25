---
name: tokenforge_next_sprint_auth
description: Next sprint for TokenForge — replace Clerk with Auth.js for standalone Google/GitHub login
type: project
---

TokenForge needs its own auth system independent of OpenSyber/Clerk.

**Why:** Clerk session cookies don't work across subdomains without $10/mo satellite domain. Cross-domain redirects are fragile. Google OAuth requires custom credentials in Clerk.

**Plan:** Replace Clerk with Auth.js (NextAuth v5) for tokenforge-web.

**How to apply:**
- Install `next-auth@5` + `@auth/core`
- Add Google + GitHub OAuth providers (free, use TokenForge's own OAuth apps)
- Session stored in Cloudflare KV or D1 (not cookies dependent on domain)
- Dashboard components already use `useApi` hook — just swap token source from Clerk to Auth.js
- Remove `@clerk/nextjs` dependency from tokenforge-web
- Keep Clerk on opensyber.cloud (separate app, no conflict)

**OAuth apps needed:**
- Google Cloud Console → new OAuth client for `tokenforge.opensyber.cloud`
- GitHub → new OAuth app for `tokenforge.opensyber.cloud`

**Estimated effort:** 1 day
