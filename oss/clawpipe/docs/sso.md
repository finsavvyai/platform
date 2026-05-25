# OIDC SSO

ClawPipe supports generic OpenID Connect SSO. Any compliant IdP works — verified with Okta, Azure AD, Auth0, and Keycloak.

## 1. Register the application in your IdP

Create an OIDC application with:

- **Redirect URI**: `https://api.clawpipe.ai/auth/oidc/callback`
  (replace with your gateway origin if self-hosted).
- **Grant types**: Authorization Code.
- **Response types**: `code`.
- **Scopes**: `openid email profile`.

You'll receive a **client ID**, **client secret**, and the IdP's **issuer URL**.

### Issuer URL examples

| IdP       | Issuer URL                                                                   |
|-----------|------------------------------------------------------------------------------|
| Okta      | `https://<tenant>.okta.com/oauth2/default`                                   |
| Azure AD  | `https://login.microsoftonline.com/<tenant-id>/v2.0`                         |
| Auth0     | `https://<tenant>.auth0.com/`                                                |
| Keycloak  | `https://<host>/realms/<realm>`                                              |

## 2. Push secrets to the gateway

```bash
cd gateway
echo "<issuer>"        | wrangler secret put OIDC_ISSUER
echo "<client_id>"     | wrangler secret put OIDC_CLIENT_ID
echo "<client_secret>" | wrangler secret put OIDC_CLIENT_SECRET
# Optional if the gateway is behind a non-default origin
echo "https://api.clawpipe.ai" | wrangler secret put OIDC_REDIRECT_ORIGIN
```

Nothing to redeploy — secrets are read at request time.

## 3. Verify discovery

```
curl https://api.clawpipe.ai/auth/providers
# {"google":false,"github":false,"oidc":true}
```

The dashboard sign-in page automatically reveals a **Continue with SSO** button when `oidc:true`.

## 4. Login flow

1. User clicks **Continue with SSO** → dashboard calls `GET /auth/oidc`.
2. Gateway fetches `<issuer>/.well-known/openid-configuration`, extracts the authorization endpoint, and 302-redirects the user to the IdP.
3. IdP authenticates the user and redirects back to `/auth/oidc/callback?code=…`.
4. Gateway exchanges the code at the IdP's token endpoint (with client secret) and receives `id_token`.
5. Gateway decodes the id_token payload to read `sub`, `email`, `name`, then upserts the user in D1 (linking by `sub`, falling back to email match) and issues a session cookie.
6. 302 back to `https://app.clawpipe.ai/`.

## Security notes

- The current implementation trusts the id_token since it arrives from the token endpoint over TLS in exchange for the client secret.
- For higher assurance, add JWKS signature verification against `jwks_uri` from discovery. The hook point is `decodePayload` in `gateway/src/auth/oidc.ts`.
- Users are auto-provisioned on first login. Restrict who can authenticate in the IdP itself (assignment policies, group restrictions).
- JWT sessions are HttpOnly + Secure cookies with the same TTL as other ClawPipe sessions.

## Removing SSO

`wrangler secret delete OIDC_ISSUER` (plus the other two). `/auth/providers` flips back to `oidc:false` and the dashboard hides the button.
