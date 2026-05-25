---
title: SSO Troubleshooting
description: Error code reference and fix steps for LunaOS enterprise SSO.
---

# SSO Troubleshooting

## Error code reference

| Code | Short name | Protocol |
|------|-----------|----------|
| [SSO_001](#sso_001) | `signature_invalid` | SAML |
| [SSO_002](#sso_002) | `audience_mismatch` | SAML |
| [SSO_003](#sso_003) | `nonce_missing` / `nonce_mismatch` | OIDC |
| [SSO_004](#sso_004) | `idp_not_found` | SAML + OIDC |
| [SSO_005](#sso_005) | `jit_disabled` | SAML + OIDC |
| [SSO_006](#sso_006) | `email_domain_mismatch` | SAML + OIDC |
| [SSO_007](#sso_007) | `replay_detected` | SAML |
| [SSO_008](#sso_008) | `response_expired` | SAML |
| [SSO_009](#sso_009) | `inresponseto_mismatch` | SAML |
| [SSO_010](#sso_010) | `xxe_blocked` | SAML |
| [SSO_011](#sso_011) | `unsupported_signature_algorithm` | SAML |
| [SSO_012](#sso_012) | `open_redirect_blocked` | OIDC |

---

## SSO_001 — signature_invalid

### Cause

LunaOS could not verify the cryptographic signature on the SAML assertion. This
usually means the certificate stored in the LunaOS SSO configuration does not match
the certificate the IdP used to sign the response.

### Fix

1. In your IdP admin console, locate the current active signing certificate.
2. Export or copy the full PEM-encoded certificate (including the
   `-----BEGIN CERTIFICATE-----` and `-----END CERTIFICATE-----` lines).
3. In the LunaOS dashboard, go to **Organization Settings → SSO → Edit** for your
   SAML configuration.
4. Replace the **X.509 Certificate** field with the newly exported certificate and
   save.

### IdP-specific notes

- **Okta**: Go to **Applications → \<app\> → Sign On → SAML Signing Certificates**.
  Confirm the certificate marked **Active** matches what is stored in LunaOS.
- **Azure / Entra ID**: Go to **Enterprise Applications → \<app\> →
  Single sign-on → SAML Signing Certificate**. Download the **Certificate (Base64)**
  and compare it with the LunaOS-stored value.
- **All IdPs**: If you recently rotated the signing certificate in your IdP without
  updating LunaOS, this error is expected. Follow the fix steps above.

---

## SSO_002 — audience_mismatch

### Cause

The `Audience` element in the SAML assertion does not equal `lunaos.ai`. LunaOS
rejects assertions not explicitly addressed to it.

### Fix

1. In your IdP, open the SAML application configuration.
2. Locate the **Audience URI** or **SP Entity ID** field.
3. Set it to exactly `lunaos.ai` (no trailing slash, no `https://`).
4. Save and re-test.

### IdP-specific notes

- **Okta**: The field is labeled **Audience URI (SP Entity ID)** in the **Configure
  SAML** step.
- **Azure / Entra ID**: The field is labeled **Identifier (Entity ID)** in **Basic
  SAML Configuration**.
- **Other IdPs**: Check documentation for "SP Entity ID" or "Audience Restriction".

---

## SSO_003 — nonce_missing / nonce_mismatch

### Cause

For OIDC flows, LunaOS embeds a `nonce` in the authorization request and validates
it against the ID token. This error occurs when:

- The IdP stripped the nonce from the ID token, or
- The browser state (cookie or session) was lost between redirect and callback.

### Fix

1. Confirm your browser allows third-party cookies or has cookies enabled for
   `api.lunaos.ai`.
2. Clear browser cookies and cache for `api.lunaos.ai` and retry the login flow.
3. If the error recurs in a private/incognito window, check whether your IdP's OIDC
   implementation returns the `nonce` claim in ID tokens. It is required by the OIDC
   spec but some providers omit it.
4. Contact support at support@lunaos.ai with the request correlation ID if the issue
   persists.

### IdP-specific notes

- **Google Workspace**: Google includes the `nonce` in the ID token. If this error
  appears with Google, the browser state was most likely lost. Retry in a fresh tab.

---

## SSO_004 — idp_not_found

### Cause

LunaOS could not find an SSO configuration for the email domain entered at login.
Either no configuration exists for this domain, or the `emailDomain` field in the
LunaOS SSO configuration does not match the domain part of the user's email address.

### Fix

1. In the LunaOS dashboard, go to **Organization Settings → SSO**.
2. Confirm an SSO configuration exists for your organization.
3. Verify the **Email Domain** field matches the domain suffix of the user's email
   exactly (e.g., `acme.com` for `user@acme.com`).
4. If the user has an alias or secondary domain, create a separate SSO configuration
   for that domain or update the existing one.

### IdP-specific notes

- This error is IdP-agnostic. It is resolved entirely in the LunaOS SSO configuration.

---

## SSO_005 — jit_disabled

### Cause

The user does not exist in LunaOS and Just-in-Time provisioning is disabled in your
SSO configuration. LunaOS cannot create the account automatically.

### Fix

1. **Enable JIT provisioning** (recommended): In **Organization Settings → SSO →
   Edit**, toggle **Allow JIT provisioning** to **On** and set a **Default Role**.
2. **Pre-provision the user** (alternative): Invite the user manually via
   **Organization Settings → Members → Invite**. They must accept the invitation
   before they can log in via SSO.

### IdP-specific notes

- This error is IdP-agnostic.

---

## SSO_006 — email_domain_mismatch

### Cause

The email address in the SAML assertion or OIDC ID token does not match the
`emailDomain` configured for this SSO integration. This is a security control that
prevents users from other domains from logging in via your IdP.

### Fix

1. Confirm the user's email address in the IdP (not just their login username).
2. In **Organization Settings → SSO → Edit**, verify the **Email Domain** field.
3. If your organization uses multiple domains, create an additional SSO configuration
   for the second domain.

### IdP-specific notes

- **Okta**: Check **Profile → Login** in Okta to confirm the user's email attribute
  (`user.email`) matches the expected domain.
- **Azure / Entra ID**: Verify the user's `mail` attribute in Entra ID. Guest
  accounts often have an external email that does not match your tenant domain.
- **Google Workspace**: Confirm the `hd` (hosted domain) claim in the ID token
  matches your Workspace primary domain. Secondary domains may use a different `hd`
  value.

---

## SSO_007 — replay_detected

### Cause

LunaOS detected that the SAML assertion ID (`AssertionID`) has already been used
within the replay-prevention window (15 minutes). This protects against assertion
replay attacks.

### Fix

1. Do not resubmit or refresh the SSO callback URL.
2. Initiate a fresh login from the LunaOS login page.
3. If this error appears on first login attempts, check that your IdP is not caching
   and resending old assertions. Some reverse proxies or load balancers can cause
   this.

### IdP-specific notes

- This error is most common when developers test SSO by reusing a copied callback URL.
  Always start from the LunaOS login page.

---

## SSO_008 — response_expired

### Cause

The SAML assertion's `NotOnOrAfter` condition has passed. The response was generated
by the IdP more than 5 minutes ago (or the configured clock-skew tolerance).

This usually indicates a clock synchronization issue between the IdP server and the
LunaOS API, or an unusually long network round-trip.

### Fix

1. Confirm the IdP server's system clock is synchronized via NTP.
2. On a VM or container-based IdP, reboot or force an NTP sync if the clock has
   drifted.
3. If this error appears intermittently, the issue is likely transient clock drift.
   Contact support@lunaos.ai with the correlation ID to request an increase in
   clock-skew tolerance.

### IdP-specific notes

- **Azure / Entra ID**: Azure's infrastructure is NTP-synchronized; this error is
  rare. If it occurs, check your network path for unusual latency.
- **Self-hosted IdPs (Shibboleth, Keycloak)**: Verify system clock accuracy on the
  server.

---

## SSO_009 — inresponseto_mismatch

### Cause

The `InResponseTo` attribute in the SAML response does not match the `ID` of the
AuthnRequest that LunaOS sent. This can happen if:

- The user opened multiple SSO login tabs simultaneously.
- The browser session state was reset between sending the request and receiving
  the response.
- An intermediary modified the SAML response.

### Fix

1. Close all login tabs and start a single fresh login from the LunaOS login page.
2. Clear browser cookies and cache for `api.lunaos.ai`.
3. Ensure no browser extension or proxy is modifying HTTP responses.

### IdP-specific notes

- This error is IdP-agnostic.

---

## SSO_010 — xxe_blocked

### Cause

LunaOS's SAML parser detected an XML External Entity (XXE) reference in the SAML
document and blocked it. This is a security protection; XXE in SAML documents is
a known attack vector.

::: warning Security event
`SSO_010` may indicate an active attack or a malformed assertion from the IdP.
Review your audit log for `sso.idp.login_failure` events and contact
security@lunaos.ai if you see multiple occurrences.
:::

### Fix

1. Check whether your IdP is inserting unexpected XML processing instructions or
   DOCTYPE declarations. Well-behaved SAML IdPs do not include DTD declarations.
2. If you are using a custom SAML proxy or middleware, verify it is not adding
   external entity references.
3. Contact support@lunaos.ai with the raw SAML response (remove sensitive claim
   values first) for diagnosis.

### IdP-specific notes

- Major cloud IdPs (Okta, Azure, Google) do not produce XXE-vulnerable SAML.
  This error is most common with self-hosted IdPs or custom SAML libraries.

---

## SSO_011 — unsupported_signature_algorithm

### Cause

The SAML assertion was signed with an algorithm that LunaOS does not accept.
LunaOS requires:

- **Signature algorithm**: `http://www.w3.org/2001/04/xmldsig-more#rsa-sha256`
  (RSA-SHA256) or stronger.
- **Digest algorithm**: `http://www.w3.org/2001/04/xmlenc#sha256` (SHA-256)
  or stronger.

SHA-1 based algorithms (`rsa-sha1`, `sha1`) are rejected.

### Fix

1. In your IdP's SAML app configuration, locate the signature algorithm setting.
2. Set both the **Signature Algorithm** and **Digest Algorithm** to SHA-256 or
   SHA-512.
3. Save the IdP configuration and re-test.

### IdP-specific notes

- **Okta**: Signature algorithm is set per application under
  **Applications → \<app\> → Sign On → Advanced Sign-On Settings**.
- **Azure / Entra ID**: Entra ID uses SHA-256 by default. If you see this error with
  Azure, verify a custom certificate configuration has not forced SHA-1.
- **Other IdPs**: Search for "signing algorithm" in your IdP documentation.

---

## SSO_012 — open_redirect_blocked

### Cause

LunaOS blocked an OIDC `redirect_uri` or post-login redirect URL that is not on the
allowlist. This is a security control to prevent open redirect attacks.

### Fix

1. Verify the redirect URI in your IdP's OAuth client configuration matches the
   LunaOS-registered URI exactly:

   ```
   https://api.lunaos.ai/v1/sso/oidc/callback
   ```

2. Do not include query parameters or fragments in the registered redirect URI.
3. If your LunaOS organization is on a custom domain, contact support@lunaos.ai to
   register the additional redirect URI.

### IdP-specific notes

- **Google**: The redirect URI must match character-for-character what is registered
  in **APIs & Services → Credentials → Authorized redirect URIs**. A trailing slash
  counts as a mismatch.
- **Okta / Azure**: Verify the callback URL in the OIDC app settings matches the
  LunaOS value above.
