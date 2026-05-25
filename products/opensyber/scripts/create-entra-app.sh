#!/usr/bin/env bash
# Create and configure a Microsoft Entra app registration via Graph API.
# Zero external deps beyond curl + jq. Uses device-code OAuth so the
# first invocation opens a browser once; subsequent runs reuse the
# token from ~/.opensyber-entra-token.json until it expires.
#
# Usage:
#   ./scripts/create-entra-app.sh tokenforge
#   ./scripts/create-entra-app.sh opensyber   (only if you need to rebuild)
#
# Output: client-id, tenant-id, client-secret, ready to pipe into
# wrangler secret put.
set -euo pipefail

if ! command -v jq >/dev/null 2>&1; then
  echo "fatal: jq is required. brew install jq" >&2
  exit 1
fi

APP_KEY="${1:-}"
if [[ -z "$APP_KEY" ]]; then
  echo "usage: $0 <tokenforge|opensyber>" >&2
  exit 1
fi

# Microsoft Graph well-known client ID (az CLI uses this) — allows
# device-code flow without registering a separate "provisioning" app.
# Scopes: Application.ReadWrite.All + Directory.Read.All + offline_access.
MSGRAPH_CLIENT_ID="04b07795-8ddb-461a-bbee-02f9e1bf7b46"
TOKEN_CACHE="${HOME}/.opensyber-entra-token.json"

case "$APP_KEY" in
  tokenforge)
    DISPLAY_NAME="TokenForge"
    HOME_URL="https://tokenforge.opensyber.cloud"
    REDIRECT_URIS='["https://tokenforge.opensyber.cloud/api/auth/callback/microsoft-entra-id","http://localhost:3001/api/auth/callback/microsoft-entra-id"]'
    LOGOUT_URL="https://tokenforge.opensyber.cloud/api/auth/signout"
    TOS_URL="https://tokenforge.opensyber.cloud/terms"
    PRIVACY_URL="https://tokenforge.opensyber.cloud/privacy"
    LOGO_PATH="apps/web/public/brand/logo-mark-240.png"
    WRANGLER_DIR="apps/tokenforge-web"
    ;;
  opensyber)
    DISPLAY_NAME="OpenSyber"
    HOME_URL="https://opensyber.cloud"
    REDIRECT_URIS='["https://opensyber.cloud/api/auth/callback/microsoft-entra-id","https://www.opensyber.cloud/api/auth/callback/microsoft-entra-id","https://app.opensyber.cloud/api/auth/callback/microsoft-entra-id","http://localhost:3000/api/auth/callback/microsoft-entra-id"]'
    LOGOUT_URL="https://opensyber.cloud/api/auth/signout"
    TOS_URL="https://opensyber.cloud/terms"
    PRIVACY_URL="https://opensyber.cloud/privacy"
    LOGO_PATH="apps/web/public/brand/logo-mark-240.png"
    WRANGLER_DIR="apps/web"
    ;;
  *)
    echo "fatal: unknown app key '$APP_KEY' (expected tokenforge|opensyber)" >&2
    exit 1
    ;;
esac

