# Wave 5 — OpenFGA Relationship Authorization

Status: scaffolded (opt-in via `OPENFGA_ENABLED=true`)
Owner: RAG + Admin services (`services/rag/app/authz/`, `deployments/openfga/`)
Complements: **OPA** (policy rules) — does not replace it.

## Goal

Add Zanzibar-style **relationship-based access control (ReBAC)** to the
SDLC platform so we can model things that pure role/policy systems
cannot express cleanly:

- folder-level sharing ("Alice shared `folder:contracts` with Bob")
- delegated admin ("Acme Corp delegated policy admin to the legal team")
- hierarchical inheritance ("reader of folder X implies reader of every
  document in X, plus every sub-folder X owns")
- tenant isolation as a *relationship*, not a WHERE clause

## Why OpenFGA (and why alongside OPA)

Google's Zanzibar paper showed that huge products (Drive, YouTube,
Cloud IAM) are easier to reason about when you separate **who relates
to what** from **what the policy says you can do**. We keep both:

| Concern                                | System   | Example                                              |
|----------------------------------------|----------|------------------------------------------------------|
| Is this request allowed *at all*?      | OPA      | rate limit, PII gate, data-class rule, geo-fence     |
| Does this user *own* or *share* this?  | OpenFGA  | `user:alice` is `owner` of `document:doc1`           |
| Multi-tenant isolation invariants      | OPA      | `input.tenant_id == token.tenant_id`                 |
| Hierarchical sharing + delegation      | OpenFGA  | `can_read from folder` inheritance                   |
| Audit of *why* a request was allowed   | OPA+OFGA | OPA decision log + OpenFGA check history             |

Rule of thumb: **OPA answers "may this action happen?", OpenFGA answers
"do these two things have this relationship?"**. A request usually
needs *both* to succeed.

## Model overview

See `deployments/openfga/authorization-model.fga`. Key relationships:

- `tenant` — `admin` / `member` of a workspace.
- `folder` — has a `tenant`; `owner` → `editor` → `viewer` hierarchy;
  `can_read` inherits from `viewer` **or** any `member` of the tenant;
  `can_write` inherits from `editor` **or** any `admin` of the tenant.
- `document` — belongs to a `folder`; direct `owner` always wins;
  otherwise `can_read`/`can_write` flow through the folder.
- `policy` — compliance policy scoped to a tenant; `admin` is granted
  directly or inherited from `tenant#admin`.

The `X from Y` syntax is OpenFGA's **tuple-to-userset** operator — the
thing that makes inheritance declarative instead of recursive SQL.

## Example queries

Using the bundled CLI once `fga store create` has been run:

```bash
# Direct check
fga query check user:bob can_read document:doc1

# "Which documents can bob read?" — perfect for list endpoints
fga query list-objects user:bob can_read document

# "Who are all the readers of doc1?" — useful for audit UI
fga query list-users document:doc1 can_read --user-type user
```

From Python (see `services/rag/app/authz/checker.py`):

```python
from app.authz import AuthzChecker

checker = AuthzChecker()
if not await checker.can_read_document(user_id, doc_id, tenant_id):
    raise HTTPException(403, "forbidden")

readable = await checker.list_readable_documents(user_id)
```

## Migration path: roles → relationships

The existing `requireRole('admin' | 'user' | 'viewer')` middleware in
`packages/shared-dashboard/src/worker/auth-secure.ts` stays in place.
We migrate incrementally:

1. **Dual-write** (now → next sprint). Every time the API creates a
   document we also write tuples:
   - `user:<creator>` `owner` `document:<doc>`
   - `folder:<f>` `folder` `document:<doc>`
   Tenant membership (`user:<u>` `member` `tenant:<t>`) is backfilled
   from the `users` + `tenants` tables.
2. **Shadow-check**. Read paths call both the legacy role check and
   `AuthzChecker.can_read_document`; log disagreements for a week.
3. **Flip**. When disagreement rate is ~0, make `AuthzChecker` the
   authoritative read gate. Keep OPA in front for policy rules.
4. **Retire** ad-hoc `user.permissions[]` strings in favor of tuples.

## Performance

- OpenFGA ships with an in-memory cache; add a 5 s in-process cache on
  the Python client to avoid a round trip on hot list paths.
- Target: p99 `check` latency **< 10 ms** on warm caches (single-digit
  ms is typical for Zanzibar-style checks).
- Scale: PostgreSQL backend is fine for <100M tuples; switch to MySQL
  or the upcoming sharded backend beyond that.
- Observability: OpenFGA exposes Prometheus metrics on :2112 — add to
  the existing Grafana dashboards under "authz".

## Open items

- [ ] Wire `AuthzChecker` into `services/rag/app/api/` document routes.
- [ ] Add an outbox-pattern job that mirrors `documents` inserts to
      OpenFGA tuple writes transactionally.
- [ ] Grafana dashboard for OpenFGA latency + cache hit rate.
- [ ] Model tests (`.fga.yaml`) checked into `deployments/openfga/`.
