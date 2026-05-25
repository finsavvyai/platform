# github — REAL

Status: **REAL** — needs CLIENT_ID/SECRET (and App credentials) at runtime.

## Required environment variables

- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GITHUB_REDIRECT_URI`
- `GITHUB_APP_ID` (for installation token minting outside this connector)
- `GITHUB_PRIVATE_KEY` (PEM; used by the JWT-mint helper that swaps the OAuth token for an installation access token in production)

## What's implemented

- `Authenticate` — POST `/login/oauth/access_token` (form-encoded, `Accept: application/json`). Stores the resulting bearer token.
- `ListResources` — GET `/installation/repositories` with `Link: rel="next"` Header pagination, `X-GitHub-Api-Version: 2022-11-28`.
- `Fetch` — GET `/repos/{owner}/{repo}/issues/{number}` (resource id format `owner/repo#number`). Returns Markdown body.
- `Search` — GET `/search/issues?q=...`.
- `Watch` — POST `/repos/{owner}/{repo}/hooks` for the first available installation repo with events `push`, `issues`, `pull_request`. Channel closes on ctx cancel.

## App permissions

- `contents:read`, `metadata:read`, `issues:read`, `pull_requests:read`

## Tests

`connector_test.go` exercises OAuth exchange (success + error), Link-header
pagination, issue fetch, malformed resource id, search round-trip, and
registry metadata.