# ── Token acquisition ────────────────────────────────────────────────
get_token() {
  # Reuse cached token if still valid.
  if [[ -f "$TOKEN_CACHE" ]]; then
    local exp
    exp=$(jq -r '.expires_at // 0' "$TOKEN_CACHE")
    if (( exp > $(date +%s) + 60 )); then
      jq -r '.access_token' "$TOKEN_CACHE"
      return
    fi
  fi

  echo "Starting device-code auth for Microsoft Graph..." >&2
  local dev_code_response
  dev_code_response=$(curl -sS -X POST \
    "https://login.microsoftonline.com/common/oauth2/v2.0/devicecode" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "client_id=${MSGRAPH_CLIENT_ID}" \
    -d "scope=https://graph.microsoft.com/Application.ReadWrite.All https://graph.microsoft.com/Directory.Read.All offline_access")

  local device_code user_code verification_uri verification_uri_complete
  device_code=$(echo "$dev_code_response" | jq -r .device_code)
  user_code=$(echo "$dev_code_response" | jq -r .user_code)
  verification_uri=$(echo "$dev_code_response" | jq -r .verification_uri)
  verification_uri_complete=$(echo "$dev_code_response" | jq -r '.verification_uri_complete // empty')

  echo >&2
  echo "────────────────────────────────────────────────────────" >&2
  if [[ -n "$verification_uri_complete" ]]; then
    echo "  Open this URL (code pre-filled):" >&2
    echo "    $verification_uri_complete" >&2
    echo >&2
    echo "  Fallback — paste code manually at $verification_uri :" >&2
    echo "    code: $user_code" >&2
  else
    echo "  Open: $verification_uri" >&2
    echo "  Code: $user_code" >&2
  fi
  echo "────────────────────────────────────────────────────────" >&2
  echo >&2
  if command -v open >/dev/null 2>&1; then
    open "${verification_uri_complete:-$verification_uri}" >/dev/null 2>&1 || true
  fi

  # Poll for token.
  while true; do
    sleep 5
    local token_response
    token_response=$(curl -sS -X POST \
      "https://login.microsoftonline.com/common/oauth2/v2.0/token" \
      -H "Content-Type: application/x-www-form-urlencoded" \
      -d "grant_type=urn:ietf:params:oauth:grant-type:device_code" \
      -d "client_id=${MSGRAPH_CLIENT_ID}" \
      -d "device_code=${device_code}")

    local err access
    err=$(echo "$token_response" | jq -r '.error // ""')
    access=$(echo "$token_response" | jq -r '.access_token // ""')

    if [[ -n "$access" ]]; then
      local expires_in
      expires_in=$(echo "$token_response" | jq -r .expires_in)
      local expires_at=$(( $(date +%s) + expires_in - 60 ))
      echo "$token_response" | jq --arg exp "$expires_at" '. + {expires_at: ($exp | tonumber)}' > "$TOKEN_CACHE"
      chmod 600 "$TOKEN_CACHE"
      echo "$access"
      return
    fi

    case "$err" in
      authorization_pending) continue ;;
      slow_down) sleep 5; continue ;;
      expired_token|access_denied)
        echo "fatal: device code flow failed ($err)" >&2
        exit 1
        ;;
      *)
        echo "fatal: unexpected response: $token_response" >&2
        exit 1
        ;;
    esac
  done
}

# ── Graph API helpers ────────────────────────────────────────────────
graph() {
  local method="$1" path="$2" body="${3:-}"
  local -a args=(-sS -X "$method" "https://graph.microsoft.com/v1.0${path}" -H "Authorization: Bearer ${TOKEN}" -H "Content-Type: application/json")
  if [[ -n "$body" ]]; then args+=(-d "$body"); fi
  curl "${args[@]}"
}

echo "▶ Acquiring Graph access token..."
TOKEN=$(get_token)
echo "  ✓ token acquired"

# Tenant ID from the token (decode JWT middle segment).
TENANT_ID=$(echo "$TOKEN" | awk -F. '{print $2}' | base64 -D 2>/dev/null | jq -r .tid 2>/dev/null || echo "")
if [[ -z "$TENANT_ID" ]]; then
  echo "fatal: could not extract tenant ID from token" >&2
  exit 1
fi
echo "▶ Tenant ID: $TENANT_ID"

# ── Step 1: Create the application ───────────────────────────────────
echo "▶ Creating application '$DISPLAY_NAME'..."
CREATE_BODY=$(jq -n \
  --arg name "$DISPLAY_NAME" \
  --arg home "$HOME_URL" \
  --arg logout "$LOGOUT_URL" \
  --arg tos "$TOS_URL" \
  --arg privacy "$PRIVACY_URL" \
  --argjson redirects "$REDIRECT_URIS" \
  '{
    displayName: $name,
    signInAudience: "AzureADandPersonalMicrosoftAccount",
    web: {
      redirectUris: $redirects,
      logoutUrl: $logout,
      implicitGrantSettings: { enableAccessTokenIssuance: false, enableIdTokenIssuance: false }
    },
    info: {
      marketingUrl: $home,
      termsOfServiceUrl: $tos,
      privacyStatementUrl: $privacy,
      supportUrl: ($home + "/support")
    },
    requiredResourceAccess: [{
      resourceAppId: "00000003-0000-0000-c000-000000000000",
      resourceAccess: [
        { id: "37f7f235-527c-4136-accd-4a02d197296e", type: "Scope" },
        { id: "14dad69e-099b-42c9-810b-d002981feec1", type: "Scope" },
        { id: "64a6cdd6-aab1-4aaf-94b8-3cc8405e90d0", type: "Scope" },
        { id: "7427e0e9-2fba-42fe-b0c0-848c9e6a8182", type: "Scope" },
        { id: "e1fe6dd8-ba31-4d61-89e7-88639da4683d", type: "Scope" }
      ]
    }]
  }')

