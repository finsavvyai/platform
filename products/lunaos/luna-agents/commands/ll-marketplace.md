---
name: ll-marketplace
displayName: Luna Marketplace
description: Skill marketplace — browse, publish, install, and review community skills
version: 1.0.0
category: ecosystem
agent: luna-marketplace-client
parameters:
  - name: action
    type: string
    description: "Marketplace action: browse, publish, install, search"
    required: true
    prompt: true
    enum: [browse, publish, install, search]
  - name: query
    type: string
    description: Search query or skill name (for search/install actions)
    required: false
workflow:
  - authenticate_user
  - execute_marketplace_action
  - display_results
  - update_local_registry
output: []
prerequisites: []
---

# Luna Marketplace

Skill marketplace inspired by flow-nexus. Browse, publish, install, and review community-built skills that extend Luna's capabilities.

## What This Command Does

1. **Authenticate** — verifies your Luna API key and org membership
2. **Execute Action** — performs the requested marketplace operation
3. **Display Results** — shows skills with ratings, downloads, and compatibility
4. **Update Registry** — syncs your local skill registry after install/publish

## Usage

```
/marketplace browse
/marketplace search "webhook transformer"
/marketplace install luna-skill-slack-notify
/marketplace publish
```

## Actions

### browse
Lists trending and featured skills from the marketplace.

```
/marketplace browse
```

Shows: top 20 skills sorted by popularity, with category filters.

### search
Find skills by keyword, category, or author.

```
/marketplace search "email"
/marketplace search "database migration"
```

Returns: matching skills with name, description, rating, downloads.

### install
Install a skill into your project.

```
/marketplace install luna-skill-slack-notify
```

- Downloads the skill package
- Validates compatibility with your Luna version
- Registers in local `.luna/skills/` directory
- Adds to workflow node palette in Studio

### publish
Publish your custom skill to the marketplace.

```
/marketplace publish
```

- Validates skill manifest (`skill.json`)
- Runs automated quality checks (types, tests, docs)
- Uploads to marketplace CDN
- Earns credits on every install by other users

## Skill Quality Indicators

| Badge | Meaning |
|-------|---------|
| Verified | Passed automated security + quality scan |
| Popular | 100+ installs |
| Maintained | Updated within last 30 days |
| Official | Published by the LunaOS team |

## Credit System

- **Earn credits**: Publish skills, get installs, receive 5-star reviews
- **Spend credits**: Premium skills, priority support, extended quotas
- **Revenue sharing**: 70% to skill author, 30% platform fee

## Skill Manifest Format

```json
{
  "name": "luna-skill-slack-notify",
  "version": "1.2.0",
  "description": "Send Slack notifications from workflows",
  "author": "your-handle",
  "category": "integrations",
  "params_schema": { "channel": "string", "message": "string" },
  "luna_version": ">=1.0.0"
}
```

## Categories

- **integrations** — Third-party service connectors
- **transforms** — Data transformation and mapping
- **triggers** — Event sources and webhooks
- **utilities** — Helpers, formatters, validators
- **ai** — AI/ML model integrations
- **monitoring** — Alerts, logging, dashboards

