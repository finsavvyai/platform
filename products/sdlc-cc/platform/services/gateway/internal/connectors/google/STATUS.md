# google_workspace — REAL

Status: **REAL** — needs CLIENT_ID/SECRET at runtime.

## Required environment variables

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI` (e.g. `https://<gateway-host>/admin/connectors/google_workspace/callback`)

## What's implemented

- `Authenticate` — POST to `https://oauth2.googleapis.com/token` (form-encoded code exchange).
- `ListResources` — GET `drive/v3/files` with `pageToken` pagination.
- `Fetch` — GET `drive/v3/files/{id}` for metadata, then `?alt=media` (binary) or `/export?mimeType=text/plain` for Google-native docs.
- `Search` — GET `drive/v3/files?q=fullText contains "<query>"`.
- `Watch` — POST `drive/v3/changes/watch` to register a push channel; channel closes when `ctx` is cancelled.

## OAuth scopes

- `https://www.googleapis.com/auth/drive.readonly`
- `https://www.googleapis.com/auth/documents.readonly`
- `https://www.googleapis.com/auth/spreadsheets.readonly`

## Tests

`connector_test.go` exercises every method against `httptest.NewServer`
fixtures plus an in-memory `connectors.MemoryStore`.
