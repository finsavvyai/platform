# slack — REAL

Status: **REAL** — needs CLIENT_ID/SECRET at runtime.

## Required environment variables

- `SLACK_CLIENT_ID`
- `SLACK_CLIENT_SECRET`
- `SLACK_REDIRECT_URI`
- `SLACK_SIGNING_SECRET` (for inbound Events API signature verification)

## What's implemented

- `Authenticate` — POST `/api/oauth.v2.access` (form-encoded). Stores `team_id` + `bot_user_id` in `Token.Extra`.
- `ListResources` — GET `/api/conversations.list` with `cursor`/`response_metadata.next_cursor` pagination.
- `Fetch` — GET `/api/conversations.history?channel=...`, returns concatenated message text.
- `Search` — GET `/api/search.messages?query=...`. Returns `ErrTierLimited` for free workspaces (`paid_only` / `not_allowed_token_type` / `team_not_authorized`).
- `Watch` — POST `/api/apps.event.subscriptions.update` to register `message.channels` + `message.groups`. Channel closes on ctx cancel.

## Bot scopes

- `channels:history`, `channels:read`, `groups:read`, `users:read`

## Tests

`connector_test.go` exercises OAuth, `ok:false` error path, cursor
pagination, history fetch, search success, search tier-limited error,
and registry metadata.
