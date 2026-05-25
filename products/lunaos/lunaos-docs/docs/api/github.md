# GitHub Integration API

Connect GitHub repositories for RAG-powered code analysis.

## OAuth Flow

### Initiate OAuth

```
GET /github/auth
Authorization: Bearer <token>
```

**Response:**
```json
{ "url": "https://github.com/login/oauth/authorize?..." }
```

Redirect the user to the returned URL. After authorization, GitHub redirects to `/github/callback` which stores the connection and redirects to the dashboard.

### Check Connection Status

```
GET /github/status
Authorization: Bearer <token>
```

**Response:**
```json
{
  "connected": true,
  "username": "octocat",
  "githubId": "12345",
  "scopes": "read:user,repo",
  "connectedAt": "2026-02-15T10:00:00Z"
}
```

### Disconnect GitHub

```
DELETE /github/disconnect
Authorization: Bearer <token>
```

## Repository Operations

### List Repositories

```
GET /github/repos?page=1&sort=updated
Authorization: Bearer <token>
```

**Response:**
```json
{
  "repos": [
    {
      "id": 123,
      "name": "my-app",
      "fullName": "user/my-app",
      "description": "My application",
      "language": "TypeScript",
      "private": false,
      "indexed": true,
      "starCount": 42,
      "updatedAt": "2026-02-20T10:00:00Z"
    }
  ]
}
```

### Index a Repository

```
POST /github/repos/:owner/:repo/index
Authorization: Bearer <token>
```

Fetches the repository tree, filters source files, and indexes them via the RAG pipeline.

**Response:**
```json
{
  "success": true,
  "repo": "user/my-app",
  "indexedFiles": 45,
  "processed": 45,
  "totalSourceFiles": 120,
  "skipped": 70
}
```

### List Indexed Repositories

```
GET /github/indexed
Authorization: Bearer <token>
```

**Response:**
```json
{
  "repos": [
    { "fullName": "user/my-app", "fileCount": 45, "indexedAt": "2026-02-20T10:00:00Z" }
  ]
}
```

## Webhook (Continuous Sync)

```
POST /github/webhook
X-GitHub-Event: push
```

Automatically re-indexes repositories on push events. Returns `202 Accepted` immediately and processes in background.
