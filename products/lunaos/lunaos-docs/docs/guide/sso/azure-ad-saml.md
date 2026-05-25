---
title: Microsoft Entra ID (Azure AD) SAML Setup
description: Connect Microsoft Entra ID to LunaOS as a SAML 2.0 Identity Provider.
---

# Microsoft Entra ID SAML Setup

This guide covers connecting Microsoft Entra ID (formerly Azure Active Directory) to
LunaOS using SAML 2.0. You need a Global Administrator or Application Administrator
role in your Entra ID tenant, and Org Admin access in LunaOS.

## Prerequisites

- **Microsoft Entra ID**: Global Administrator or Application Administrator role in
  your tenant.
- **LunaOS**: Org Admin role on the Team or Enterprise plan.

---

## Step 1 — Create an enterprise application

1. Sign in to the **Microsoft Entra admin center** at
   `https://entra.microsoft.com`.
2. In the left sidebar, go to **Identity → Applications → Enterprise applications**.
3. Click **New application**.
4. Click **Create your own application**.
5. In the panel that opens:
   - Enter a name — for example, `LunaOS`.
   - Select **Integrate any other application you don't find in the gallery
     (Non-gallery)**.
6. Click **Create**.

<!-- SCREENSHOT: azure-step-1-create-app -->

---

## Step 2 — Open Single sign-on settings

1. In the application overview, click **Single sign-on** in the left menu.
2. Select **SAML** as the sign-on method.

<!-- SCREENSHOT: azure-step-2-select-saml -->

---

## Step 3 — Basic SAML configuration

Click the **Edit** icon on the **Basic SAML Configuration** card and enter the
following values:

| Field | Value |
|-------|-------|
| Identifier (Entity ID) | `lunaos.ai` |
| Reply URL (Assertion Consumer Service URL) | `https://api.lunaos.ai/v1/sso/saml/callback` |
| Sign on URL | *(leave blank — SP-initiated only)* |
| Relay State | *(leave blank)* |
| Logout URL | *(leave blank)* |

<!-- SCREENSHOT: azure-step-3-basic-saml-config -->

Click **Save**.

::: warning Unsigned AuthnRequest
LunaOS v1 sends an **unsigned** AuthnRequest. Microsoft Entra ID accepts unsigned
requests by default. Support for signed AuthnRequests arrives in LunaOS v2
(Enterprise tier). No configuration change is required on your Entra ID side for
v1.
:::

---

## Step 4 — Attributes and claims

Click the **Edit** icon on the **Attributes & Claims** card.

Ensure the following claims are present (create or edit as needed):

| Claim name | Source attribute |
|------------|-----------------|
| `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress` | `user.mail` |
| `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname` | `user.givenname` |
| `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname` | `user.surname` |

Also verify the **Name identifier value** (NameID):

- **Source**: Attribute
- **Source attribute**: `user.mail`
- **Format**: `Email address`

<!-- SCREENSHOT: azure-step-4-attributes-claims -->

::: info
LunaOS reads the `emailaddress`, `givenname`, and `surname` claims for JIT user
provisioning. Using `user.mail` for NameID ensures the identifier matches the
email used for domain discovery.
:::

Click **Save**.

---

## Step 5 — Download the signing certificate

1. On the SAML setup page, scroll to the **SAML Signing Certificate** section.
2. Next to **Certificate (Base64)**, click **Download** to save the `.cer` file.
3. Also copy the following two values from the **Set up \<app name\>** section
   at the bottom of the page:

| Value | Label in Entra ID |
|-------|------------------|
| IdP SSO URL | Login URL |
| IdP Entity ID (Issuer) | Azure AD Identifier |

<!-- SCREENSHOT: azure-step-5-certificate-download -->

---

## Step 6 — Assign users and groups

1. In the application's left menu, click **Users and groups**.
2. Click **Add user/group**.
3. Select the users or groups that should have access to LunaOS.
4. Click **Assign**.

<!-- SCREENSHOT: azure-step-6-assign-users -->

::: warning
Users not assigned to the enterprise application will receive an
`AADSTS50105` error from Entra ID when attempting to log in via SSO.
:::

---

## Step 7 — Configure in LunaOS

1. In the LunaOS dashboard, go to **Organization Settings → SSO**.
2. Click **New SSO Configuration**.
3. Select **SAML 2.0** as the protocol.
4. Fill in the fields:

| LunaOS field | Value from Entra ID |
|-------------|---------------------|
| IdP SSO URL | Login URL |
| IdP Entity ID (Issuer) | Azure AD Identifier |
| X.509 Certificate | Open the downloaded `.cer` file in a text editor and paste the full PEM content |
| Email Domain | Your organization's email domain, e.g., `acme.com` |
| Default Role | `member` (recommended for new JIT users) |

5. Click **Save**.

<!-- SCREENSHOT: azure-step-7-lunaos-config -->

Test the connection as described in the [Admin Guide](./admin-guide.md#enabling-sso).
If the test fails, consult the [SSO Troubleshooting Guide](./troubleshooting.md).
