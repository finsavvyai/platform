---
title: Google Workspace OIDC Setup
description: Connect Google Workspace to LunaOS as an OIDC Identity Provider.
---

# Google Workspace OIDC Setup

This guide walks a Google Workspace admin and a LunaOS org admin through setting up
OIDC-based single sign-on using Google as the Identity Provider.

::: info Why OIDC for Google?
Google recommends OAuth 2.0 / OIDC for its own integrations. While Google does support
SAML, the OIDC path offers simpler configuration, standard discovery, and automatic
key rotation via Google's JWKS endpoint. LunaOS recommends OIDC for all Google
Workspace integrations.
:::

## Prerequisites

- **Google**: Google Workspace admin access (or a standard Google account for testing
  with External user type).
- **Google Cloud**: Access to a Google Cloud project associated with your Workspace
  domain.
- **LunaOS**: Org Admin role on the Team or Enterprise plan.

---

## Step 1 — Create an OAuth client ID

1. Go to the [Google Cloud Console](https://console.cloud.google.com/) and select or
   create a project linked to your Workspace domain.
2. In the left menu, go to **APIs & Services → Credentials**.
3. Click **Create Credentials → OAuth client ID**.
4. Set **Application type** to **Web application**.
5. Enter a name — for example, `LunaOS SSO`.

<!-- SCREENSHOT: google-step-1-create-oauth-client -->

---

## Step 2 — Set the authorized redirect URI

In the **Authorized redirect URIs** section, click **Add URI** and enter:

```
https://api.lunaos.ai/v1/sso/oidc/callback
```

<!-- SCREENSHOT: google-step-2-redirect-uri -->

::: warning
The redirect URI must match exactly — including the `https://` scheme, the full
hostname, and the path. A trailing slash or typo will cause `redirect_uri_mismatch`
errors.
:::

Click **Create**.

---

## Step 3 — Copy your credentials

After creating the client, Google displays a dialog with:

- **Client ID** — a string ending in `.apps.googleusercontent.com`
- **Client secret** — a short alphanumeric secret

Copy both values and store them securely. The client secret is shown only once in
this dialog; retrieve it later from the Credentials page if needed.

<!-- SCREENSHOT: google-step-3-copy-credentials -->

---

## Step 4 — Configure the OAuth consent screen

::: info
If your consent screen is already configured, verify the scopes below are present
and skip to Step 5.
:::

1. In **APIs & Services → OAuth consent screen**, click **Edit App** (or begin
   configuration if this is new).
2. Set **User type**:
   - **Internal** — recommended for Google Workspace organizations. Only users within
     your Workspace domain can authenticate. No review required.
   - **External** — allows any Google account; requires Google review for scopes
     beyond the basic profile.
3. Fill in the required fields (app name, support email, developer contact).
4. On the **Scopes** step, add the following scopes:
   - `openid`
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/userinfo.profile`
5. Under **Authorized domains**, add `lunaos.ai`.
6. Save and continue through the remaining steps.

<!-- SCREENSHOT: google-step-4-consent-screen -->

---

## Step 5 — Note the discovery and issuer URLs

Google publishes a standard OIDC discovery document. You do not need to configure
these manually; copy them as-is into LunaOS:

| Field | Value |
|-------|-------|
| Discovery URL | `https://accounts.google.com/.well-known/openid-configuration` |
| Issuer | `https://accounts.google.com` |

---

## Step 6 — Configure in LunaOS

1. In the LunaOS dashboard, go to **Organization Settings → SSO**.
2. Click **New SSO Configuration**.
3. Select **OIDC** as the protocol.
4. Fill in the fields:

| LunaOS field | Value |
|-------------|-------|
| Client ID | From Step 3 |
| Client Secret | From Step 3 |
| Discovery URL | `https://accounts.google.com/.well-known/openid-configuration` |
| Issuer | `https://accounts.google.com` |
| Email Domain | Your Workspace primary domain, e.g., `acme.com` |
| Default Role | `member` (recommended for new JIT users) |

5. Click **Save**.

<!-- SCREENSHOT: google-step-6-lunaos-config -->

::: tip Hosted-domain enforcement
Google includes an `hd` (hosted domain) claim in the ID token for Workspace users.
LunaOS validates this claim against your configured `emailDomain`. Set `emailDomain`
to your Workspace primary domain to ensure only users from that domain can
authenticate — even if another Google account with the same email exists.
:::

---

## Step 7 — Test the connection

1. In **Organization Settings → SSO**, find your new configuration and click **Test SSO**.
2. Enter an email address from your Google Workspace domain.
3. LunaOS redirects you to Google's OAuth consent / login page.
4. Authenticate with your Workspace credentials.
5. On success, you are redirected back to the LunaOS dashboard.

<!-- SCREENSHOT: google-step-7-test-redirect -->

If the test fails, note the error code and consult the
[SSO Troubleshooting Guide](./troubleshooting.md).

---

## Notes on multi-domain Workspace organizations

If your organization has multiple primary domains in Google Workspace (e.g.,
`acme.com` and `acme.co.uk`), create a separate LunaOS SSO configuration for each
domain. Each configuration uses the same Client ID and Client Secret but a different
`emailDomain` value.
