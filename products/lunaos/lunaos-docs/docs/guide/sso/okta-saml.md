---
title: Okta SAML Setup
description: Connect your Okta organization to LunaOS as a SAML 2.0 Identity Provider.
---

# Okta SAML Setup

This guide walks an Okta admin and a LunaOS org admin through creating and linking
a SAML 2.0 application in Okta to your LunaOS organization.

## Prerequisites

- **Okta**: Administrator role in your Okta organization.
- **LunaOS**: Org Admin role on the Team or Enterprise plan.

---

## Step 1 — Create an app integration in Okta

1. Sign in to the **Okta Admin Console** (`https://your-org.okta.com/admin`).
2. In the left sidebar, go to **Applications → Applications**.
3. Click **Create App Integration**.
4. In the dialog, select **SAML 2.0** and click **Next**.

<!-- SCREENSHOT: okta-step-1-create-app-integration -->

5. Enter an **App name** — for example, `LunaOS`.
6. Optionally upload the LunaOS logo.
7. Click **Next**.

---

## Step 2 — Configure SP-side settings

On the **Configure SAML** tab, fill in the following fields exactly:

| Field | Value |
|-------|-------|
| Single sign-on URL | `https://api.lunaos.ai/v1/sso/saml/callback` |
| Use this for Recipient URL and Destination URL | Checked |
| Audience URI (SP Entity ID) | `lunaos.ai` |
| Default RelayState | *(leave blank)* |
| Name ID format | `EmailAddress` |
| Application username | `Email` |
| Update application username on | `Create and update` |

<!-- SCREENSHOT: okta-step-2-sp-config -->

::: tip
Leave **Default RelayState** blank. LunaOS generates its own relay state for
security validation.
:::

Click **Next** when done.

---

## Step 3 — Attribute statements

Still on the **Configure SAML** tab, scroll to the **Attribute Statements** section
and add the following three rows:

| Name | Name format | Value |
|------|-------------|-------|
| `email` | Unspecified | `user.email` |
| `firstName` | Unspecified | `user.firstName` |
| `lastName` | Unspecified | `user.lastName` |

<!-- SCREENSHOT: okta-step-3-attribute-statements -->

::: info
These attribute names are case-sensitive. LunaOS reads `email`, `firstName`, and
`lastName` exactly as listed above for JIT user provisioning.
:::

Leave **Group Attribute Statements** empty unless you plan to map Okta groups to
LunaOS roles (Enterprise tier only).

Click **Next**.

---

## Step 4 — Assignments

On the **Assignments** tab:

1. Choose **Assign to specific people** or **Assign to specific groups**,
   depending on your rollout scope.
2. Add the users or groups who should have access to LunaOS.
3. Click **Done**.

<!-- SCREENSHOT: okta-step-4-assignments -->

::: warning
Users not assigned to the Okta app will receive an error when they try to log in
to LunaOS via SSO, even if their email domain matches the SSO configuration.
:::

---

## Step 5 — Copy IdP metadata

1. On the application page, go to the **Sign On** tab.
2. Click **View SAML setup instructions**.
3. Copy the following three values — you will paste them into LunaOS next:

| Value | Where to find it |
|-------|-----------------|
| Identity Provider Single Sign-On URL | Listed as "Identity Provider Single Sign-On URL" |
| Identity Provider Issuer | Listed as "Identity Provider Issuer" |
| X.509 Certificate | Listed under "X.509 Certificate" — click **Download certificate** or copy the PEM text |

<!-- SCREENSHOT: okta-step-5-idp-metadata -->

Keep this tab open while you complete Step 6.

---

## Step 6 — Configure in LunaOS

1. In the LunaOS dashboard, go to **Organization Settings → SSO**.
2. Click **New SSO Configuration**.
3. Select **SAML 2.0** as the protocol.
4. Fill in the fields:

| LunaOS field | Value from Okta |
|-------------|-----------------|
| IdP SSO URL | Identity Provider Single Sign-On URL |
| IdP Entity ID (Issuer) | Identity Provider Issuer |
| X.509 Certificate | Paste the full PEM certificate (including `-----BEGIN CERTIFICATE-----` header) |
| Email Domain | Your organization's email domain, e.g., `acme.com` |
| Default Role | `member` (recommended for new JIT users) |

5. Click **Save**.

<!-- SCREENSHOT: okta-step-6-lunaos-config -->

---

## Step 7 — Test the connection

1. In **Organization Settings → SSO**, find your new configuration and click **Test SSO**.
2. Enter an email address belonging to your Okta-managed domain.
3. LunaOS redirects you to Okta's login page.
4. Authenticate with your Okta credentials.
5. On success, you are redirected back to the LunaOS dashboard.

<!-- SCREENSHOT: okta-step-7-test-redirect -->

::: tip
Run this test before enabling **Enforce SSO**. A passing test confirms the full
round-trip: LunaOS → Okta → LunaOS callback → session.
:::

If the test fails, note the error code in the URL or page and consult the
[SSO Troubleshooting Guide](./troubleshooting.md).
