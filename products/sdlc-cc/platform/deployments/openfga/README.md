# OpenFGA Deployment

Relationship-based authorization (ReBAC) service for the SDLC platform,
inspired by Google Zanzibar. Complements the existing OPA deployment:

| System  | Answers                                          | Example                           |
|---------|--------------------------------------------------|-----------------------------------|
| OPA     | "Is this action allowed by policy?"              | Rate limit, data class, PII gate  |
| OpenFGA | "Does this user have this relation to this obj?" | Ownership, sharing, delegated adm |

OPA remains the source of truth for **policy rules**. OpenFGA is the
source of truth for **relationships** (who owns what, who shares with
whom, which folder a document lives under).

## Quickstart

```bash
cd deployments/openfga
docker compose up -d

# Wait until healthy
docker compose ps

# Install the OpenFGA CLI
# macOS: brew install openfga/tap/fga
# or: go install github.com/openfga/cli/cmd/fga@latest

# Create a store
fga store create --name sdlc-platform --api-url http://localhost:8080
# -> copy the store_id, export it:
export FGA_STORE_ID=<id>
export FGA_API_URL=http://localhost:8080

# Write the authorization model
fga model write --file authorization-model.fga

# Export the authorization_model_id and pass it to the Python client
export OPENFGA_STORE_ID=$FGA_STORE_ID
export OPENFGA_API_URL=$FGA_API_URL
export OPENFGA_AUTHORIZATION_MODEL_ID=<returned_model_id>
export OPENFGA_ENABLED=true
```

The Playground UI is available at <http://localhost:3000>.

## Model overview

- `user` — human or service principal (`user:<uuid>`).
- `tenant` — isolation boundary; users are `admin` or `member`.
- `folder` — container scoped to a `tenant`, with `owner`/`editor`/`viewer`.
- `document` — lives in a `folder`; `can_read` and `can_write` inherit
  from the folder, but a direct `owner` always wins.
- `policy` — compliance policy scoped to a tenant; `admin` is inherited
  from `tenant#admin` or granted directly.

The `from` keyword implements Zanzibar-style *tuple-to-userset*
inheritance. For example `can_read: viewer or member from tenant`
means: "a viewer of the folder, OR any member of the folder's tenant".

## Example tuples

```bash
# Make alice an admin of tenant acme
fga tuple write user:alice admin tenant:acme

# Make bob a plain member of tenant acme
fga tuple write user:bob member tenant:acme

# Put folder f1 inside tenant acme
fga tuple write tenant:acme tenant folder:f1

# Alice owns f1
fga tuple write user:alice owner folder:f1

# Create doc1 inside f1
fga tuple write folder:f1 folder document:doc1
```

## Example checks

```bash
# Can bob read doc1? -> true (via tenant#member -> folder#can_read -> document#can_read)
fga query check user:bob can_read document:doc1

# Can bob write doc1? -> false (not an editor, not a tenant admin)
fga query check user:bob can_write document:doc1

# Can alice write doc1? -> true (owner of folder and tenant admin)
fga query check user:alice can_write document:doc1

# Which documents can bob read?
fga query list-objects user:bob can_read document
```

## Testing

Author `.fga.yaml` model tests alongside `authorization-model.fga` and
run:

```bash
fga model test --tests model.tests.yaml
```

## Operational notes

- Store + model versioning: never mutate models in place; every change
  creates a new `authorization_model_id`. Roll forward by updating the
  env var in the RAG service.
- Tuple writes must be transactional with domain writes; use an outbox
  pattern in the RAG service when creating/deleting documents.
- Target latency: p99 `check` < 10 ms on a warm cache.
