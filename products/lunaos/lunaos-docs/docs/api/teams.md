# Teams API

Manage team workspaces for collaborative agent usage.

## Create Team

```
POST /teams
Authorization: Bearer <token>
Content-Type: application/json

{ "name": "My Team" }
```

**Response:**
```json
{
  "team": {
    "id": "team-abc-123",
    "name": "My Team",
    "ownerId": "user-xyz",
    "createdAt": "2026-02-20T10:00:00Z"
  }
}
```

## List Teams

```
GET /teams
Authorization: Bearer <token>
```

**Response:**
```json
{
  "teams": [
    {
      "id": "team-abc-123",
      "name": "My Team",
      "role": "owner",
      "memberCount": 3
    }
  ]
}
```

## List Team Agents

```
GET /teams/:id/agents
Authorization: Bearer <token>
```

Returns agents available to the team based on the team's subscription tier.

**Response:**
```json
{
  "agents": [
    { "slug": "code-review", "name": "Code Review", "tier": "free" },
    { "slug": "security-audit", "name": "Security Audit", "tier": "pro" }
  ]
}
```
