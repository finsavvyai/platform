# PushCI Policies

Policy-as-code for PushCI pipelines. Block runs that skip tests, require
code review, pin base images, gate production deploys. Two execution
paths:

1. **Local mode (default).** Policies are JSON, stored in PushCI's KV,
   evaluated in-process by the Workers-native engine in
   `api/src/policy-engine.ts`. Zero infra, sub-millisecond evaluation,
   works on the free plan.
2. **Remote mode (enterprise).** Policies are Rego, loaded into your own
   OPA cluster. PushCI POSTs run context to
   `${opaUrl}/v1/data/pushci/allow` and uses OPA's decision. Good for
   customers already running OPA for Kubernetes admission control
   (Norlys, et al.) who want one policy language across their stack.

Both paths use the same `{ allow, denials[] }` decision shape, so the
dashboard and CLI don't care which engine ran.

---

## Policy JSON schema (local mode)

```jsonc
{
  "name": "require-tests",                // unique per tenant
  "description": "Human-readable intent",
  "effect": "deny",                       // "allow" or "deny"
  "combine": "and",                       // "and" | "or" (default "and")
  "conditions": [
    { "path": "run.tests.ran", "op": "not_equals", "value": true }
  ],
  "message": "Tests are required"
}
```

### Decision semantics

- Every policy whose conditions match is collected into `matched`.
- Any matching policy with `effect: "deny"` pushes an entry into
  `denials[]`.
- The overall decision is `allow = denials.length === 0`. "allow"
  policies are informational (audit trail of which policies green-lit
  the run); they never by themselves produce an allow — missing deny is
  implicit allow.

### Supported ops

| op              | Meaning                                              |
|-----------------|------------------------------------------------------|
| `equals`        | Strict equality (===) with the path value            |
| `not_equals`    | Strict inequality                                    |
| `exists`        | Path is not null and not undefined                   |
| `contains`      | String substring OR array member OR object key       |
| `starts_with`   | String prefix                                        |
| `greater_than`  | Numeric comparison (coerces strings)                 |
| `less_than`     | Numeric comparison                                   |
| `in`            | Value is one of a provided array                     |
| `regex`         | JS regex tested against a string field               |

### Paths

Dotted paths, array indices as numeric segments:

- `run.branch`
- `run.steps.0`
- `run.metadata.commit.author.email`

---

## Local mode — authoring

1. Write a JSON file using the schema above.
2. Upload to PushCI:
   ```bash
   curl -X POST https://api.pushci.dev/api/policy/policies \
     -H "Authorization: Bearer $PUSHCI_TOKEN" \
     -H "Content-Type: application/json" \
     -d @policies/examples/require-tests.json
   ```
3. Test before enforcing:
   ```bash
   curl -X POST https://api.pushci.dev/api/policy/evaluate \
     -H "Authorization: Bearer $PUSHCI_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"mode":"local","input":{"run":{"tests":{"ran":false}}}}'
   ```
   Expected:
   ```json
   { "mode": "local", "evaluated": 1, "allow": false,
     "denials": [{"name":"require-tests","message":"Tests are required..."}],
     "matched": ["require-tests"] }
   ```

---

## Remote mode — OPA

1. Write a `.rego` file. See `examples/require-tests.rego` for the shape
   PushCI expects: a `pushci` package that produces a boolean `allow`
   and an optional `denials` set of strings (or objects with
   `{ name, message }`).
2. Load into your OPA server:
   ```bash
   curl -X PUT --data-binary @examples/require-tests.rego \
     http://opa.internal:8181/v1/policies/require-tests
   ```
3. Tell PushCI where your OPA lives:
   ```bash
   curl -X POST https://api.pushci.dev/api/policy/opa/config \
     -H "Authorization: Bearer $PUSHCI_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"opaUrl":"https://opa.internal:8181","token":"<bearer>"}'
   ```
   The token is AES-256-GCM encrypted at rest.
4. Evaluate remotely:
   ```bash
   curl -X POST https://api.pushci.dev/api/policy/evaluate \
     -H "Authorization: Bearer $PUSHCI_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"mode":"remote","input":{"run":{"tests":{"ran":false}}}}'
   ```

PushCI normalises OPA's decision shape. All of these work:

```jsonc
{ "result": true }                                  // allow
{ "result": false }                                 // deny
{ "result": { "allow": true } }                     // object decision
{ "result": { "allow": false, "denials": ["..."] }} // structured
```

---

## Run context shape

The PushCI webhook worker populates `input` with a document like:

```json
{
  "run": {
    "id": "run_01H...",
    "repo": "norlys/platform",
    "branch": "main",
    "sha": "deadbeef",
    "environment": "production",
    "steps": ["lint", "test", "build", "deploy"],
    "tests": { "ran": true, "passed": true },
    "review": { "approvals": 2 },
    "deploy": { "approvals": 1 },
    "image": "ghcr.io/norlys/platform:1.2.3",
    "metadata": { "commit": { "author": { "email": "eng@norlys.dk" } } }
  },
  "actor": { "sub": "github:12345", "login": "alice" }
}
```

Policies reference fields by dotted path. Unknown fields simply
evaluate to `undefined` and most ops treat that as "no match".

---

## Examples

| File                                    | Purpose                           |
|-----------------------------------------|-----------------------------------|
| `examples/require-tests.json`           | Block runs with no test step      |
| `examples/require-code-review.json`     | Block runs with zero approvals    |
| `examples/block-unapproved-base-image.json` | Pin base image to ghcr.io/norlys |
| `examples/require-prod-approval.json`   | 2-approver rule for production    |
| `examples/require-tests.rego`           | Same as above, in Rego            |
| `examples/require-code-review.rego`     | Same as above, in Rego            |

---

## FAQ

**Q: Why not just embed OPA WASM in Workers?**
A: We tried. OPA's WASM runtime is ~1.5 MB and pulls in Go runtime
stubs that exceed Workers' startup budget on cold starts. The JSON DSL
covers ~90% of real policies at zero cost; customers who need full Rego
get remote mode.

**Q: Can I run local and remote modes simultaneously?**
A: Yes — set `mode` per evaluate call. A common pattern is local mode
for fast-path policies (require tests) and remote OPA for complex rules
(separation-of-duties, org chart lookups).

**Q: How are policies versioned?**
A: KV stores the current version; each PUT increments `updated_at`. For
audit history, pair this with the PushCI audit log (`/api/audit`).

License: Apache-2.0 / MIT