CREATE_RESPONSE=$(graph POST "/applications" "$CREATE_BODY")
APP_ID=$(echo "$CREATE_RESPONSE" | jq -r .appId)
OBJECT_ID=$(echo "$CREATE_RESPONSE" | jq -r .id)

if [[ -z "$APP_ID" || "$APP_ID" == "null" ]]; then
  echo "fatal: create failed:" >&2
  echo "$CREATE_RESPONSE" | jq >&2
  exit 1
fi
echo "  ✓ clientId:  $APP_ID"
echo "  ✓ objectId:  $OBJECT_ID"

# ── Step 2: Add optional ID-token claims ────────────────────────────
echo "▶ Configuring optional token claims..."
CLAIMS_BODY=$(jq -n '{
  optionalClaims: {
    idToken: [
      {name: "email",              essential: false, additionalProperties: []},
      {name: "preferred_username", essential: false, additionalProperties: []},
      {name: "family_name",        essential: false, additionalProperties: []},
      {name: "given_name",         essential: false, additionalProperties: []}
    ]
  }
}')
graph PATCH "/applications/${OBJECT_ID}" "$CLAIMS_BODY" > /dev/null
echo "  ✓ claims added"

# ── Step 3: Upload logo ──────────────────────────────────────────────
if [[ -f "$LOGO_PATH" ]]; then
  echo "▶ Uploading logo..."
  curl -sS -X PUT "https://graph.microsoft.com/v1.0/applications/${OBJECT_ID}/logo" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: image/png" \
    --data-binary "@${LOGO_PATH}" > /dev/null
  echo "  ✓ logo uploaded ($LOGO_PATH)"
else
  echo "⚠ logo not found at $LOGO_PATH — skipping upload"
fi

# ── Step 4: Create client secret ────────────────────────────────────
echo "▶ Creating client secret (24 months)..."
SECRET_BODY=$(jq -n --arg key "$APP_KEY" '{
  passwordCredential: {
    displayName: ($key + "-prod-auto"),
    endDateTime: (now + 60 * 60 * 24 * 365 * 2 | todate)
  }
}')
SECRET_RESPONSE=$(graph POST "/applications/${OBJECT_ID}/addPassword" "$SECRET_BODY")
SECRET_VALUE=$(echo "$SECRET_RESPONSE" | jq -r .secretText)

if [[ -z "$SECRET_VALUE" || "$SECRET_VALUE" == "null" ]]; then
  echo "fatal: secret create failed:" >&2
  echo "$SECRET_RESPONSE" | jq >&2
  exit 1
fi
echo "  ✓ secret created"

# ── Step 5: Set Cloudflare wrangler secrets ─────────────────────────
echo "▶ Setting Cloudflare secrets for ${WRANGLER_DIR}..."
(
  cd "$WRANGLER_DIR"
  echo "$APP_ID"    | npx wrangler secret put AZURE_AD_CLIENT_ID 2>&1 | tail -1
  echo "common"     | npx wrangler secret put AZURE_AD_TENANT_ID 2>&1 | tail -1
  echo "$SECRET_VALUE" | npx wrangler secret put AZURE_AD_CLIENT_SECRET 2>&1 | tail -1
)

echo
echo "════════════════════════════════════════════════════════"
echo "  ✅ $DISPLAY_NAME Entra app created"
echo "────────────────────────────────────────────────────────"
echo "  Client ID:   $APP_ID"
echo "  Tenant ID:   $TENANT_ID  (env var: common)"
echo "  Object ID:   $OBJECT_ID"
echo "  Home URL:    $HOME_URL"
echo "  Secrets:     set in $WRANGLER_DIR"
echo "────────────────────────────────────────────────────────"
echo
echo "  Remaining manual steps (not API-accessible):"
echo "  1. Publisher domain — Entra portal → Branding & properties"
echo "     → Publisher domain → enter 'opensyber.cloud' → Verify"
echo "  2. Add this appId to opensyber.cloud/.well-known file:"
echo "     apps/web/public/.well-known/microsoft-identity-association.json"
echo "     (already proves publisher domain for OpenSyber — add TokenForge appId"
echo "      to the associatedApplications array)"
echo "  3. Grant admin consent for delegated permissions:"
echo "     Entra portal → API permissions → 'Grant admin consent'"
echo "════════════════════════════════════════════════════════"
