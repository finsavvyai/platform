# notion — REAL

Status: **REAL** — needs CLIENT_ID/SECRET at runtime.

## Required environment variables

- `NOTION_CLIENT_ID`
- `NOTION_CLIENT_SECRET`
- `NOTION_REDIRECT_URI`

## What's implemented

- `Authenticate` — POST `/v1/oauth/token` with `Authorization: Basic base64(client_id:client_secret)` and JSON body `{grant_type, code, redirect_uri}`. `Notion-Version: 2022-06-28`. Stores `bot_id` + `workspace_id` + `workspace_name` in `Token.Extra`.
- `ListResources` — POST `/v1/search` with empty query, paginates via `next_cursor` / `has_more`.
- `Fetch` — GET `/v1/pages/{id}` for metadata, then `/v1/blocks/{id}/children` (paginated) for paragraph text.
- `Search` — POST `/v1/search` with `{query: "<q>", page_size: 100}`.
- `Watch` — POST `/v1/webhooks` to register `page.updated` + `database.updated`. If the workspace can't register webhooks (free tier returns 4xx), automatically falls back to a polling loop driven by `PollInterval` that emits `ChangeEvent` whenever a resource's `last_edited_time` advances. Cancelling ctx closes the channel.

## Capabilities

- `read_content`, `read_user_with_email`

## Tests

`connector_test.go` exercises OAuth (Basic-auth + JSON body), HTTP error
mapping, search cursor pagination, page+block fetch concatenation, query
search, webhook-failure -> polling fallback, and registry metadata.
