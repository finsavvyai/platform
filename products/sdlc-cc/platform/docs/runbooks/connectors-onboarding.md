# Connector onboarding (per vendor)

Every connector needs a registered OAuth app on the vendor side before
it can move from `stubs.Stub` to a real implementation. This runbook
captures the per-vendor checklist so the daily routine knows exactly
what's blocked.

## Status

| Connector | OAuth app registered? | Owner | Notes |
| --- | --- | --- | --- |
| google_workspace | ❌ | TBD | Need GCP project + OAuth consent screen verified |
| microsoft365 | ❌ | TBD | Need Azure AD app registration with Graph API permissions |
| slack | ❌ | TBD | Need Slack app with `users:read`, `channels:history` scopes |
| github | ❌ | TBD | GitHub App (NOT OAuth) with read-only repo perms |
| atlassian | ❌ | TBD | Atlassian Connect app via developer console |
| notion | ❌ | TBD | Notion integration with read-only workspace access |
| salesforce | ❌ | TBD | Connected App with Bulk API enabled |
| zendesk | ❌ | TBD | OAuth client in admin -> apps -> add API |
| servicenow | ❌ | TBD | OAuth provider + REST API user |
| hubspot | ❌ | TBD | Public app with `crm.objects.contacts.read` etc. |

## How to wire one

1. Register the OAuth app on the vendor side. Capture client_id +
   client_secret + redirect_uri.
2. Store secrets in Vault under `secret/connectors/<name>`.
3. Replace the stub at
   `services/gateway/internal/connectors/<name>/connector.go`
   (create the directory; remove the stub from
   `internal/connectors/stubs/stubs.go`'s `names` list).
4. Implement Authenticate / ListResources / Fetch / Search / Watch.
   Add tests using a recorded HTTP fixture (no live calls in CI).
5. Add a per-connector docs page at
   `docs/connectors/<name>.md` covering scopes + setup steps for the
   customer admin.
6. Wire into the marketplace UI page (Day 48) by adding a
   metadata entry.

## Blocker policy for the daily routine

When the routine reaches Days 40-48 it writes to
`docs/roadmap/blocked-days.md` with the specific vendor + scope
asks. The runbook here is the canonical source for what each ask
looks like, so the human providing credentials can self-serve.
