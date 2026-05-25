# API Keys

Generate and manage API keys for programmatic access. API keys can be used in CI/CD pipelines, scripts, and integrations.

## Generate API Key

Create a new API key. Maximum **5 active keys** per user.

```http
POST /api-keys
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "name": "ci-pipeline"
}
```

**Response (201):**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "ci-pipeline",
  "key": "lnos_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
  "prefix": "lnos_live_a1b2c3d4",
  "createdAt": "2026-02-09T12:00:00.000Z"
}
```

::: danger Important
The **full API key** is only shown **once** at creation time. Store it securely.
:::

---

## List API Keys

Retrieve all API keys (prefix only — not the full key).

```http
GET /api-keys
Authorization: Bearer <token>
```

**Response (200):**

```json
{
  "keys": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "ci-pipeline",
      "prefix": "lnos_live_a1b2c3d4",
      "createdAt": "2026-02-09T12:00:00.000Z",
      "lastUsedAt": "2026-02-09T15:30:00.000Z"
    },
    {
      "id": "660f9511-f3ac-52e5-b827-557766551111",
      "name": "local-dev",
      "prefix": "lnos_live_x9y8z7w6",
      "createdAt": "2026-02-05T10:00:00.000Z",
      "lastUsedAt": null
    }
  ]
}
```

---

## Revoke API Key

Permanently revoke an API key.

```http
DELETE /api-keys/:id
Authorization: Bearer <token>
```

**Response (200):**

```json
{
  "message": "API key revoked"
}
```

---

## Using API Keys

API keys are used like Bearer tokens:

```bash
curl -X POST https://api.lunaos.ai/agents/execute \
  -H "Authorization: Bearer lnos_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6" \
  -H "Content-Type: application/json" \
  -d '{"agent": "code-review", "context": "your code here"}'
```

In CI/CD environments:

```yaml
# GitHub Actions
- name: Run LunaOS Code Review
  run: |
    curl -X POST https://api.lunaos.ai/agents/execute \
      -H "Authorization: Bearer ${{ secrets.LUNAOS_API_KEY }}" \
      -H "Content-Type: application/json" \
      -d '{"agent": "code-review", "context": "'"$(cat src/main.ts)"'"}'
```

## Key Format

All API keys follow the format:

```
lnos_live_{32 random hex characters}
```

- Prefix: `lnos_live_` — identifies LunaOS API keys
- Body: 128-bit random entropy (32 hex chars)
- Keys are hashed with SHA-256 before storage — we never store raw keys

## Rate Limits

API keys inherit the rate limits of the user who created them:

| Tier | Limit |
|------|-------|
| Free | 60 req/min |
| Pro | 600 req/min |
| Team | 6,000 req/min |
