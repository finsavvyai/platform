# Authentication

LunaOS uses JWT tokens for user authentication and API keys for programmatic access.

## Sign Up

Create a new account.

```http
POST /auth/signup
Content-Type: application/json
```

**Request Body:**

```json
{
  "email": "developer@example.com",
  "password": "min8chars",
  "name": "Jane Developer"
}
```

**Response (201):**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "developer@example.com",
    "name": "Jane Developer",
    "tier": "free"
  }
}
```

**Errors:**

| Status | Error | Cause |
|--------|-------|-------|
| 400 | Missing email or password | Required fields not provided |
| 409 | Email already registered | Account exists |

::: tip
A **welcome email** is automatically sent on signup via Resend.
:::

---

## Login

Authenticate and receive a JWT token.

```http
POST /auth/login
Content-Type: application/json
```

**Request Body:**

```json
{
  "email": "developer@example.com",
  "password": "your-password"
}
```

**Response (200):**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "developer@example.com",
    "name": "Jane Developer",
    "tier": "pro"
  }
}
```

**Note:** Tokens expire after **7 days**.

---

## Get Current User

Retrieve the authenticated user's profile.

```http
GET /auth/me
Authorization: Bearer <token>
```

**Response (200):**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "developer@example.com",
  "name": "Jane Developer",
  "tier": "pro",
  "created_at": "2026-02-01T00:00:00.000Z"
}
```

---

## Using cURL

```bash
# Sign up
curl -X POST https://api.lunaos.ai/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"dev@example.com","password":"secure123","name":"Dev"}'

# Login and save token
TOKEN=$(curl -s -X POST https://api.lunaos.ai/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"dev@example.com","password":"secure123"}' \
  | jq -r '.token')

# Use token
curl https://api.lunaos.ai/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

## JWT Token Structure

The JWT payload contains:

```json
{
  "sub": "user-uuid",
  "email": "developer@example.com",
  "tier": "pro",
  "iat": 1707500000,
  "exp": 1708104800
}
```

| Claim | Description |
|-------|-------------|
| `sub` | User ID (UUID) |
| `email` | User email |
| `tier` | Current subscription tier (`free`, `pro`, `team`) |
| `iat` | Issued at (Unix timestamp) |
| `exp` | Expires at (7 days after issuance) |
